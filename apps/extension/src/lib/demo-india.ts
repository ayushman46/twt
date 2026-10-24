/**
 * Indian-language sample posts for the demo library: Hindi, Hinglish, Tamil,
 * Bengali, Marathi and Telugu, on cricket, markets, study, startups, films and
 * everyday life. Every person, handle, company and post here is fictional.
 *
 * Shaped like the posts in demo.ts, and loaded by loadDemoLibrary() after them.
 */
import { classifyTweet, compileCategories } from './classify';
import { defaultCategories } from './db';
import { computeFacets } from './facets';
import { domainOf } from './parse';
import type { Bookmark, Media, TweetData } from './types';

/** Starts with "demo-", so hasDemoData() and removeDemoData() cover these posts too. */
const INDIA_PREFIX = 'demo-in-';

const DAY = 86_400_000;

interface Person {
  name: string;
  handle: string;
  verified: boolean;
}

const PEOPLE: Person[] = [
  { name: 'Rohan Sethi', handle: 'demo_ipl_talk', verified: false },
  { name: 'Ananya Iyer', handle: 'demo_sipnotes', verified: true },
  { name: 'Meera Joshi', handle: 'demo_upsc_plan', verified: false },
  { name: 'Vikram Dhar', handle: 'demo_thelaledger', verified: false },
  { name: 'Kiran Rao', handle: 'demo_filmtalk', verified: true },
  { name: 'Selvi Arun', handle: 'demo_tamilgoals', verified: false },
  { name: 'Partha Mitra', handle: 'demo_bangla_books', verified: false },
  { name: 'Nikhil Varma', handle: 'demo_devchai', verified: false },
  { name: 'Sneha Pawar', handle: 'demo_marathi_walk', verified: false },
  { name: 'Gita Devi', handle: 'demo_chai_kitchen', verified: false },
  { name: 'Arjun Menon', handle: 'demo_bengaluru_memes', verified: false },
  { name: 'Lakshmi Reddy', handle: 'demo_telugu_songs', verified: true },
];

interface IndiaSeed {
  who: number;
  /** Language code X reports for the post. */
  lang: string;
  text: string;
  /** Number of photos attached. */
  photos?: number;
  /** The post's link, rendered as a preview card. */
  link?: { url: string; title: string; description?: string };
  tags: string[];
}

const SEEDS: IndiaSeed[] = [
  { who: 0, lang: 'hi', text: 'IPL में ओस का असर अब हर रात दिख रहा है। टॉस जीतकर पहले गेंदबाज़ी चुनना अब ज़्यादा समझदारी लगती है। आपकी टीम का पसंदीदा खिलाड़ी कौन है?', tags: ['ipl', 'cricket'] },
  { who: 1, lang: 'en', text: 'Nifty index mein SIP ka sabse bada fayda discipline hai, market timing nahi. Har mahine ek fixed date pe ek fixed amount lagao aur kam se kam 5 saal tak chalao. Ye personal advice nahi, bas ek observation hai.', tags: ['sip', 'nifty'] },
  { who: 2, lang: 'hi', text: 'यूपीएससी प्रीलिम्स की तैयारी का सरल रूटीन: सुबह दो घंटे NCERT, दोपहर में करंट अफेयर्स के नोट्स और रविवार को साप्ताहिक रिवीज़न। मॉक टेस्ट का रिव्यू सबसे ज़रूरी है।', tags: ['upsc'] },
  {
    who: 3,
    lang: 'en',
    text: 'Thela Ledger onboarded 2,000 kirana owners in Pune this quarter. The biggest lesson: WhatsApp-first onboarding beat app downloads 4 to 1. Boring channels, great retention. Notes below 👇',
    link: { url: 'https://example.com/thela-ledger-q3-notes', title: 'Thela Ledger: what we learned onboarding 2,000 shops', description: 'Channels, onboarding flow and retention, on one page.' },
    tags: ['startups', 'fintech'],
  },
  { who: 4, lang: 'en', text: 'Ek film ka interval scene jo 10 saal baad bhi yaad hai. Screenplay likhne walon ke liye ye ek achhi class hai: kirdar ki ek choti si khwahish, aur fir sab kuch badal jaata hai.', tags: ['screenplay'] },
  { who: 5, lang: 'ta', text: 'ஒரு நாளைக்கு ஒரு சிறிய இலக்கு போதும். அதை தொடர்ந்து செய்தால் பெரிய மாற்றம் வரும்.', tags: ['habits'] },
  { who: 6, lang: 'bn', text: 'আজ বৃষ্টির দিনে পুরনো বাংলা গানের প্লেলিস্ট শুনছি। নতুন একটা অভ্যাস শুরু করেছি: রোজ দশ পাতা বই পড়া।', tags: ['reading'] },
  { who: 7, lang: 'en', text: 'Chai break ke baad bug 20 minute mein mila: ek date field UTC mein store ho rahi thi aur UI local time mein dikha rahi thi. Lesson: dates UTC mein store karo, display pe convert karo.', tags: ['dev', 'bugs'] },
  { who: 8, lang: 'mr', text: 'रोज सकाळी १५ मिनिटं चालायला सुरुवात केली आहे. छोटी सुरुवात, पण सातत्य महत्त्वाचं.', tags: ['walking'] },
  { who: 9, lang: 'hi', text: 'मानसून की शाम के लिए अदरक वाली चाय: पानी में अदरक कूटकर उबालें, फिर दूध और चायपत्ती डालें। आख़िर में इलायची। सादा, पर सबसे अच्छा।', photos: 2, tags: ['recipe'] },
  { who: 10, lang: 'en', text: 'Bengaluru mein office se ghar ka 40 minute ka route ab 1 ghanta 20 minute ka hai. Hum sab ne ek mahine pehle ka plan bana rakha hai, bas Google Maps ko pata nahi.', tags: ['bengaluru'] },
  { who: 11, lang: 'te', text: 'సాయంత్రం పూట ఈ పాటలు వింటే రోజంతా అలసట తగ్గిపోతుంది.', photos: 1, tags: ['music'] },
];

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Fictional Indian-language posts as full Bookmark records. Categories come
 * from the built-in rules; ingest re-runs them when the posts are written.
 */
export function buildIndiaDemoPosts(): Bookmark[] {
  const rand = rng(2026);
  const now = Date.now();
  const compiled = compileCategories(defaultCategories());

  return SEEDS.map((s, i): Bookmark => {
    const p = PEOPLE[s.who]!;
    const id = `${INDIA_PREFIX}${String(i + 1).padStart(2, '0')}`;
    const savedAt = now - Math.floor(rand() * 200 * DAY) - i * 3_600_000;
    const createdAt = savedAt - Math.floor(rand() * 3 * DAY);
    const media: Media[] = Array.from({ length: s.photos ?? 0 }, (_, j): Media => ({
      type: 'photo',
      url: `https://picsum.photos/seed/twtdash-in-${i}-${j}/1200/800.jpg`,
      width: 1200,
      height: 800,
    }));
    const likes = Math.floor(Math.pow(rand(), 2.4) * 18_000) + 12;
    const tweet: TweetData = {
      id,
      url: `https://example.com/twtdash-demo/${id}`,
      text: s.text,
      lang: s.lang,
      createdAt,
      author: { id: `in-${s.who}`, name: p.name, handle: p.handle, avatar: '', verified: p.verified, followers: 1000 + Math.floor(rand() * 90_000) },
      media,
      links: s.link ? [{ url: s.link.url, display: s.link.url.replace('https://', '').slice(0, 28) + '…', domain: domainOf(s.link.url) }] : [],
      hashtags: [],
      mentions: [],
      card: s.link ? { url: s.link.url, title: s.link.title, description: s.link.description, domain: domainOf(s.link.url) } : undefined,
      metrics: { likes, retweets: Math.floor(likes * 0.12), replies: Math.floor(likes * 0.04), quotes: Math.floor(likes * 0.01), views: likes * (30 + Math.floor(rand() * 40)), bookmarks: Math.floor(likes * 0.3) },
      isReply: false,
      isNote: s.text.length > 280,
    };
    return {
      ...tweet,
      sources: ['bookmark'],
      savedAt,
      capturedAt: now,
      updatedAt: now,
      category: classifyTweet(tweet, compiled).category,
      categorySource: 'rule',
      tags: s.tags,
      collections: [],
      starred: i % 5 === 0 ? 1 : 0,
      archived: 0,
      read: i % 3 === 0 ? 0 : 1,
      note: '',
      facets: computeFacets(tweet),
    };
  });
}
