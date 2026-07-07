// Curriculum outline (the course guidelines) shown in the left catalog.
// Stages 1–5 (math) and all physics stages are the lesson-level lists from
// docs/course-gen-guide-math.md / course-gen-guide-physics.md verbatim
// (应用题 / 综合实践 omitted per project decision). Math stages 6–11 expand the
// guide's "后续模块" stub into lesson-level items, grounded in the official
// 义务教育课程标准 topics (docs/official-guidelines.md).
//
// A lesson gets an `id` ONLY when its page exists (public/lessons/<id>.html +
// /lesson/<id> route). Those are clickable; the rest are outline entries.

export type OutlineLesson = { title: string; id?: string }
export type OutlineStage = { title: string; lessons: OutlineLesson[] }
export type OutlineSubject = { subject: 'math' | 'physics' | 'robot'; label: string; stages: OutlineStage[] }

const L = (...titles: string[]): OutlineLesson[] => titles.map((title) => ({ title }))

export const CURRICULUM: OutlineSubject[] = [
  {
    subject: 'math',
    label: '数学',
    stages: [
      {
        title: '数轴和有理数',
        lessons: L(
          '数轴上的位置', '方向：向左和向右', '正数、负数和零', '相反数', '绝对值是到零的距离',
          '有理数大小比较', '数轴上的移动', '有理数加法', '有理数减法', '加减混合',
          '有理数乘法', '有理数除法', '有理数四则混合',
        ),
      },
      {
        // Stage 2 mirrors docs/math-ledger/stage-2.json (the sr-math-lesson ledger):
        // anatomy 概念课 (项/因数, 系数/次数) placed BEFORE the 方法课 that consume them.
        title: '字母和代数式',
        lessons: [
          { title: '用字母表示数' },
          { title: '代数式与求值' },
          { title: '式子的两层：项与因数', id: 'math-s2-03' },
          { title: '项的身份证：系数与次数', id: 'math-s2-04' },
          { title: '同类项与合并', id: 'math-s2-05' },
          { title: '去括号', id: 'math-s2-06' },
          { title: '整式加减', id: 'math-s2-07' },
          { title: '化简综合练武场' },
        ],
      },
      {
        // Stage 3 lessons will be regenerated with sr-math-lesson (old ones retired).
        title: '方程和不等式',
        lessons: L(
          '未知数是什么', '等式两边同加同减', '等式两边同乘同除', '解一元一次方程',
          '去括号解方程', '去分母解方程', '不等式表示范围', '一元一次不等式', '不等式组',
        ),
      },
      {
        title: '基础几何',
        lessons: L(
          '点、线、线段、射线', '角的表示和度量', '相交线和垂线', '平行线', '三角形的边和角',
          '三角形内角和', '全等的意思', '全等三角形判定', '等腰三角形', '直角三角形',
          '勾股定理', '四边形', '平行四边形', '矩形、菱形、正方形',
        ),
      },
      {
        title: '函数',
        lessons: L(
          '一个量随着另一个量变', '表格表示关系', '图像表示关系', '式子表示关系', '平面直角坐标系',
          '一次函数', '一次函数图像', '反比例函数', '二次函数的基本形状',
        ),
      },
      {
        title: '实数、平方根、立方根',
        lessons: L('算术平方根', '平方根', '立方根', '无理数的认识', '实数与数轴', '实数的运算'),
      },
      {
        title: '分式和二次根式',
        lessons: L(
          '分式的意义', '分式的基本性质', '约分与通分', '分式的乘除', '分式的加减',
          '分式方程与增根', '二次根式的意义', '二次根式的乘除', '二次根式的加减',
        ),
      },
      {
        title: '一元二次方程',
        lessons: L(
          '一元二次方程的概念', '直接开平方法', '配方法', '公式法', '因式分解法',
          '根的判别式', '根与系数的关系',
        ),
      },
      {
        title: '相似',
        lessons: L('比例线段', '相似图形', '相似三角形的判定', '相似三角形的性质', '位似'),
      },
      {
        title: '圆',
        lessons: L(
          '圆的基本概念', '弧、弦、圆心角', '圆周角', '点与圆的位置关系', '直线与圆的位置关系',
          '切线的判定与性质', '弧长与扇形面积', '正多边形与圆',
        ),
      },
      {
        title: '统计与概率',
        lessons: L(
          '数据的收集与整理', '统计表与统计图', '平均数、中位数、众数', '方差', '抽样调查',
          '用样本估计总体', '随机事件', '简单概率计算',
        ),
      },
    ],
  },
  {
    subject: 'physics',
    label: '物理',
    stages: [
      {
        title: '测量和物质',
        lessons: L(
          '长度怎么测', '时间怎么测', '质量是什么', '体积怎么比较', '密度从哪里来',
          '用密度解释轻重', '温度是什么', '固体、液体、气体', '物态变化',
        ),
      },
      {
        title: '运动',
        lessons: L('什么叫运动', '参照物', '路程和时间', '速度', '匀速直线运动', '速度图像初步'),
      },
      {
        title: '力',
        lessons: L(
          '力是什么', '力的作用效果', '力的三要素', '重力', '弹力', '摩擦力',
          '二力平衡', '牛顿第一定律初步',
        ),
      },
      {
        title: '压强、浮力和机械',
        lessons: L(
          '压力和压强', '液体压强', '大气压强', '浮力现象', '阿基米德原理初步', '杠杆',
          '滑轮', '功', '功率', '机械效率',
        ),
      },
      {
        title: '热、声、光',
        lessons: L(
          '内能', '热量', '比热容', '声音的产生', '声音的传播', '音调、响度、音色',
          '光的直线传播', '光的反射', '平面镜成像', '光的折射', '凸透镜成像',
        ),
      },
      {
        title: '电和磁',
        lessons: L(
          '电路是什么', '串联和并联', '电流', '电压', '电阻', '欧姆定律', '电功', '电功率',
          '家庭电路和安全用电', '磁体和磁场', '电流的磁效应', '电磁铁', '电磁感应初步',
        ),
      },
    ],
  },
  {
    subject: 'robot',
    label: '机器人',
    stages: [],
  },
]

// "2.4 代数式的值" — stage.order from the id + title from the outline. Used as the
// lesson-view header (no raw id shown). Falls back to the id if not found.
export function getLessonLabel(id: string): string {
  const m = id.match(/^(?:math|physics)-s(\d+)-(\d+)$/)
  for (const s of CURRICULUM) {
    for (const st of s.stages) {
      const l = st.lessons.find((x) => x.id === id)
      if (l) return m ? `${Number(m[1])}.${Number(m[2])} ${l.title}` : l.title
    }
  }
  return m ? `${Number(m[1])}.${Number(m[2])}` : id
}

// Flat list of lessons that actually have a page (clickable).
export const AVAILABLE_LESSONS: { id: string; title: string; subject: string }[] =
  CURRICULUM.flatMap((s) =>
    s.stages.flatMap((st) =>
      st.lessons.filter((l) => l.id).map((l) => ({ id: l.id!, title: l.title, subject: s.label })),
    ),
  )
