// App-level internationalization (STEMROBIN-24). Isomorphic (no server import):
// used by both server functions (for the recorded/answered locale) and client
// components (for UI strings). This module localizes the APP's own hardcoded
// strings + curriculum-outline labels — it is NOT the DB content overlay
// (sr_lesson_i18n), which carries the translated lesson prose/read-checks/exercises.
//
// The learning-content translation lives in the DB overlays (STEMROBIN-23). Here
// we only translate the shell the app hardcodes: UI chrome + the curriculum.ts
// outline labels (subject / stage / lesson titles) that never went into the DB.

export type Locale = 'zh' | 'en'
export const LOCALES: Locale[] = ['zh', 'en']
export const DEFAULT_LOCALE: Locale = 'zh'

export function isLocale(v: unknown): v is Locale {
  return v === 'zh' || v === 'en'
}

// ── UI chrome strings ────────────────────────────────────────────────────────
// Keyed by a stable id; `t(locale, key, vars)` interpolates {name} placeholders.
// zh is the source; a missing en key falls back to the zh string (never blank).
const STRINGS: Record<Locale, Record<string, string>> = {
  zh: {
    'switch.aria': '学习语言',
    'brand.tagline': '随时随地学理工',
    'cat.open': '打开目录',
    'cat.close': '关闭目录',
    'cat.group.curriculum': '课程大纲',
    'cat.group.stories': '名人传记',
    'cat.stage': '第 {n} 阶段 · {title}',
    // overview
    'ov.title': '总览',
    'ov.progress.title': '学习进度',
    'ov.progress.unit': '点',
    'ov.stat.learned': '课文完成',
    'ov.stat.practiced': '练习完成',
    'ov.pillar1.title': '科学与工程',
    'ov.pillar1.desc': '只要你愿意学，AI 会帮你拆解路径、准备材料，陪你一步步掌握任何科学与工程知识。',
    'ov.pillar2.title': '创造者档案',
    'ov.pillar2.tag': '即将上线',
    'ov.pillar2.desc': '富兰克林、爱迪生、卡内基、福特……读发明家如何把创造变成事业，配理解与创业推理问答。',
    'ov.new': '新上线课程（{n}）',
    // lesson view
    'lesson.back': '返回',
    'lesson.practice': '练习题',
    'lesson.practice.locked': '读完全部卡片后解锁练习',
    'lesson.practice.open': '进入练习题',
    'lesson.pdf': '下载 PDF',
    'lesson.notReady': '课程内容尚未生成。',
    'lesson.nav': '课程导航',
    'lesson.prev': '上一课',
    'lesson.next': '下一课',
    // reading mode switch
    'read.mode.aria': '阅读方式',
    'read.mode.cards': '逐卡精读',
    'read.mode.fulltext': '全文速览',
    // card reader
    'card.progress': '第 {num} / {total} 张卡片',
    'card.nav': '卡片导航',
    'card.noRead': '这张卡片没有读一读，直接看下一张。',
    'card.checksTitle': '读一读 · 读完这张卡再作答',
    'card.guest': '未登录也能读；登录后你的作答才会被记录。',
    'card.doneBadge': '这一课读完了',
    'card.doneText': '全部 {total} 张卡片都读过并作答通过，可以开始练习了。',
    'card.openPractice': '进入练习',
    'card.prev': '上一张卡片',
    'card.next': '下一张卡片',
    'card.locked': '答对本卡的读一读后解锁下一张',
    'card.n': '第 {num} 张',
    'check.ok': '答对了',
    'check.bad': '答得不对——回到本卡再读一遍，然后重答。',
    'input.placeholder': '把答案打在这里',
    'input.submit': '提交',
    'err.network': '网络不太顺，请再试一次。',
    // quiz drawer
    'quiz.title': '卡片答题',
    'quiz.close': '关闭',
    'quiz.login': '答题需要先登录，用于保存你的作答记录。',
    'quiz.goLogin': '去登录',
    'quiz.loading': '正在载入…',
    'quiz.empty': '这一课还没有练习题。',
    'quiz.gateNote': '你上次有一份还没答完的记录，可以继续，或重新开始一份。',
    'quiz.score.last': '上一次成绩',
    'quiz.score.this': '本次成绩',
    'quiz.continue': '继续上一次',
    'quiz.restart': '重新开始',
    'quiz.redo': '再做一遍',
    'quiz.closeBtn': '关闭',
    'quiz.ok': '答对了',
    'quiz.badChoice': '答错了 · 正确答案已标出',
    'quiz.badOther': '答错了 · 看看下面的讲解',
    'quiz.work.hint': '这题要讲道理：先把你的解释说出来（说给别人听最好），说完再看参考答案对照。',
    'quiz.work.reveal': '我说完了，看参考答案',
    'quiz.input.placeholder': '把答案打在这里，如 3x^2-5',
    'quiz.submitting': '提交中…',
    'quiz.submit': '提交',
    'quiz.prev': '上一题',
    'quiz.next': '下一题',
    'quiz.end': '结束本课答题',
    'quiz.end.title': '结束本课答题并查看成绩',
    'quiz.err.choose': '网络不太顺，请再点一次这个选项重试。',
    'quiz.err.submit': '网络不太顺，请再点一次「提交」重试。',
    'quiz.score.ratio': '答对 {correct} / {total} 题',
    'quiz.score.unanswered': '未作答 {n} 题（未得分）',
    'quiz.score.work': '说理 {done} / {total} 题已完成（自评，不计入比例）',
    'quiz.score.wrongLabel': '答错的题：',
    'quiz.score.wrongItem': '第 {n} 题',
    'quiz.score.allRight': '全部答对，太棒了。',
    'quiz.score.noWrong': '这一份没有答错的题。',
    // login
    'login.title': '登录',
    'login.lead': '登录后可保存你的答题记录。',
    'login.email': '邮箱',
    'login.password': '密码',
    'login.submit': '登录',
    'login.submitting': '登录中…',
  },
  en: {
    'switch.aria': 'Learning language',
    'brand.tagline': 'Learn STEM anytime, anywhere',
    'cat.open': 'Open catalog',
    'cat.close': 'Close catalog',
    'cat.group.curriculum': 'Curriculum',
    'cat.group.stories': 'Biographies',
    'cat.stage': 'Stage {n} · {title}',
    'ov.title': 'Overview',
    'ov.progress.title': 'Learning progress',
    'ov.progress.unit': 'pts',
    'ov.stat.learned': 'Reading done',
    'ov.stat.practiced': 'Practice done',
    'ov.pillar1.title': 'Science & Engineering',
    'ov.pillar1.desc':
      'As long as you want to learn, AI helps map the path, prepare the materials, and walk you step by step through any science or engineering topic.',
    'ov.pillar2.title': 'Creator Profiles',
    'ov.pillar2.tag': 'Coming soon',
    'ov.pillar2.desc':
      'Franklin, Edison, Carnegie, Ford… read how inventors turned creating into a career, with comprehension and entrepreneurial-reasoning questions.',
    'ov.new': 'New lessons ({n})',
    'lesson.back': 'Back',
    'lesson.practice': 'Practice',
    'lesson.practice.locked': 'Finish all cards to unlock practice',
    'lesson.practice.open': 'Open practice',
    'lesson.pdf': 'Download PDF',
    'lesson.notReady': "This lesson's content is not ready yet.",
    'lesson.nav': 'Lesson navigation',
    'lesson.prev': 'Previous',
    'lesson.next': 'Next',
    'read.mode.aria': 'Reading mode',
    'read.mode.cards': 'Close reading',
    'read.mode.fulltext': 'Full text',
    'card.progress': 'Card {num} / {total}',
    'card.nav': 'Card navigation',
    'card.noRead': 'This card has no read-check — go on to the next.',
    'card.checksTitle': 'Read-check · answer after reading this card',
    'card.guest': 'You can read without signing in; sign in to save your answers.',
    'card.doneBadge': 'You finished this lesson',
    'card.doneText': 'All {total} cards read and answered — you can start practicing.',
    'card.openPractice': 'Start practice',
    'card.prev': 'Previous card',
    'card.next': 'Next card',
    'card.locked': "Answer this card's read-check correctly to unlock the next",
    'card.n': 'Card {num}',
    'check.ok': 'Correct',
    'check.bad': 'Not quite — reread this card, then answer again.',
    'input.placeholder': 'Type your answer here',
    'input.submit': 'Submit',
    'err.network': 'Network hiccup — please try again.',
    'quiz.title': 'Practice',
    'quiz.close': 'Close',
    'quiz.login': 'Sign in to answer, so your answers are saved.',
    'quiz.goLogin': 'Sign in',
    'quiz.loading': 'Loading…',
    'quiz.empty': 'No practice questions yet.',
    'quiz.gateNote': 'You have an unfinished attempt — continue it, or start over.',
    'quiz.score.last': 'Last score',
    'quiz.score.this': 'This score',
    'quiz.continue': 'Continue',
    'quiz.restart': 'Start over',
    'quiz.redo': 'Try again',
    'quiz.closeBtn': 'Close',
    'quiz.ok': 'Correct',
    'quiz.badChoice': 'Wrong · the correct answer is marked',
    'quiz.badOther': 'Wrong · see the explanation below',
    'quiz.work.hint':
      'This one asks you to reason: say your explanation out loud first (best to someone else), then check it against the reference answer.',
    'quiz.work.reveal': 'I explained — show the answer',
    'quiz.input.placeholder': 'Type your answer, e.g. 3x^2-5',
    'quiz.submitting': 'Submitting…',
    'quiz.submit': 'Submit',
    'quiz.prev': 'Previous',
    'quiz.next': 'Next',
    'quiz.end': 'Finish',
    'quiz.end.title': 'Finish and see your score',
    'quiz.err.choose': 'Network hiccup — tap the option again.',
    'quiz.err.submit': 'Network hiccup — tap Submit again.',
    'quiz.score.ratio': '{correct} / {total} correct',
    'quiz.score.unanswered': '{n} unanswered (no score)',
    'quiz.score.work': '{done} / {total} reasoning items done (self-checked, not in the ratio)',
    'quiz.score.wrongLabel': 'Wrong: ',
    'quiz.score.wrongItem': 'Q{n}',
    'quiz.score.allRight': 'All correct — great!',
    'quiz.score.noWrong': 'No wrong answers here.',
    'login.title': 'Sign in',
    'login.lead': 'Sign in to save your answer history.',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.submit': 'Sign in',
    'login.submitting': 'Signing in…',
  },
}

export function t(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const s = STRINGS[locale]?.[key] ?? STRINGS.zh[key] ?? key
  if (!vars) return s
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
}

// ── Curriculum-outline labels (the app's own hardcoded titles in curriculum.ts) ──
// Only en is stored; zh always uses the source title from curriculum.ts. Missing
// en → the zh source title is used as the fallback (never blank).
export const SUBJECT_LABELS_EN: Record<string, string> = {
  数学: 'Math',
  物理: 'Physics',
  机器人: 'Robotics',
}

export const STAGE_LABELS_EN: Record<string, string> = {
  字母和代数式: 'Letters and Algebraic Expressions',
  方程和不等式: 'Equations and Inequalities',
}

// English titles for the lessons that have a page + full en overlay (the 16
// migrated + translated math lessons). Keyed by lesson id.
export const LESSON_TITLES_EN: Record<string, string> = {
  'math-s2-01': 'Using Letters to Represent Numbers',
  'math-s2-02': 'Algebraic Expressions and Evaluation',
  'math-s2-03': 'Two Layers of an Expression: Terms and Factors',
  'math-s2-04': "A Term's ID Card: Coefficient and Degree",
  'math-s2-05': 'Like Terms and Combining Them',
  'math-s2-06': 'Removing Parentheses',
  'math-s2-07': 'Adding and Subtracting Polynomials',
  'math-s2-08': 'Simplification Practice Arena',
  'math-s3-01': 'What Is an Unknown',
  'math-s3-02': 'Adding or Subtracting the Same on Both Sides',
  'math-s3-03': 'Multiplying or Dividing Both Sides by the Same',
  'math-s3-04': 'The Shape of a Linear Equation in One Variable',
  'math-s3-05': 'Solving a Linear Equation in One Variable',
  'math-s3-06': 'Solving Equations by Removing Parentheses',
  'math-s3-07': 'Solving Equations by Clearing Denominators',
  'math-s3-08': 'Word Problems: Just the Quantity Relationships',
}

// Practice-question type badges (sr_questions.type) — a small fixed vocabulary.
const QUESTION_TYPE_EN: Record<string, string> = {
  辨认: 'Identify',
  表示: 'Represent',
  操作: 'Operate',
  反推: 'Reverse',
  辨错: 'Spot the Error',
  说理: 'Explain',
}

export function localizeSubject(label: string, locale: Locale): string {
  return locale === 'en' ? (SUBJECT_LABELS_EN[label] ?? label) : label
}
export function localizeStage(title: string, locale: Locale): string {
  return locale === 'en' ? (STAGE_LABELS_EN[title] ?? title) : title
}
export function localizeLessonTitle(id: string, zhTitle: string, locale: Locale): string {
  return locale === 'en' ? (LESSON_TITLES_EN[id] ?? zhTitle) : zhTitle
}
export function localizeQuestionType(type: string, locale: Locale): string {
  return locale === 'en' ? (QUESTION_TYPE_EN[type] ?? type) : type
}
