// Sample content for the preview and for local work without API keys.
// The title says "Sample issue" so nobody mistakes this for live research. The stories
// are illustrative: real publishers with plausible article paths, dated October 2026.
// Live issues come from research.js and replace all of this.

export const sampleContent = {
  title: 'Sample issue: AI rules move to the syllabus, tutors show first results',
  intro:
    'Campuses spent the past year arguing about whether to allow AI in coursework. ' +
    'This month the argument moved to how: syllabus-level rules, tutor pilots with real numbers, ' +
    'and a regulator asking for published grading policies. Five stories cover the shift.',
  stories: [
    {
      headline: 'Most campuses now set AI rules course by course, survey finds',
      summary:
        "A fall survey of 212 provosts' offices finds that two thirds of institutions ask instructors " +
        'to state in each syllabus what AI help is allowed, replacing the blanket bans many adopted in 2024. ' +
        'Provosts say the earlier rules were ignored and hard to apply in integrity cases.',
      source: 'Inside Higher Ed',
      url: 'https://www.insidehighered.com/news/tech-innovation/artificial-intelligence/2026/10/19/most-campuses-now-set-ai-rules-course-course',
      date: '2026-10-19',
      image: 'https://picsum.photos/seed/biola-syllabus-ai-policy/1200/630',
    },
    {
      headline: 'Early AI tutor pilots lift pass rates in math, not in writing',
      summary:
        'Results from pilots at 14 institutions show pass rates in gateway algebra and statistics rose ' +
        'between three and six points, while first-year writing courses saw no measurable change. ' +
        "Instructors report the tools work best when students must explain the tutor's answer to a person.",
      source: 'The Chronicle of Higher Education',
      url: 'https://www.chronicle.com/article/early-ai-tutor-pilots-lift-pass-rates-in-math-not-in-writing',
      date: '2026-10-16',
      image: null,
    },
    {
      headline: 'Admissions offices test AI essay readers, with a person on every file',
      summary:
        'Three large public systems are using language models to flag application essays for a second ' +
        'human read rather than to score them. Counselors say the flags catch formulaic drafts but miss ' +
        'the context a trained reader notices, so no file is decided by software.',
      source: 'EdSurge',
      url: 'https://www.edsurge.com/news/2026-10-14-admissions-offices-test-ai-essay-readers-with-a-person-on-every-file',
      date: '2026-10-14',
      image: 'https://picsum.photos/seed/biola-admissions-essay-desk/1200/630',
    },
    {
      headline: 'UK regulator asks universities to publish where AI touches grading',
      summary:
        'The Office for Students has written to vice-chancellors asking for public statements on which ' +
        'assessments use automated tools and how students can appeal a result. Several Russell Group ' +
        'universities say their policies will be online before January exams.',
      source: 'Times Higher Education',
      url: 'https://www.timeshighereducation.com/news/uk-regulator-asks-universities-publish-where-ai-touches-grading',
      date: '2026-10-12',
      image: null,
    },
    {
      headline: 'Campus IT budgets strain as AI license costs rival the LMS',
      summary:
        'CIOs at mid-sized private colleges report that per-seat AI contracts now cost as much as their ' +
        'learning management systems. Several are moving to usage-based pricing and dropping tools that ' +
        'fewer than one in five students opened after the first month.',
      source: 'University Business',
      url: 'https://universitybusiness.com/campus-it-budgets-strain-as-ai-license-costs-rival-the-lms/',
      date: '2026-10-09',
      image: 'https://picsum.photos/seed/biola-campus-it-budget/1200/630',
    },
  ],
  takeaways: [
    'Course-level AI policies have replaced campus-wide bans at most institutions, and the syllabus now carries the rule.',
    'AI tutors show real gains in gateway math courses and no measurable effect in writing so far.',
    'Regulators and CIOs both want evidence: published grading policies in the UK and usage logs before license renewals.',
  ],
};

export const sampleMeta = {
  topic: 'Artificial intelligence in higher education',
  date: new Date('2026-10-21T09:00:00-07:00'),
  repoUrl: 'https://github.com/S4ul1to/portfolio',
  to: 'sedgardoh@gmail.com',
  sample: true, // the footer says so instead of claiming live sources
};
