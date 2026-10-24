/**
 * Labeled evaluation set for the on-device categorizer.
 *
 * Every post is fictional and hand-written to look like a real X post.
 * Labels follow LABELING_GUIDE below; `also` lists other acceptable ids for
 * genuinely ambiguous posts (reported as "lenient" accuracy, never used for
 * the primary "strict" number).
 */

export type EvalGroup =
  | 'en' // global English
  | 'en-in' // Indian English
  | 'hinglish' // romanized Hindi + English
  | 'hi' // Hindi, Devanagari
  | 'mr' // Marathi
  | 'bn' // Bengali
  | 'gu' // Gujarati
  | 'pa' // Punjabi (Gurmukhi)
  | 'ta' // Tamil
  | 'te' // Telugu
  | 'kn' // Kannada
  | 'ml' // Malayalam
  | 'link'; // link-only posts (little or no text; domain + optional card)

export interface EvalPost {
  /** Unique, `${group}-${nnn}`. */
  id: string;
  group: EvalGroup;
  /** Gold category id. */
  gold: string;
  /** Other acceptable ids, only for genuinely ambiguous posts. */
  also?: string[];
  text: string;
  /** Linked page: domain (no www.) plus the card title/description X shows, when any. */
  link?: { domain: string; title?: string; description?: string };
  /** Text of a quoted post, if the post quotes another one. */
  quoted?: string;
  /** Deliberately tricky (misleading words, cross-topic, sarcasm, very short). */
  hard?: boolean;
}

export const EVAL_CATEGORY_IDS = [
  'ai',
  'dev',
  'design',
  'startups',
  'marketing',
  'finance',
  'crypto',
  'productivity',
  'career',
  'science',
  'health',
  'learning',
  'tools',
  'news',
  'sports',
  'culture',
  'humor',
  'other',
] as const;

export const LABELING_GUIDE = `
Pick the single category for the MAIN subject of the post.

ai           AI & ML — AI, LLMs, ML research, AI products, prompting, agents.
dev          Programming — software engineering, code, languages, frameworks, devtools, infra, open source, DSA/LeetCode practice.
design       Design & UI — product/UI/UX design, typography, visual inspiration, motion, illustration, branding.
startups     Startups & Business — founders, fundraising, SaaS, strategy, building/scaling companies, indie hacking, Shark Tank India, D2C brands, unicorns, company/business news.
marketing    Marketing & Growth — growth, distribution, SEO, copywriting, content creation, audience building, sales, influencer marketing.
finance      Finance & Investing — markets, stocks, Nifty/Sensex, SIP/mutual funds, personal finance, tax (income tax, GST), RBI, banking, UPI/payments, economy/macro, real estate.
crypto       Crypto & Web3 — Bitcoin, Ethereum, DeFi, tokens, blockchains (incl. Indian crypto tax/regulation).
productivity Productivity & Mindset — habits, focus, discipline, self-improvement, life advice, mental models.
career       Career & Jobs — hiring, job hunting, interviews, salary/CTC/LPA, campus placements, naukri, government-job recruitment/results, layoffs, appraisals, notice period, workplace, remote work, managers.
science      Science & Tech — research, physics, biology, space (ISRO, Chandrayaan, NASA), climate, energy, EVs, hardware/semiconductors, robotics.
health       Health & Fitness — fitness, gym, yoga, ayurveda, nutrition/diet, sleep, longevity, mental health, diseases/medical.
learning     Learning & Resources — books, courses, tutorials, guides, reading lists, exam preparation (UPSC/JEE/NEET/CAT/GATE/boards: syllabus, strategy, booklists, mock tests, notes), study resources.
tools        Tools & Apps — useful apps, websites, extensions, templates, automations, product launches where the tool itself is the subject.
news         News & Politics — current events, politics, elections, Lok Sabha/Parliament, government policy, courts/law, geopolitics, disasters/incidents.
sports       Sports — cricket/IPL/BCCI, football, kabaddi, hockey, tennis, badminton, chess, F1, Olympics, athletics, wrestling; matches, players, results, fantasy-team tips for a match.
culture      Culture & Entertainment — movies (Bollywood, Tollywood, Kollywood…), OTT/web series, TV, music, gaming/esports, art, food/recipes, travel, festivals, celebrities.
humor        Humor & Memes — jokes, memes, shitposts, relatable posts whose main point is to be funny.
other        Doesn't clearly fit: greetings, personal life updates, devotional posts, vague one-liners.

Tie-breaks:
- Startup funding/valuation/launch → startups; stock price, IPO subscription/listing gains, how to invest → finance.
- Economic policy (GST rates, tax slabs, repo rate) → finance; parliament/party politics → news.
- Exam preparation → learning; selection results, placements, salary, job notices → career; paper leaks/protests → news.
- A joke/meme ABOUT a topic → humor when being funny is the point; otherwise the topic.
- Sports-betting crypto token → crypto; fantasy-sports company funding → startups; a match's fantasy team tips → sports.
- Celebrity fitness routine → health; recipe → culture; diet for fat loss → health.
`;
