# STEMROBIN-25 — read-check input→choice conversion summary

Surface converted: **card read-check only** (exercises were already 100% choice — 331 items, 0 input — so no exercise data changed).

Total: **40** input read-checks across **15** lessons re-authored as 4-option single-answer diagnostic choice. Prompts preserved; distractors are same-surface-form and tied to a nameable misconception; correct option marked by `key.correct_index` in the neutral `content` base only. Snapshot of all 16 lessons (content/exercises/zh/en) before mutation: `refs/snapshot-before/`.

## math-s2-01 (2 converted)

- `math-s2-01-explain-rc1` — correct: **$3a$** · distractors: $a3$ / $3+a$ / $a^3$
  - misconception design: 3×a 省略乘号=3a; 顺序颠倒/误当加法/误当乘方
- `math-s2-01-examples-rc1` — correct: **28 元** · distractors: 11 元 / 47 元 / 4 元
  - misconception design: 4m,m=7 →28; 4+7=11 加错/数字并排47/只写单价4

## math-s2-02 (3 converted)

- `math-s2-02-motivation-rc1` — correct: **2 元** · distractors: 5 元 / 7 元 / 0 元
  - misconception design: 邮费2元; 5=书价当邮费/7=5+2合并/0=以为不加
- `math-s2-02-explain-rc1` — correct: **17** · distractors: 15 / 25 / 10
  - misconception design: 5x+2,x=3 →17; 15漏加2/25先加后乘/10全相加
- `math-s2-02-examples-rc1` — correct: **-5** · distractors: 3 / -3 / -4
  - misconception design: 2x-1,x=-2 →-5; 3=符号错(+4-1)/-3=漏系数2/-4=漏-1

## math-s2-03 (2 converted)

- `math-s2-03-model-rc1` — correct: **因式** · distractors: 项 / 系数 / 单项式
  - misconception design: 带字母的因数=因式; 误作项/系数/单项式
- `math-s2-03-anatomy-rc1` — correct: **$y$** · distractors: $-y$ / $2y$ / $-2y$
  - misconception design: -2y=-2·y →y; -y重复带负/2y漏负/-2y没拆

## math-s2-04 (4 converted)

- `math-s2-04-model-rc1` — correct: **整式** · distractors: 单项式 / 多项式 / 同类项
  - misconception design: 单项式+多项式统称整式; 只记一类/误作同类项
- `math-s2-04-anatomy-rc1` — correct: **$\frac{1}{2}$** · distractors: $2$ / $x$ / $1$
  - misconception design: x/2=½·x 系数½; 2=把分母当系数/x=把字母当系数/1=以为省略即1
- `math-s2-04-boundary-rc1` — correct: **3** · distractors: 2 / 1 / 4
  - misconception design: x^2y 次数=2+1=3; 2只看x²/1只看y/4=2+2
- `math-s2-04-connections-rc1` — correct: **整式** · distractors: 单项式 / 多项式 / 同类项
  - misconception design: 统称整式; 误作单项式/多项式/同类项

## math-s2-05 (3 converted)

- `math-s2-05-motivation-rc1` — correct: **同类项** · distractors: 整式 / 单项式 / 因式
  - misconception design: 能合并的判据=同类项; 误作整式/单项式/因式
- `math-s2-05-examples-rc1` — correct: **$3$** · distractors: $2x+3$ / $3x$ / $0$
  - misconception design: 2x-2x+3 →3; 2x+3没合并/3x把常数并入/0把3也消掉
- `math-s2-05-connections-rc1` — correct: **相等** · distractors: 更大 / 更小 / 相反
  - misconception design: 合并前后值相等; 误以为变大/变小/相反

## math-s2-06 (3 converted)

- `math-s2-06-motivation-rc1` — correct: **符号** · distractors: 系数 / 字母 / 次数
  - misconception design: 去括号里每项的符号会变; 误以为系数/字母/次数变
- `math-s2-06-examples-rc1` — correct: **$-3a+6$** · distractors: $-3a-6$ / $-3a+2$ / $3a-6$
  - misconception design: -3(a-2)=-3a+6; -3a-6漏变第二项号/-3a+2没乘/3a-6首项漏负
- `math-s2-06-connections-rc1` — correct: **正着用** · distractors: 反着用 / 不用分配律 / 两个都用
  - misconception design: 去括号=分配律正着用; 反着用=因式分解/不用/都用

## math-s2-07 (2 converted)

- `math-s2-07-explain-rc2` — correct: **最简** · distractors: 最难 / 最大 / 展开
  - misconception design: 化简终点=最简; 望文生义最难/最大/展开
- `math-s2-07-examples-rc2` — correct: **7** · distractors: 5 / 14 / 2
  - misconception design: 两边都等于7; 5只算一边/14两边相加/2把x值当结果

## math-s3-01 (3 converted)

- `math-s3-01-motivation-rc1` — correct: **8 枚** · distractors: 11 枚 / 14 枚 / 3 枚
  - misconception design: 拿走3剩8; 11=没减/14=加了3/3=答成拿走的数
- `math-s3-01-anatomy-rc1` — correct: **13** · distractors: 5 / 36 / 4
  - misconception design: m-4=9 →m=13; 5=9-4方向反/36=9×4/4=只看右边漏加
- `math-s3-01-connections-rc1` — correct: **占一个位置** · distractors: 做计算 / 起名字 / 做装饰
  - misconception design: 字母替未知量占位; 误以为用来计算/命名/装饰

## math-s3-02 (3 converted)

- `math-s3-02-motivation-rc1` — correct: **未知数 $x$** · distractors: 一个数字 / 系数 / 括号
  - misconception design: 目标让左边只剩未知数x; 误作数字/系数/括号
- `math-s3-02-explain-rc1` — correct: **$15=15$** · distractors: $15=10$ / $10=15$ / $50=50$
  - misconception design: 10=10两边+5 →15=15; 15=10只加一边/10=15只加另一边/50=50乘了
- `math-s3-02-examples-rc1` — correct: **6** · distractors: 16 / -6 / 3
  - misconception design: 2x+5=x+11 →x=6; 16=5+11/-6=移项漏变号/3=(11-5)多除

## math-s3-03 (2 converted)

- `math-s3-03-motivation-rc1` — correct: **相乘** · distractors: 相加 / 相减 / 相除
  - misconception design: 3x=3与x相乘; 误以为相加/相减/相除
- `math-s3-03-examples-rc1` — correct: **4** · distractors: 36 / 9 / 15
  - misconception design: 3x=12 ÷3 →x=4; 36=12×3/9=12-3/15=12+3

## math-s3-04 (2 converted)

- `math-s3-04-model-rc1` — correct: **整式方程** · distractors: 一元方程 / 二次方程 / 分式方程
  - misconception design: 第三关看是不是整式方程; 误作一元/二次/分式方程
- `math-s3-04-anatomy-rc1` — correct: **$2x-8=0$** · distractors: $2x+2=0$ / $6x-8=0$ / $2x-8$
  - misconception design: 4x-3=2x+5 一般形式2x-8=0; 2x+2=0没变号/6x-8=0移项没变号/2x-8漏=0

## math-s3-05 (4 converted)

- `math-s3-05-motivation-rc1` — correct: **$3x+2=x+8$** · distractors: $x=5$ / $3x=6$ / $2x=6$
  - misconception design: 需自己定顺序的方程=3x+2=x+8; x=5是答案/3x=6/2x=6是中间步骤
- `math-s3-05-explain-rc1` — correct: **未知数孤立** · distractors: 合并同类项 / 去括号 / 通分
  - misconception design: 目标=未知数孤立; 误作合并同类项/去括号/通分
- `math-s3-05-examples-rc1` — correct: **4** · distractors: 12 / 6 / 2
  - misconception design: 5x-3=2x+9 →x=4; 12=停在3x=12/6=9-3当答案/2=多除一次
- `math-s3-05-connections-rc1` — correct: **分配律** · distractors: 结合律 / 交换律 / 移项
  - misconception design: 先用分配律去括号; 误作结合律/交换律/移项

## math-s3-06 (2 converted)

- `math-s3-06-motivation-rc1` — correct: **$2(x+3)=10$** · distractors: $2x+3=10$ / $x+3=10$ / $2(x+3)$
  - misconception design: 带括号方程=2(x+3)=10; 2x+3=10漏括号/x+3=10漏系数/2(x+3)漏=10
- `math-s3-06-examples-rc1` — correct: **5** · distractors: 2 / -5 / 0
  - misconception design: 2(x+1)=3(x-1) →x=5; 2=只乘第一项/-5=符号错/0=乱猜

## math-s3-07 (3 converted)

- `math-s3-07-motivation-rc1` — correct: **$\dfrac{5x}{6}$** · distractors: $\dfrac{2x}{5}$ / $\dfrac{x}{5}$ / $\dfrac{5x}{5}$
  - misconception design: x/2+x/3 通分=5x/6; 2x/5分子分母都加/x/5只加分母/5x/5分母算错
- `math-s3-07-explain-rc1` — correct: **6** · distractors: 5 / 12 / 2
  - misconception design: 分母2,3公分母=6; 5=2+3/12=非最小公倍数/2=只取一个
- `math-s3-07-examples-rc1` — correct: **6** · distractors: 30 / 3 / 12
  - misconception design: x/2+x/3=5 →x=6; 30=5×6只乘一边/3=5当5x/... /12=乘错

## math-s3-08 (2 converted)

- `math-s3-08-explain-rc1` — correct: **设未知数** · distractors: 列方程 / 解方程 / 检验
  - misconception design: 四步法第①步设未知数; 误作列方程/解方程/检验
- `math-s3-08-examples-rc1` — correct: **5 元** · distractors: 3 元 / 8 元 / 10 元
  - misconception design: 笔记本每本5元; 3/8/10为其它价格干扰

