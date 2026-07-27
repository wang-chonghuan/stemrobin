// The landing copy, shared by every landing skin so the two never drift.
// Positioning (2026-07): a complete, human-ordered curriculum in the classic
// Soviet tradition, with AI confined to teaching — explanation, diagnosis,
// practice, review.

export const LANDING_COPY = {
  en: {
    tagline: 'The lemma to science',
    navMap: 'Curriculum map',
    navHow: 'How you learn',
    navTradition: 'Our tradition',
    navPricing: 'Pricing',
    signIn: 'Sign in',
    startFree: 'Start learning free',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    langButton: '中文',
    ready: (n: number) => `${n} lessons ready`,
    comingSoon: 'Coming soon',

    badge: 'In the classic Soviet tradition of Kolmogorov’s era',
    h1pre: 'Learn secondary math and physics as ',
    h1accent: 'one unbroken chain of knowledge',
    h1post: '.',
    heroBody:
      'From arithmetic to calculus, from levers to the atomic nucleus. About 1,500 course units, ordered by what each one depends on, with 16,000+ systematic exercises.',
    heroTrust:
      'The curriculum is written by people. While you learn, AI only explains, diagnoses, drills and schedules review.',
    exploreCurriculum: 'Explore the full curriculum',
    heroMicro: 'Read every lesson and full solution without signing up',

    universeTitle: 'See how knowledge is built, step by step',
    universeSub: 'Zoom, pan, and discover how concepts connect.',
    searchPlaceholder: 'Search course units…',
    chips: { all: 'All', math: 'Mathematics', physics: 'Physics', cross: 'Cross-links' },

    rigorTitle: 'Curriculum first, then AI.',
    rigorSub: 'A stable course backbone; a personal way through it.',
    features: [
      {
        title: 'A human-ordered curriculum',
        body: 'What to learn, and what comes first, is decided by a complete course — not improvised by an AI.',
      },
      {
        title: 'Clear prerequisites',
        body: 'Every unit has a definite place. When you get stuck, you can go back to the basis you actually lack.',
      },
      {
        title: 'Systematic practice, full solutions',
        body: 'Not just the conclusion: practice, correction and review, until you can really do it.',
      },
      {
        title: 'AI tutoring where you need it',
        body: 'It re-explains from your actual mistake, generates similar practice, and schedules the review.',
      },
    ],
    quote:
      '“School mathematics, and even the beginnings of calculus, can be mastered by ordinary ability — given good guidance or good books.”',
    quoteBy: '— Andrey Kolmogorov',

    pathTitle: 'Not a pile of topics — a path you can walk to the end',
    pathBody:
      'Scattered lessons tell you many things; a complete curriculum tells you why they come in this order. LemmaDeck organises secondary math and physics into one continuous backbone, so every new unit stands on what you already know.',
    pathItems: [
      {
        title: 'Continuous from the basics',
        body: 'From arithmetic to calculus, from introductory physics to atomic and nuclear physics — no structural gaps between textbooks, videos and problem banks.',
      },
      {
        title: 'One unit at a time',
        body: 'A unit may build a concept, prove a theorem, drill a method, or carry out a construction, an experiment or a real application.',
      },
      {
        title: 'Every step is visible',
        body: 'See what you have mastered, where you need review, and what is best to learn next.',
      },
    ],

    howTitle: 'One unit, one complete act of learning',
    howSteps: [
      {
        title: 'Read the full lesson',
        body: 'Understand how the question arises, how the result is reached, and how it relates to what you already know.',
      },
      {
        title: 'Work the exercises',
        body: 'Use what you have just learned, so “I follow it” becomes “I can do it”.',
      },
      {
        title: 'Understand every mistake',
        body: 'From your actual answer, AI tells a slip in arithmetic from a confused concept from a missing prerequisite.',
      },
      {
        title: 'Review before you forget',
        body: 'Related material comes back on a schedule set by how well you hold it.',
      },
    ],
    howClosing:
      'You do not have to plan the route yourself. Each time, you only finish the one unit worth learning now.',

    tradTitle: 'A classical curriculum, a modern way of learning',
    tradBody:
      'LemmaDeck continues the emphasis on structure, reasoning and continuity that marked Soviet mathematics and physics teaching in Kolmogorov’s era. Rigour does not mean piling on hard problems; it means every step has the grounding it needs, and every result can be reached along a clear path.',
    tradFixedTitle: 'What stays the same is the curriculum',
    tradFixed: ['Scope', 'Order of units', 'Prerequisites', 'Core arguments', 'Learning goals'],
    tradVariesTitle: 'What differs is the teaching',
    tradVaries: [
      'Explanations',
      'Amount of practice',
      'Feedback on mistakes',
      'Pace',
      'Review timing',
    ],
    tradClosing:
      'Everyone works through the same complete curriculum — but the help each person gets can differ.',

    scopeTitle: 'Math and physics grow along one backbone',
    scopeBody:
      'Mathematics is not finished before physics calls on it. Ratio, function, vector, rate of change, spatial relation and conservation keep reappearing across both subjects.',
    scopeMath: 'Mathematics',
    scopeMathChain: [
      'Number and operations',
      'Algebra and equations',
      'Geometry',
      'Functions and graphs',
      'Sequences and combinatorics',
      'Trigonometry',
      'Limits',
      'Calculus',
    ],
    scopePhysics: 'Physics',
    scopePhysicsChain: [
      'Measurement and motion',
      'Mechanics',
      'Heat',
      'Electricity and magnetism',
      'Oscillations and waves',
      'Optics',
      'Atomic and nuclear physics',
    ],
    scopeCta: 'See the full curriculum map',

    tryTitle: 'Don’t take our word for it — open a lesson',
    tryBody:
      'Every lesson and full solution can be read without signing up. Pick any unit and see how it frames a question, arranges practice, and connects to what comes before and after.',
    tryPrimary: 'Open a random unit',
    trySecondary: 'Browse the whole curriculum',
    tryMicro: 'No sign-up · No payment · Read it now',

    planTitle: 'The curriculum is free; the personal tools are optional',
    planFreeTitle: 'Free and open',
    planFree: [
      'All core lessons',
      'Full worked examples',
      'Detailed solutions',
      'Curriculum map and unit relations',
    ],
    planAccountTitle: 'With an account',
    planAccount: ['Save your progress', 'Track accuracy and mastery', 'Continue on any device'],
    planAiTitle: 'Personal plan',
    planAi: [
      'AI explanations for your mistakes',
      'Similar practice on demand',
      'Error-cause analysis',
      'Personalised review schedule',
      'Progress reports',
    ],
    planNote:
      'The free curriculum is not a trial. Even without paying, you can still read every lesson and every solution.',

    faqTitle: 'Questions people ask',
    faq: [
      {
        q: 'Is the curriculum generated by AI?',
        a: 'No. Scope, order of units and prerequisites are designed and reviewed by people. While you learn, AI works on top of that fixed curriculum: explanation, error analysis, similar practice and review scheduling.',
      },
      {
        q: 'Is this only for top students?',
        a: 'No. A complete curriculum lets a well-prepared learner move fast, and helps someone with gaps find the place that actually needs filling. Rigour here means not skipping steps — not making things harder on purpose.',
      },
      {
        q: 'Do I have to start from the first lesson?',
        a: 'No. Start from any unit you are curious about or currently studying; the curriculum map shows which prerequisites it stands on.',
      },
      {
        q: 'Does it follow a particular national syllabus?',
        a: 'LemmaDeck is not a line-by-line copy of any one country’s exam specification. It is a complete secondary course in mathematics and physics; you can pick the entry point closest to your own school curriculum.',
      },
      {
        q: 'What exactly is free?',
        a: 'All core lessons and detailed solutions, with no sign-up. Personalised AI tutoring, review scheduling and learning analytics are the optional part.',
      },
    ],

    finalTitle: 'Stop learning math and physics in pieces.',
    finalBody:
      'Start from any unit and keep going along one complete chain of knowledge.',
    finalSecondary: 'Explore the curriculum map',

    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    reset: 'Reset view',
  },

  zh: {
    tagline: '通往科学的引理',
    navMap: '课程地图',
    navHow: '如何学习',
    navTradition: '课程传统',
    navPricing: '定价',
    signIn: '登录',
    startFree: '免费开始学习',
    openMenu: '打开菜单',
    closeMenu: '关闭菜单',
    langButton: 'EN',
    ready: (n: number) => `${n} 节课已上线`,
    comingSoon: '即将上线',

    badge: '延续柯尔莫戈洛夫时代的经典苏联数理传统',
    h1pre: '把中学数学与物理，学成',
    h1accent: '一条完整的知识链',
    h1post: '。',
    heroBody:
      '从基础数学到微积分，从杠杆到原子核。约 1,500 个课程单元按照前后依赖组织，并配有 16,000+ 道系统练习。',
    heroTrust: '课程主干由人工编排；学习时，AI 只负责讲解、诊断、练习与复习。',
    exploreCurriculum: '探索完整课程',
    heroMicro: '无需注册即可阅读全部课文与详细解答',

    universeTitle: '看见知识如何一步步建立',
    universeSub: '缩放、平移，发现概念如何相连。',
    searchPlaceholder: '搜索课程单元……',
    chips: { all: '全部', math: '数学', physics: '物理', cross: '跨学科连接' },

    rigorTitle: '先有课程，再有 AI。',
    rigorSub: '稳定的课程主干，个性化的学习过程。',
    features: [
      {
        title: '人工编排的课程结构',
        body: '学什么、先学什么，由完整课程决定，而不是由 AI 临时生成。',
      },
      {
        title: '清晰的前后依赖',
        body: '每个单元都有明确位置；卡住时，可以回到真正缺失的基础。',
      },
      {
        title: '系统练习与详细解答',
        body: '不只获得结论，还要经过练习、纠错与复习，直到真正会做。',
      },
      {
        title: 'AI 针对性辅导',
        body: '根据你的具体错误重新解释、生成同类练习，并安排后续复习。',
      },
    ],
    quote: '“中学数学，乃至微积分的基础，在良好的指导或优秀书籍的帮助下，普通的能力就足以掌握。”',
    quoteBy: '—— 安德烈·柯尔莫戈洛夫',

    pathTitle: '不是知识点集合，而是一条可以走完的路径',
    pathBody:
      '零散的课程告诉你许多事情，完整的课程告诉你它们为什么按这个顺序出现。LemmaDeck 将中学数学与物理组织成一条连续主干，让每个新单元都建立在已经掌握的内容之上。',
    pathItems: [
      {
        title: '从基础一路贯通',
        body: '从基础数学到微积分，从基础物理到原子与核物理，不在不同教材、视频和题库之间留下结构断层。',
      },
      {
        title: '一次学清一个单元',
        body: '一个单元可能建立概念、证明定理、训练方法，也可能完成作图、实验或实际应用。',
      },
      {
        title: '每一步都看得见',
        body: '随时查看已经掌握什么、哪里需要复习，以及接下来最适合学习什么。',
      },
    ],

    howTitle: '每个单元，完成一次真正的学习',
    howSteps: [
      {
        title: '阅读完整课文',
        body: '理解问题怎样提出、结论怎样得到，以及它与已有知识有什么关系。',
      },
      { title: '完成系统练习', body: '立即使用刚刚学到的内容，让“看懂”转化为“会做”。' },
      {
        title: '弄清每个错误',
        body: 'AI 根据你的具体答案判断问题来自计算失误、概念混淆，还是前置基础缺失。',
      },
      { title: '在遗忘前复习', body: '系统根据掌握情况重新安排相关内容，让知识进入长期记忆。' },
    ],
    howClosing: '你不需要自己规划整条路线。每次只完成当前最值得学习的一个单元。',

    tradTitle: '经典课程传统，现代学习方式',
    tradBody:
      'LemmaDeck 延续柯尔莫戈洛夫时代苏联数理教育对结构、推理和连续性的重视。严谨并不意味着堆积难题，而是确保每一步都有充分的前置基础，每个结论都能沿着清晰的路径得到。',
    tradFixedTitle: '保持稳定的是课程',
    tradFixed: ['课程范围', '单元顺序', '前后依赖', '核心论述', '学习目标'],
    tradVariesTitle: '因人而异的是教学',
    tradVaries: ['解释方式', '练习数量', '错误反馈', '学习节奏', '复习时间'],
    tradClosing: '所有学习者面对同一套完整课程，但每个人获得的帮助可以不同。',

    scopeTitle: '数学与物理，沿着同一条主干生长',
    scopeBody:
      '数学并不是学完以后才被物理调用。比例、函数、向量、变化率、空间关系和守恒思想，会在两个学科之间不断重新出现。',
    scopeMath: '数学',
    scopeMathChain: [
      '数与运算',
      '代数与方程',
      '几何',
      '函数与图象',
      '数列与组合',
      '三角函数',
      '极限',
      '微积分',
    ],
    scopePhysics: '物理',
    scopePhysicsChain: [
      '测量与运动',
      '力学',
      '热学',
      '电与磁',
      '振动与波',
      '光学',
      '原子与核物理',
    ],
    scopeCta: '查看完整课程地图',

    tryTitle: '不必先相信我们，先打开一节课',
    tryBody:
      '全部课文与详细解答无需注册即可阅读。选择任意课程单元，看看它如何解释一个问题、安排练习，并连接前后的知识。',
    tryPrimary: '随机打开一个课程单元',
    trySecondary: '浏览全部课程',
    tryMicro: '无需注册 · 无需付费 · 立即阅读',

    planTitle: '完整课程免费，个性化学习工具可选',
    planFreeTitle: '免费开放',
    planFree: ['全部核心课文', '完整例题', '详细习题解答', '课程地图与单元关系'],
    planAccountTitle: '注册后',
    planAccount: ['保存学习进度', '记录正确率与掌握度', '跨设备继续学习'],
    planAiTitle: '个性化计划',
    planAi: [
      'AI 针对性讲解',
      '同类练习生成',
      '错误原因分析',
      '个性化复习调度',
      '学习进展报告',
    ],
    planNote: '免费课程不是限时试用。即使不付费，你仍然可以阅读全部课文与详细解答。',

    faqTitle: '常见问题',
    faq: [
      {
        q: '课程是由 AI 生成的吗？',
        a: '不是。课程范围、单元顺序和知识依赖由人工设计与审校。学习时，AI 只在既定课程上提供讲解、错误分析、同类练习和复习安排。',
      },
      {
        q: '只适合成绩优秀的学生吗？',
        a: '不是。完整课程既能让基础扎实的学习者快速前进，也能帮助基础存在缺口的人找到真正需要补充的位置。严谨指的是不跳步，而不是故意增加难度。',
      },
      {
        q: '必须从第一课开始吗？',
        a: '不需要。你可以从任何一个感兴趣或正在学习的单元进入，课程地图会显示它需要哪些前置基础。',
      },
      {
        q: '是否对应某个国家的考试大纲？',
        a: 'LemmaDeck 不是某一国家考试目录的逐项复刻，而是一套完整的中学数学与物理课程。学习者可以根据自己的学校课程选择相近的入口。',
      },
      {
        q: '哪些内容免费？',
        a: '全部核心课文和详细解答免费开放，无需注册。个性化 AI 辅导、复习调度和学习分析属于可选功能。',
      },
    ],

    finalTitle: '不再零散地学习数学与物理。',
    finalBody: '从任意一个课程单元开始，沿着完整的知识链继续向前。',
    finalSecondary: '探索课程地图',

    zoomIn: '放大',
    zoomOut: '缩小',
    reset: '复位视角',
  },
} as const
