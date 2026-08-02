#!/usr/bin/env python3
"""Capture printed answer pages from Soviet ten-year-school textbooks."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

DEFAULT_BOOKS = Path(".tmp/ori-books")
DEFAULT_ROOT = Path("page2class")
DEFAULT_WORK = Path(".tmp/ld-s10y-answer")
SCHEMA = "ld-s10y-answer/book@1"


def dump(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_pages(spec: str) -> list[int]:
    pages: set[int] = set()
    for token in spec.split(","):
        token = token.strip()
        if not token:
            continue
        if "-" in token:
            start_text, end_text = token.split("-", 1)
            start, end = int(start_text), int(end_text)
            if start > end:
                raise ValueError(f"页码范围倒置: {token}")
            pages.update(range(start, end + 1))
        else:
            pages.add(int(token))
    if not pages or min(pages) < 1:
        raise ValueError("必须提供正整数 PDF 页码")
    return sorted(pages)


def find_pdf(args: argparse.Namespace) -> Path:
    if args.pdf:
        path = Path(args.pdf)
        if not path.is_file():
            raise SystemExit(f"ERROR: PDF 不存在: {path}")
        return path

    books = Path(args.books)
    pattern = f"{args.series}/*.pdf" if args.series else "*/*.pdf"
    hits = sorted(
        path
        for path in books.glob(pattern)
        if path.stem == args.book or path.stem.startswith(args.book + " ")
    )
    if not hits:
        raise SystemExit(f"ERROR: {books}/{pattern} 中找不到 {args.book!r} 对应的 PDF")
    if len(hits) > 1:
        choices = ", ".join(f"{path.parent.name}/{path.name}" for path in hits)
        raise SystemExit(f"ERROR: {args.book!r} 匹配到多本，请用 --series: {choices}")
    return hits[0]


def render_page(pdf: Path, page: int, target: Path, dpi: int) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    prefix = target.with_suffix("")
    subprocess.run(
        [
            "pdftoppm",
            "-png",
            "-singlefile",
            "-r",
            str(dpi),
            "-f",
            str(page),
            "-l",
            str(page),
            str(pdf),
            str(prefix),
        ],
        check=True,
    )
    if not target.is_file():
        raise RuntimeError(f"pdftoppm 未生成 {target}")


def cmd_prepare(args: argparse.Namespace) -> int:
    pages = parse_pages(args.pages)
    pdf = find_pdf(args)
    work_dir = Path(args.work) / args.book
    page_dir = work_dir / "pages"

    for page in pages:
        target = page_dir / f"page-{page:04d}.png"
        render_page(pdf, page, target, args.dpi)
        print(f"[prepare] PDF p{page} -> {target}")

    template = {
        "schema": SCHEMA,
        "book": args.book,
        "source": {
            "pdf": pdf.name,
            "pdfSha256": sha256(pdf),
            "pdfPages": pages,
            "printedPages": [],
        },
        "status": "draft",
        "answers": [],
    }
    dump(work_dir / "answers.template.json", template)
    print(f"[prepare] template -> {work_dir / 'answers.template.json'}")
    print(f"[prepare] stable output -> {Path(args.root) / args.book / 'answers.json'}")
    return 0


def validate_answer_file(path: Path, expected_book: str) -> tuple[dict, list[str]]:
    errors: list[str] = []
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise SystemExit(f"ERROR: 缺少 {path}")
    except json.JSONDecodeError as error:
        raise SystemExit(f"ERROR: {path} 不是有效 JSON: {error}")

    if document.get("schema") != SCHEMA:
        errors.append(f"schema 必须是 {SCHEMA!r}")
    if document.get("book") != expected_book:
        errors.append(f"book 必须是 {expected_book!r}")

    source = document.get("source")
    if not isinstance(source, dict):
        errors.append("source 必须是对象")
        source = {}
    source_pages = source.get("pdfPages")
    if (
        not isinstance(source_pages, list)
        or not source_pages
        or any(not isinstance(page, int) or page < 1 for page in source_pages)
    ):
        errors.append("source.pdfPages 必须是非空正整数数组")
        source_pages = []
    elif source_pages != sorted(set(source_pages)):
        errors.append("source.pdfPages 必须严格递增且无重复")

    answers = document.get("answers")
    if not isinstance(answers, list):
        errors.append("answers 必须是数组")
        answers = []

    seen: set[int] = set()
    previous_key: tuple[int, int] | None = None
    for index, answer in enumerate(answers):
        label = f"answers[{index}]"
        if not isinstance(answer, dict):
            errors.append(f"{label} 必须是对象")
            continue
        exercise = answer.get("exercise")
        raw = answer.get("raw")
        pdf_page = answer.get("pdfPage")
        if not isinstance(exercise, int) or exercise < 1:
            errors.append(f"{label}.exercise 必须是正整数")
        elif exercise in seen:
            errors.append(f"exercise {exercise} 重复")
        else:
            seen.add(exercise)
        if not isinstance(raw, str) or not raw.strip():
            errors.append(f"{label}.raw 不能为空")
        if not isinstance(pdf_page, int) or pdf_page not in source_pages:
            errors.append(f"{label}.pdfPage 不在 source.pdfPages 中")
        if answer.get("needsReview") is True and not str(answer.get("reviewNote", "")).strip():
            errors.append(f"{label} 标记 needsReview 时必须写 reviewNote")
        printed_page = answer.get("printedPage")
        if printed_page is not None and (
            not isinstance(printed_page, int) or printed_page < 1
        ):
            errors.append(f"{label}.printedPage 必须是正整数")
        if isinstance(exercise, int) and isinstance(pdf_page, int):
            key = (pdf_page, exercise)
            if previous_key is not None and key <= previous_key:
                errors.append(f"{label} 未按 pdfPage、exercise 严格递增")
            previous_key = key

    return document, errors


def cmd_finalize(args: argparse.Namespace) -> int:
    path = Path(args.root) / args.book / "answers.json"
    document, errors = validate_answer_file(path, args.book)
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 2

    answers = document["answers"]
    source_pages = document["source"]["pdfPages"]
    counts = {
        str(page): sum(1 for answer in answers if answer["pdfPage"] == page)
        for page in source_pages
    }
    review = [
        answer["exercise"]
        for answer in answers
        if answer.get("needsReview") is True
    ]
    document["status"] = "captured"
    document["count"] = len(answers)
    dump(path, document)
    audit = {
        "schema": "ld-s10y-answer/audit@1",
        "book": args.book,
        "status": "pass",
        "answerCount": len(answers),
        "exerciseRange": [
            min((answer["exercise"] for answer in answers), default=None),
            max((answer["exercise"] for answer in answers), default=None),
        ],
        "answersByPdfPage": counts,
        "needsReview": review,
    }
    audit_path = path.with_name("answers.audit.json")
    dump(audit_path, audit)
    print(f"[finalize] PASS: {len(answers)} answers -> {path}")
    print(f"[finalize] audit -> {audit_path}")
    return 0


def add_common(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--book", required=True)
    parser.add_argument("--root", default=str(DEFAULT_ROOT))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="answers.py",
        description="Soviet 10 Years 教材书后答案抄录",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    prepare = subparsers.add_parser("prepare", help="渲染答案页并生成抄录模板")
    add_common(prepare)
    prepare.add_argument("--pages", required=True, help="PDF 物理页，如 305-309")
    prepare.add_argument("--books", default=str(DEFAULT_BOOKS))
    prepare.add_argument("--work", default=str(DEFAULT_WORK))
    prepare.add_argument("--series")
    prepare.add_argument("--pdf")
    prepare.add_argument("--dpi", type=int, default=300)
    prepare.set_defaults(handler=cmd_prepare)

    finalize = subparsers.add_parser("finalize", help="验证并收口 answers.json")
    add_common(finalize)
    finalize.set_defaults(handler=cmd_finalize)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    return args.handler(args)


if __name__ == "__main__":
    raise SystemExit(main())
