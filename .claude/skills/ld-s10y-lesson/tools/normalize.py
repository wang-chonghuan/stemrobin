"""ld-mathpdf 规范化引擎。

原则：「编码统一，字面照抄」
  - 允许：同一字符的不同编码形式统一（全角3→半角3、x²→x^2、\\dfrac→\\frac）
  - 禁止：任何内容层修改（]a,b[ 不得改成 (a,b)；错字不得订正）

cap1 用它强制执行；cap3 用它做全书校验与漂移检测。
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

# ---------- 码点映射表 ----------

_SUP = {
    "\u2070": "0", "\u00b9": "1", "\u00b2": "2", "\u00b3": "3", "\u2074": "4",
    "\u2075": "5", "\u2076": "6", "\u2077": "7", "\u2078": "8", "\u2079": "9",
    "\u207a": "+", "\u207b": "-", "\u207c": "=", "\u207d": "(", "\u207e": ")",
    "\u207f": "n", "\u2071": "i",
}
_SUB = {
    "\u2080": "0", "\u2081": "1", "\u2082": "2", "\u2083": "3", "\u2084": "4",
    "\u2085": "5", "\u2086": "6", "\u2087": "7", "\u2088": "8", "\u2089": "9",
    "\u208a": "+", "\u208b": "-", "\u208c": "=", "\u208d": "(", "\u208e": ")",
    "\u2099": "n", "\u2090": "a", "\u2091": "e", "\u2093": "x",
}
# 数学区内一律折成 ASCII hyphen-minus（LaTeX 惯例）
_MATH_MINUS = {"\u2212": "-", "\u2013": "-", "\u2010": "-", "\u2011": "-", "\uff0d": "-"}

_MATH_SPAN = re.compile(r"(\$\$.+?\$\$|\$[^$]+?\$)", re.S)


def _fullwidth_to_half(s: str, digits: bool, latin: bool) -> tuple[str, int]:
    out, n = [], 0
    for ch in s:
        o = ord(ch)
        if digits and 0xFF10 <= o <= 0xFF19:
            out.append(chr(o - 0xFEE0)); n += 1
        elif latin and (0xFF21 <= o <= 0xFF3A or 0xFF41 <= o <= 0xFF5A):
            out.append(chr(o - 0xFEE0)); n += 1
        else:
            out.append(ch)
    return "".join(out), n


def _unicode_scripts_to_latex(s: str) -> tuple[str, int]:
    """x² → x^2 ，x₁ → x_1 。连续多字符用花括号。"""
    n = 0

    def run(table: str, marker: str, text: str) -> tuple[str, int]:
        tbl = _SUP if table == "sup" else _SUB
        cnt = 0
        res, i = [], 0
        while i < len(text):
            if text[i] in tbl:
                j = i
                buf = []
                while j < len(text) and text[j] in tbl:
                    buf.append(tbl[text[j]]); j += 1
                body = "".join(buf)
                res.append(f"{marker}{body}" if len(body) == 1 else f"{marker}{{{body}}}")
                cnt += 1
                i = j
            else:
                res.append(text[i]); i += 1
        return "".join(res), cnt

    s, c1 = run("sup", "^", s)
    s, c2 = run("sub", "_", s)
    return s, c1 + c2


def _collapse_single_brace(s: str) -> tuple[str, int]:
    """x^{2} → x^2 ；单字符下上标不带花括号（确定性规范形）。"""
    new, n = re.subn(r"([\^_])\{([0-9A-Za-z])\}", r"\1\2", s)
    return new, n


def _normalize_math_spans(s: str, math_minus_ascii: bool) -> tuple[str, int]:
    n = 0

    def repl(m: re.Match) -> str:
        nonlocal n
        span = m.group(0)
        if math_minus_ascii:
            for bad, good in _MATH_MINUS.items():
                if bad in span:
                    n += span.count(bad)
                    span = span.replace(bad, good)
        return span

    return _MATH_SPAN.sub(repl, s), n


def normalize_text(text: str, profile: dict) -> tuple[str, list[dict]]:
    """返回 (规范化后文本, 改动记录)。改动记录只含编码层统一。"""
    changes: list[dict] = []
    orig = text

    form = profile.get("unicode_form", "NFC")
    text = unicodedata.normalize(form, text)
    if text != orig:
        changes.append({"rule": "unicode_form", "detail": form})

    text, n = _fullwidth_to_half(
        text,
        digits=profile.get("digits") == "halfwidth",
        latin=profile.get("latin") == "halfwidth",
    )
    if n:
        changes.append({"rule": "fullwidth_to_halfwidth", "count": n})

    if profile.get("script_style") == "latex":
        text, n = _unicode_scripts_to_latex(text)
        if n:
            changes.append({"rule": "unicode_script_to_latex", "count": n})
        text, n = _collapse_single_brace(text)
        if n:
            changes.append({"rule": "collapse_single_brace", "count": n})

    frac = profile.get("fraction_macro")
    if frac == "\\frac":
        text, n = re.subn(r"\\dfrac\b", "\\\\frac", text)
        if n:
            changes.append({"rule": "dfrac_to_frac", "count": n})

    text, n = _normalize_math_spans(text, profile.get("math_minus") == "ascii")
    if n:
        changes.append({"rule": "math_minus_to_ascii", "count": n})

    return text, changes


def normalize_toc_leader(text: str, profile: dict) -> str:
    leader = profile.get("toc_leader")
    if not leader:
        return text
    return re.sub(r"[.．·…⋯]{3,}|\u2026+", leader, text)


# ---------- 字符白名单 ----------

_ALLOWED_RANGES = [
    (0x0020, 0x007E),   # ASCII 可打印
    (0x00A0, 0x00FF),   # Latin-1 补充（°±×÷ 等）
    (0x0370, 0x03FF),   # 希腊
    (0x0400, 0x04FF),   # 西里尔
    (0x2000, 0x206F),   # 通用标点
    (0x2100, 0x214F),   # 字母式符号
    (0x2190, 0x21FF),   # 箭头
    (0x2200, 0x22FF),   # 数学运算符
    (0x2A00, 0x2AFF),   # 补充数学运算符
    (0x3000, 0x303F),   # CJK 标点
    (0x4E00, 0x9FFF),   # CJK 统一表意
    (0x3400, 0x4DBF),   # CJK 扩展A
    (0xFF01, 0xFF60),   # 全角形式（数字/拉丁已在前面折半，残留即违规）
]


def check_charset(text: str, profile: dict) -> list[dict]:
    """返回白名单外的字符。空列表 = 通过。"""
    extra = set("".join(profile.get("extra_allowed_codepoints", [])))
    forbidden = set("".join(profile.get("forbidden_codepoints", [])))
    bad: dict[str, int] = {}
    for ch in text:
        if ch in ("\n", "\t"):
            continue
        if ch in forbidden:
            bad[ch] = bad.get(ch, 0) + 1
            continue
        if ch in extra:
            continue
        o = ord(ch)
        if any(lo <= o <= hi for lo, hi in _ALLOWED_RANGES):
            continue
        bad[ch] = bad.get(ch, 0) + 1
    return [
        {"char": c, "codepoint": f"U+{ord(c):04X}",
         "name": unicodedata.name(c, "?"), "count": n}
        for c, n in sorted(bad.items())
    ]


# ---------- 一致性信号（cap3 用） ----------

_CYRILLIC_ENUM = set("абвгдежзик")
_LATIN_LOOKALIKE = set("abcdexpo")


def variant_signals(text: str) -> dict[str, int]:
    """抽取会跨页漂移的写法特征，供 cap3 做全书分布统计。"""
    sig: dict[str, int] = {}

    def bump(k: str, n: int = 1) -> None:
        if n:
            sig[k] = sig.get(k, 0) + n

    bump("figure_label.with_space", len(re.findall(r"图\s+\d+", text)))
    bump("figure_label.no_space", len(re.findall(r"图\d+", text)))
    bump("fraction.dfrac", len(re.findall(r"\\dfrac\b", text)))
    bump("fraction.frac", len(re.findall(r"\\frac\b", text)))
    bump("script.unicode_sup", sum(text.count(c) for c in _SUP))
    bump("script.unicode_sub", sum(text.count(c) for c in _SUB))
    bump("script.latex", len(re.findall(r"[\^_]\{?[0-9A-Za-z]", text)))
    bump("minus.u2212", text.count("\u2212"))
    bump("minus.ascii_in_math", sum(
        m.group(0).count("-") for m in _MATH_SPAN.finditer(text)))
    bump("period.halfwidth", len(re.findall(r"[\u4e00-\u9fff]\.", text)))
    bump("period.fullwidth", text.count("。"))
    bump("comma.halfwidth", len(re.findall(r"[\u4e00-\u9fff],", text)))
    bump("comma.fullwidth", text.count("，"))
    bump("section.with_space", len(re.findall(r"§\s+\d", text)))
    bump("section.no_space", len(re.findall(r"§\d", text)))
    bump("interval.french_open", len(re.findall(r"\][^\[\]]*\[", text)))
    return sig


def enum_key_script(key: str) -> str:
    """判定习题小问标号用的是西里尔还是拉丁。字形相同，只能靠码点。"""
    if not key:
        return "empty"
    ch = key[0]
    if ch.isdigit():
        # 数字标号（1) 2) 3)）不存在西里尔/拉丁同形歧义，本检查对其不适用
        return "numeric"
    if ch in _CYRILLIC_ENUM:
        return "cyrillic"
    if ch.isascii() and ch.isalpha():
        return "latin_suspect" if ch in _LATIN_LOOKALIKE else "latin"
    return "other"


# ---------- 工具 ----------

def load_profile(path: str | Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def iter_block_texts(block: dict):
    """产出 (字段路径, 文本)。覆盖所有承载文字的字段。"""
    for field in ("text", "stem", "caption", "title", "label"):
        if isinstance(block.get(field), str):
            yield field, block[field]
    for i, item in enumerate(block.get("items") or []):
        if isinstance(item.get("text"), str):
            yield f"items[{i}].text", item["text"]


def set_block_text(block: dict, path: str, value: str) -> None:
    m = re.match(r"items\[(\d+)\]\.text", path)
    if m:
        block["items"][int(m.group(1))]["text"] = value
    else:
        block[path] = value
