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
    'account.menu': '账户',
    'brand.tagline': '你的家庭数学老师',
    'cat.open': '打开目录',
    'cat.close': '关闭目录',
    'cat.group.curriculum': '课程大纲',
    'cat.stage': '第 {n} 阶段 · {title}',
    'cat.english': '短文学英语',
    'en.read.play': '播放朗读',
    'en.read.gloss': '看中文',
    'en.read.showall': '整篇中文对照',
    'en.read.hideall': '收起整篇中文',
    'en.ladder.enter': '背诵天梯',
    'en.vocab.title': '本课生词',
    'en.vocab.new': '新词',
    'en.vocab.review': '复习',
    // overview
    'ov.title': '总览',
    'ov.progress.title': '学习进度',
    'ov.progress.unit': '点',
    'ov.stat.learned': '课文完成',
    'ov.stat.practiced': '练习完成',
    'ov.hero.badge': '现已开放 · 初中数学',
    'ov.hero.title.a': '为每个孩子量身定制的 ',
    'ov.hero.title.b': 'AI 数学老师',
    'ov.hero.desc': '理解先于刷题：卡片式一步步学懂，再练熟。AI 全程跟踪孩子的进度，识别薄弱、推荐下一课、生成针对性练习——为每个孩子定制学习路径，并带他持续超前。',
    'ov.new': '新上线课程（{n}）',
    // overview — learning-principle column (growth)
    'ov.learn.eyebrow': '科学研究发现',
    'ov.learn.title': '最有效的学习，不是“多看”，是每一步都“想起来”',
    'ov.learn.sub': '认知科学里被反复验证的几条规律，我们做成了孩子每天在用的一张张卡片。',
    'ov.learn.p0.t': '每张卡片，读完都要“想起来”一次',
    'ov.learn.p0.d': '每读完一小步，孩子要主动把刚学的从记忆里取出来作答——认知科学称为“提取练习”。主动回忆比重读一遍记得牢得多，还逼着孩子真读、不跳读，即时反馈让他越答越有劲。',
    'ov.learn.p1.t': '卡片式微学习',
    'ov.learn.p1.d': '一课拆成一张张小卡，一次只学一个点——不贪多、不走神。',
    'ov.learn.p2.t': '即时反馈',
    'ov.learn.p2.d': '答完当场知对错：对了有成就感，错了立刻纠，兴趣越学越浓。',
    'ov.learn.p3.t': '学懂才前进',
    'ov.learn.p3.d': '读懂、练达标才解锁下一课——靠掌握度走，不靠进度条催。',
    'ov.learn.p4.t': 'AI 定制路径',
    'ov.learn.p4.d': 'AI 全程跟踪，识别薄弱、推荐下一课、生成针对性练习。',
    // lesson view
    'lesson.back': '返回',
    'lesson.practice': '练习题',
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
    'login.lead': '登录只为保存你的学习进度和答题记录。',
    'login.email': '邮箱',
    'login.password': '密码',
    'login.submit': '登录',
    'login.submitting': '登录中…',
    'login.logout': '登出',
    'login.free': '完全免费 · 没有付费墙',
    // open-access (STEMROBIN-68)
    'cat.login': '登录',
    'cat.login.sub': '免费保存进度',
    'practice.gate.title': '登录后练习',
    'practice.gate.body': '练习题会保存你的学习进度，所以需要登录后作答。登录完全免费，没有付费墙。',
    'practice.gate.login': '去登录（免费）',
    'practice.gate.cancel': '先看看',
    'ov.progress.guest': '登录后免费保存学习进度',
    'ov.progress.guest.cta': '登录',
    'ov.hero.free': '完全免费，没有付费墙——登录只为保存孩子的学习进度。',
  },
  en: {
    'switch.aria': 'Learning language',
    'account.menu': 'Account',
    'brand.tagline': 'Your home math tutor',
    'cat.open': 'Open catalog',
    'cat.close': 'Close catalog',
    'cat.group.curriculum': 'Curriculum',
    'cat.stage': 'Stage {n} · {title}',
    'cat.english': 'Short-Text English',
    'en.read.play': 'Play narration',
    'en.read.gloss': 'Show Chinese',
    'en.read.showall': 'Show Chinese for the whole text',
    'en.read.hideall': 'Hide whole-text Chinese',
    'en.ladder.enter': 'Recitation ladder',
    'en.vocab.title': 'Words in this lesson',
    'en.vocab.new': 'New',
    'en.vocab.review': 'Review',
    'ov.title': 'Overview',
    'ov.progress.title': 'Learning progress',
    'ov.progress.unit': 'pts',
    'ov.stat.learned': 'Reading done',
    'ov.stat.practiced': 'Practice done',
    'ov.hero.badge': 'Now open · Secondary math',
    'ov.hero.title.a': 'An AI math tutor tailored to ',
    'ov.hero.title.b': 'every child',
    'ov.hero.desc':
      'Understanding before drilling: learn each idea step by step, then practice it to fluency. The AI tracks your child’s progress the whole way — spotting weak points, recommending the next lesson, and generating targeted practice — a learning path built for each child, always keeping them a step ahead.',
    'ov.new': 'New lessons ({n})',
    'ov.learn.eyebrow': 'What the research shows',
    'ov.learn.title': 'The most effective learning isn’t re-reading — it’s recalling at every step',
    'ov.learn.sub':
      'A few of the most-replicated findings in cognitive science, turned into the cards your child uses every day.',
    'ov.learn.p0.t': 'Every card ends with an active recall',
    'ov.learn.p0.d':
      'After each small step, your child pulls what they just learned back out of memory to answer — what scientists call retrieval practice. Actively recalling sticks far better than re-reading, forces real (not skim) reading, and instant feedback keeps them going.',
    'ov.learn.p1.t': 'Card-based microlearning',
    'ov.learn.p1.d': 'Each lesson is broken into small cards — one idea at a time, no overload, no drifting.',
    'ov.learn.p2.t': 'Immediate feedback',
    'ov.learn.p2.d': 'Right or wrong shown on the spot: correct feels rewarding, mistakes are fixed at once.',
    'ov.learn.p3.t': 'Master, then advance',
    'ov.learn.p3.d': 'The next lesson unlocks only after this one is understood and practiced to the bar — paced by mastery, not a progress bar.',
    'ov.learn.p4.t': 'AI-tailored path',
    'ov.learn.p4.d': 'The AI tracks progress throughout — spotting weak points, recommending the next lesson, generating targeted practice.',
    'lesson.back': 'Back',
    'lesson.practice': 'Practice',
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
    'login.lead': 'Signing in only saves your learning progress and answer history.',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.submit': 'Sign in',
    'login.submitting': 'Signing in…',
    'login.logout': 'Sign out',
    'login.free': 'Completely free · no paywall',
    // open-access (STEMROBIN-68)
    'cat.login': 'Sign in',
    'cat.login.sub': 'Save progress, free',
    'practice.gate.title': 'Sign in to practice',
    'practice.gate.body': 'Practice saves your learning progress, so it needs a sign-in. Signing in is completely free — there is no paywall.',
    'practice.gate.login': 'Sign in (free)',
    'practice.gate.cancel': 'Not now',
    'ov.progress.guest': 'Sign in to save your progress — free',
    'ov.progress.guest.cta': 'Sign in',
    'ov.hero.free': 'Completely free, no paywall — sign in only to save your child’s progress.',
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
