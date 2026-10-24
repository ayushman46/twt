/**
 * Built-in category taxonomy.
 *
 * `terms` are comma-separated phrases grouped by weight (3 = strong signal,
 * 1 = weak hint). A trailing `*` makes a term a prefix match ("fundrais*"
 * matches "fundraising"). Matching is case-insensitive and respects word
 * boundaries, so "ai" does not match "said". A space or hyphen between two
 * words of 3+ letters is optional ("stock market" also matches "#stockmarket").
 *
 * `hinglish` holds romanized Hindi (and other Indian-language) words written
 * in Latin script; `indic` holds Indian-script words. Indic terms always match
 * as prefixes (suffixes attach to the word: मैच → मैचों) and are compared after
 * folding every Brahmic script onto Devanagari, so a word written once in
 * Devanagari also matches Bengali, Gurmukhi, Gujarati, Oriya, Telugu and
 * Kannada text that spells it the same way (क्रिकेट = ক্রিকেট = ક્રિકેટ = క్రికెట్).
 * Native spellings are listed only where a language writes the word
 * differently (Tamil கிரிக்கெட், Malayalam ക്രിക്കറ്റ്).
 *
 * `domains` boost a category when a post links to that site: 3 points, or the
 * weight after a colon ("ndtv.com:2" for sites that cover many topics, so the
 * link card's text decides).
 */
export interface CategoryDefinition {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  terms: Partial<Record<1 | 2 | 3, string>>;
  hinglish?: Partial<Record<1 | 2 | 3, string>>;
  indic?: Partial<Record<1 | 2 | 3, string>>;
  domains?: string[];
}

export const FALLBACK_CATEGORY_ID = 'other';

export const DEFAULT_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'ai',
    name: 'AI & ML',
    emoji: '🤖',
    color: '#8B5CF6',
    description: 'Artificial intelligence, LLMs, machine learning research, AI products, prompting and agents.',
    terms: {
      3: 'llm, llms, chatgpt, openai, anthropic, claude, gemini, mistral, llama, deepseek, qwen, machine learning, deep learning, neural net*, fine-tun*, finetun*, rlhf, diffusion model*, stable diffusion, midjourney, hugging face, huggingface, ai agent*, agentic, prompt engineering, embeddings, vector database*, multimodal, pretraining, pre-training, artificial intelligence, genai, generative ai, langchain, llamaindex, ollama, agi, superintelligence, mcp server*, model context protocol, pytorch, tensorflow, reinforcement learning, computer vision, context window, reasoning model*, chain of thought, hallucinat*, ai safety, vibe cod*, open weights, open-weight*, gpt-*, gpt*, claude code, cursor ai, copilot, sora, perplexity, grok, transformer model*, inference, chatbot*, ai model*, ai-generated, ai generated, image generation, text-to-image, deepfake*, sarvam ai, krutrim, bhashini, indiaai',
      2: 'ai, ml, nlp, rag, xai, nvidia, gpu*, cuda, jax, evals, benchmark*, alignment, prompt*, agents, tokens, parameters, transformer, transformers, deepmind, ai-powered, ai tools',
      1: 'model, models, weights, training, dataset*, automation',
    },
    indic: {
      3: 'आर्टिफिशियल इंटेलिजेंस, कृत्रिम बुद्धि, कृत्रिम बुद्धिमत्ता, चैटजीपीटी, चैटबॉट, मशीन लर्निंग, डीपफेक, जेनरेटिव एआई, एआई एजेंट, ai एजेंट, செயற்கை நுண்ணறிவு, சாட்ஜிபிடி, కృత్రిమ మేధ, ನಿರ್ಮಿತ ಬುದ್ಧಿಮತ್ತೆ, കൃത്രിമ ബുദ്ധി, നിർമിത ബുദ്ധി, ചാറ്റ്ജിപിടി',
      2: 'एआई, जेमिनी, प्रॉम्प्ट',
    },
    domains: ['openai.com', 'anthropic.com', 'claude.ai', 'chatgpt.com', 'huggingface.co', 'deepmind.google', 'ai.google.dev', 'mistral.ai', 'perplexity.ai', 'replicate.com', 'together.ai', 'x.ai', 'paperswithcode.com', 'ollama.com', 'analyticsindiamag.com', 'sarvam.ai', 'indiaai.gov.in'],
  },
  {
    id: 'dev',
    name: 'Programming',
    emoji: '💻',
    color: '#3B82F6',
    description: 'Software engineering, code, languages, frameworks, devtools, infrastructure and open source.',
    terms: {
      3: 'javascript, typescript, python, rust, rustlang, golang, kotlin, c++, react, reactjs, next.js, nextjs, vue, vuejs, svelte, angular, node.js, nodejs, deno, npm, github, gitlab, docker, kubernetes, k8s, devops, serverless, postgres*, mysql, sqlite, mongodb, redis, backend, frontend, full-stack, fullstack, web dev*, webdev, software engineer*, software development, programming, programmer*, coding, codebase, repository, pull request, compiler*, data structure*, leetcode, system design, microservice*, graphql, rest api, vscode, vs code, neovim, linux, shell script*, regex, tailwind*, wasm, webassembly, refactor*, unit test*, ci/cd, supabase, firebase, stack overflow, stackoverflow, open source, open-source, swe, sql, api, apis, sdk, cli, competitive programming, codeforces, codechef, hackerrank, geeksforgeeks, django, flask, fastapi, spring boot, flutter, react native, dsa, stack trace*',
      2: 'git, java, swift, bun, aws, database*, developer*, devs, repo, algorithm*, terminal, bash, vim, css, html, debug*, deploy*, vercel, cloudflare, runtime, engineers, engineering, code, gfg, sde',
      1: 'bug*, commit*, ide, framework*, library, syntax, latency, scalab*, cursor, stack',
    },
    indic: {
      3: 'कोडिंग, प्रोग्रामिंग, प्रोग्रामर, जावास्क्रिप्ट, पायथन, डेवलपर, கோடிங், நிரலாக்க, புரோகிராமிங், പ്രോഗ്രാമിങ്, കോഡിങ്',
      2: 'सॉफ्टवेयर, ऐप डेवलपमेंट, वेब डेवलपमेंट',
      1: 'कोड',
    },
    domains: ['github.com', 'gitlab.com', 'stackoverflow.com', 'dev.to', 'npmjs.com', 'vercel.com', 'developer.mozilla.org', 'docs.python.org', 'crates.io', 'pypi.org', 'hashnode.dev', 'go.dev', 'nextjs.org', 'react.dev', 'geeksforgeeks.org', 'leetcode.com', 'codeforces.com', 'codechef.com', 'hackerrank.com', 'hackerearth.com', 'takeuforward.org'],
  },
  {
    id: 'design',
    name: 'Design & UI',
    emoji: '🎨',
    color: '#EC4899',
    description: 'Product, UI and UX design, typography, visual inspiration, motion, illustration and branding.',
    terms: {
      3: 'figma, ui design, ux design, ui/ux, ux, user interface, user experience, typography, typeface, color palette, colour palette, illustration*, icon set, branding, brand identity, visual identity, design system*, dribbble, behance, framer, webflow, motion design, micro-interaction*, microinteraction*, mockup*, wireframe*, whitespace, designer*, three.js, threejs, webgl, kerning, spline, lottie, moodboard, landing page design, graphic design*',
      2: 'ui, font*, gradient*, icons, logo*, animation*, aesthetic*, design, designs, landing page*, svg, shader*, blender, inspiration, layout*, interface',
      1: 'prototype*, portfolio, css, 3d, poster*, grid, pixel*, dark mode, component*, visual*, beautiful',
    },
    indic: {
      3: 'यूएक्स, टाइपोग्राफी, फिग्मा, ग्राफिक डिजाइन, डिजाइनर, வடிவமைப்பு',
      2: 'डिजाइन, फॉन्ट, लोगो, यूआई, डिज़ाइन',
    },
    domains: ['figma.com', 'dribbble.com', 'behance.net', 'framer.com', 'webflow.com', 'awwwards.com', 'mobbin.com', 'fonts.google.com', 'godly.website', 'land-book.com', 'spline.design', 'rive.app', 'coolors.co'],
  },
  {
    id: 'startups',
    name: 'Startups & Business',
    emoji: '🚀',
    color: '#F97316',
    description: 'Founders, fundraising, SaaS, strategy, building and scaling companies, indie hacking.',
    terms: {
      3: 'startup*, founder*, co-founder*, cofounder*, y combinator, ycombinator, yc, fundrais*, venture capital, seed round, pre-seed, series a, series b, series c, saas, b2b, b2c, mrr, arr, product-market fit, pmf, indie hacker*, indiehacker*, indie maker*, solopreneur*, build in public, buildinpublic, product hunt, producthunt, unit economics, go-to-market, pitch deck, term sheet, cap table, entrepreneur*, paul graham, monetiz*, bootstrapp*, churn, funding round, unicorn*, soonicorn*, shark tank, d2c, quick commerce, q-commerce, angel invest*, burn rate, edtech, fintech, healthtech, agritech',
      2: 'vc, vcs, investors, valuation, revenue, acquisition, acquired, ceo, business, customers, pricing, moat, equity, side project*, side hustle*, mvp, stripe, gtm, profitab*, funding, raised, raises, runway, esop*',
      1: 'profit*, launch*, exit, company, companies, competitor*, scale, users, ship, shipped, market, zepto, blinkit, swiggy, zomato, flipkart, meesho, nykaa, razorpay, ola, oyo, brand',
    },
    hinglish: {
      2: 'dhanda, dhandha, vyapar, vyapaar',
    },
    indic: {
      3: 'स्टार्टअप, फंडिंग, फाउंडर, संस्थापक, उद्यमी, उद्यमिता, यूनिकॉर्न, शार्क टैंक, स्टार्टप, ஸ்டார்ட்அப், தொழில்முனைவோர், நிறுவனர், സ്റ്റാർട്ടപ്പ്, സംരംഭക, স্টার্টআপ, స్టార్టప్',
      2: 'बिजनेस, व्यवसाय, वैल्यूएशन, कारोबार, रेवेन्यू',
      1: 'कंपनी, व्यापार, ग्राहक',
    },
    domains: ['ycombinator.com', 'producthunt.com:2', 'indiehackers.com', 'techcrunch.com:1.5', 'paulgraham.com', 'a16z.com', 'crunchbase.com', 'stratechery.com', 'lennysnewsletter.com', 'inc42.com', 'yourstory.com', 'entrackr.com', 'the-ken.com:2', 'vccircle.com', 'tracxn.com', 'startupindia.gov.in'],
  },
  {
    id: 'marketing',
    name: 'Marketing & Growth',
    emoji: '📣',
    color: '#EAB308',
    description: 'Growth, distribution, SEO, copywriting, content creation, audience building and sales.',
    terms: {
      3: 'marketing, marketer*, growth hack*, seo, copywriting, copywriter*, virality, go viral, content creator*, content creation, creator economy, advertising, paid ads, facebook ads, google ads, meta ads, funnel*, conversion rate*, cold email*, lead gen*, personal brand*, storytelling, ugc, influencer*, affiliate*, email list, open rate*, positioning, brand deal*, youtube channel, instagram reels, reply rate*, cold dm*',
      2: 'newsletter*, audience, followers, engagement, viral, headline*, ads, cta, distribution, outreach, sales, impressions, hooks, brand, reels, subscriber*, youtuber*, campaign*',
      1: 'hook, conversion, landing page, leads, tiktok, algorithm, growth, retention, messaging, content, instagram, collab*',
    },
    indic: {
      3: 'मार्केटिंग, कॉपीराइटिंग, विज्ञापन, इन्फ्लुएंसर, कंटेंट क्रिएटर, एसईओ, மார்க்கெட்டிங், விளம்பர, മാർക്കറ്റിങ്, പരസ്യ',
      2: 'फॉलोअर्स, सब्सक्राइबर, సబ్‌స్క్రైబర్, सेल्स, रील्स, ब्रांड',
    },
    domains: ['beehiiv.com', 'convertkit.com', 'kit.com', 'hubspot.com', 'semrush.com', 'ahrefs.com', 'mailchimp.com', 'afaqs.com', 'exchange4media.com'],
  },
  {
    id: 'finance',
    name: 'Finance & Investing',
    emoji: '📈',
    color: '#22C55E',
    description: 'Markets, stocks, investing, personal finance, tax, banking and payments, economics and macro.',
    terms: {
      3: 'stock market, share market, investing, s&p 500, s&p, nasdaq, dow jones, earnings, inflation, recession, interest rate*, the fed, federal reserve, fomc, dividend*, etf*, index fund*, compound interest, net worth, personal finance, hedge fund*, private equity, real estate, mortgage*, gdp, economy, economist*, bull market, bear market, warren buffett, berkshire, balance sheet, cash flow, 401k, roth ira, financial freedom, $tsla, $aapl, $nvda, $spy, $qqq, $msft, $amzn, $meta, $goog, sensex, nifty50, nifty 50, bank nifty, banknifty, mutual fund*, sip, sips, step-up sip, elss, ppf, fixed deposit*, demat, zerodha, groww, upstox, smallcase, rbi, repo rate, sebi, gst, income tax, itr, tds, tax regime, 80c, upi, npci, cibil, credit score, credit card*, home loan*, fii*, dii*, f&o, intraday, options trading, multibagger*, gold price*, gold rate, sovereign gold bond*, union budget, bse, nse, listing gains, gmp, cagr, xirr, expense ratio, flexi cap, flexicap, small cap*, smallcap*, mid cap*, midcap*, large cap*, largecap*, nav, swp, emi*, rupee, carry trade, forex',
      2: 'stock*, invest*, treasury, bonds, wealth, money, trading, trader*, economic*, macro, tariff*, retire*, portfolio, valuation, nifty, ipo*, drhp, loan*, banking, nps, epf, salary account, savings account, currency, currencies',
      1: 'investor*, yield*, options, rich, savings, budget*, tax*, price*, market*, bank*, gold, inr, yen',
    },
    hinglish: {
      3: 'nivesh*, share bazaar*, share bazar*',
      2: 'paisa, paise, pesa, bachat, byaj, karz, karza, kamai',
    },
    indic: {
      3: 'शेयर बाजार, शेयर मार्केट, स्टॉक मार्केट, निफ्टी, सेंसेक्स, एसआईपी, म्यूचुअल फंड, निवेश, आयकर, इनकम टैक्स, जीएसटी, आरबीआई, रिजर्व बैंक, रेपो रेट, ब्याज दर, महंगाई, अर्थव्यवस्था, सेबी, आईपीओ, डीमैट, एफडी, पीपीएफ, ट्रेडिंग, शेअर बाजार, गुंतवणूक, अर्थसंकल्प, શેરબજાર, શેર બજાર, રોકાણ, শেয়ার বাজার, বিনিয়োগ, সেনসেক্স, பங்குச் சந்தை, பங்குச்சந்தை, முதலீடு, மியூச்சுவல் ஃபண்ட், வருமான வரி, స్టాక్ మార్కెట్, షేర్ మార్కెట్, పెట్టుబడి, ಷೇರು ಮಾರುಕಟ್ಟೆ, ಹೂಡಿಕೆ, ഓഹരി, നിക്ഷേപ, ਸ਼ੇਅਰ ਬਾਜ਼ਾਰ',
      2: 'शेयर, शेअर, टैक्स, बजट, लोन, ईएमआई, ब्याज, बचत, पैसा, पैसे, रुपये, रुपया, कर्ज, पोर्टफोलियो, பங்கு',
      1: 'बाजार, बैंक, तेजी, मंदी, बजार',
    },
    domains: ['bloomberg.com', 'cnbc.com', 'marketwatch.com', 'finance.yahoo.com', 'seekingalpha.com', 'investopedia.com', 'tradingview.com', 'morningstar.com', 'koyfin.com', 'moneycontrol.com', 'ft.com:2', 'economictimes.indiatimes.com:2', 'livemint.com:2', 'business-standard.com:2', 'financialexpress.com:2', 'businesstoday.in:2', 'zeebiz.com:2', 'cnbctv18.com', 'zerodha.com', 'groww.in', 'upstox.com', 'valueresearchonline.com', 'tickertape.in', 'screener.in', 'smallcase.com', 'nseindia.com', 'bseindia.com', 'rbi.org.in', 'sebi.gov.in', 'npci.org.in', 'incometax.gov.in', 'cleartax.in', 'paisabazaar.com', 'etmoney.com', 'trendlyne.com', 'finshots.in'],
  },
  {
    id: 'crypto',
    name: 'Crypto & Web3',
    emoji: '🪙',
    color: '#F59E0B',
    description: 'Bitcoin, Ethereum, DeFi, tokens, blockchains, onchain culture and prediction markets.',
    terms: {
      3: 'bitcoin, btc, $btc, ethereum, $eth, crypto*, solana, $sol, defi, nft*, web3, blockchain*, on-chain, onchain, altcoin*, memecoin*, airdrop*, stablecoin*, usdc, usdt, tether, binance, coinbase, smart contract*, satoshi, halving, hodl, degen*, uniswap, metamask, staking, rollup*, mev, polymarket, layer 2, dao, wazirx, coindcx, coinswitch, mudrex, dogecoin, shiba inu',
      2: 'eth, dex, mining, ledger, l2, zk, polygon, wallet*, token*, base chain, vda',
      1: 'pump, chain, chains, protocol',
    },
    indic: {
      3: 'क्रिप्टो, बिटकॉइन, ब्लॉकचेन, एथेरियम, கிரிப்டோ, பிட்காயின், ക്രിപ്റ്റോ, ബിറ്റ്കോയിൻ',
    },
    domains: ['coinbase.com', 'binance.com', 'etherscan.io', 'solscan.io', 'coingecko.com', 'coinmarketcap.com', 'opensea.io', 'polymarket.com', 'dexscreener.com', 'pump.fun', 'basescan.org', 'coindesk.com', 'cointelegraph.com', 'theblock.co', 'decrypt.co', 'wazirx.com', 'coindcx.com', 'coinswitch.co', 'mudrex.com'],
  },
  {
    id: 'productivity',
    name: 'Productivity & Mindset',
    emoji: '⚡',
    color: '#14B8A6',
    description: 'Habits, focus, self-improvement, life advice, mental models and tools for thought.',
    terms: {
      3: 'productivity, productive, habit*, deep work, discipline, mindset, procrastinat*, time management, morning routine, journaling, self-improvement, self improvement, personal growth, life advice, life lessons, mental model*, stoic*, goal setting, second brain, note-taking, note taking, pomodoro, burnout, decision making, overthink*, gratitude, atomic habits, wisdom, digital detox, screen time',
      2: 'routine*, focus, motivation, goals, consistency, notion, obsidian, happiness, naval, principles, todo, to-do, distraction*, self-discipline',
      1: 'journal, meditat*, calendar, success, successful, life, advice, clarity, relationships, parenting, lessons',
    },
    hinglish: {
      3: 'aadat*, aadatein',
      2: 'mehnat, lakshya, safalta',
      1: 'zindagi',
    },
    indic: {
      3: 'उत्पादकता, आदत, आदतें, अनुशासन, समय प्रबंधन, आत्म-सुधार, सवय, शिस्त, பழக்க, ஒழுக்க, ശീല, అలవాటు',
      2: 'प्रेरणा, मोटिवेशन, लक्ष्य, फोकस, मेहनत, दिनचर्या, सातत्य, உழைப்பு',
      1: 'सफलता, जिंदगी, जीवन, कामयाबी',
    },
    domains: ['notion.so', 'obsidian.md', 'todoist.com', 'fs.blog', 'jamesclear.com', 'nav.al'],
  },
  {
    id: 'career',
    name: 'Career & Jobs',
    emoji: '💼',
    color: '#6366F1',
    description: 'Hiring, job hunting, interviews, salaries, placements, government jobs, career advice, management and remote work.',
    terms: {
      3: "we're hiring, we are hiring, job search, job hunt*, resume*, résumé, cover letter, salary, salaries, compensation, career*, internship*, recruiter*, recruiting, layoff*, laid off, remote work, remote job*, work from home, wfh, performance review, faang, offer letter, senior engineer, new grad, quit my job, workplace, coworker*, 9-5, 9 to 5, placement*, ctc, lpa, appraisal*, notice period, naukri, job offer*, off-campus, on-campus, fresher*, sarkari naukri, govt job*, government job*, recruitment, vacancy, vacancies, work-life balance, resign*, joining date, hr round, mnc*, yoe, got the offer, got an offer, interview*",
      2: 'hiring, job*, referral*, intern, linkedin, leadership, networking, mentor*, hike, increment, hr, in-hand, employees, employee, office',
      1: 'cv, promotion, manager*, management, big tech, negotiat*, junior, boss, corporate, team, tcs, infosys, wipro, cognizant, accenture',
    },
    hinglish: {
      3: 'naukri*, naukriyan',
      2: 'sarkari, chhutti',
    },
    indic: {
      3: 'नौकरी, नौकरियां, भर्ती, वैकेंसी, रिक्ति, सरकारी नौकरी, वेतन, सैलरी, तनख्वाह, तनखाह, इंटरव्यू, प्लेसमेंट, करियर, कैरियर, रोजगार, छंटनी, लेऑफ, अप्रेजल, रिज्यूमे, नोकरी, पगार, भरती, চাকরি, ਤਨਖਾਹ, சம்பள, நேர்காணல், வேலைவாய்ப்பு, பணிநீக்க, ఉద్యోగం, ఉద్యోగాలు, జీతం, ಸಂಬಳ, ಉದ್ಯೋಗಾವಕಾಶ, ಅಪ್ರೈಸಲ್, नोटिस पीरियड, ജോലി, ശമ്പള, പിരിച്ചുവിട',
      2: 'जॉब, एचआर, इंक्रीमेंट, नियुक्ति, कर्मचारी, बेरोजगारी, வேலை, ಉದ್ಯೋಗ',
      1: 'ऑफिस, बॉस, मैनेजर, पैकेज, कंपनी',
    },
    domains: ['linkedin.com', 'indeed.com', 'glassdoor.com', 'levels.fyi', 'wellfound.com', 'greenhouse.io', 'lever.co', 'workatastartup.com', 'ashbyhq.com', 'naukri.com', 'unstop.com', 'internshala.com', 'foundit.in', 'instahyre.com', 'ambitionbox.com', 'cutshort.io', 'apna.co', 'sarkariresult.com', 'freejobalert.com'],
  },
  {
    id: 'science',
    name: 'Science & Tech',
    emoji: '🔬',
    color: '#06B6D4',
    description: 'Research, physics, biology, space, climate, energy, hardware, robotics and emerging tech.',
    terms: {
      3: 'scientist*, scientific, study finds, new study, physics, quantum, biology, chemistry, neuroscience, genetic*, dna, crispr, nasa, spacex, starship, telescope, jwst, galaxy, astronom*, climate change, semiconductor*, tsmc, robotics, humanoid*, peer-review*, mathematic*, theorem, fusion energy, nuclear power, electric vehicle*, isro, chandrayaan*, gaganyaan, mangalyaan, aditya-l1, aditya l1, pslv, gslv, lvm3, spacecraft, astronaut*, lunar, moon mission, space mission*, launch vehicle, satellite*, black hole*, exoplanet*, relativity',
      2: 'researchers, science, rocket*, mars, universe, climate, nuclear, fusion, robot*, phd, math, equation*, battery, batteries, chips, energy, orbit*, drdo, iisc, space station, renewable*, biogas, bio-cng',
      1: 'research, study, brain, evolution, space, moon, carbon, solar, chip, drone*, ev, tesla, experiment*, journal, professor, paper, launch, mission',
    },
    indic: {
      3: 'इसरो, चंद्रयान, गगनयान, मंगलयान, आदित्य-l1, अंतरिक्ष, उपग्रह, वैज्ञानिक, विज्ञान, रॉकेट, नासा, जलवायु परिवर्तन, भौतिकी, रसायन, शास्त्रज्ञ, अंतराळ, মহাকাশ, இஸ்ரோ, சந்திரயான், விண்வெளி, செயற்கைக்கோள், விஞ்ஞானி, அறிவியல், ராக்கெட், ఇస్రో, ചന്ദ്രയാൻ, ബഹിരാകാശ, ഐഎസ്ആർഒ, ਪੁਲਾੜ',
      2: 'शोध, अनुसंधान, प्रक्षेपण, चंद्रमा, चांद, रिसर्च, ऊर्जा, ਊਰਜਾ',
      1: 'मिशन, सूर्य, सूरज, लॉन्च',
    },
    domains: ['nature.com', 'science.org', 'arxiv.org:1.5', 'nasa.gov', 'phys.org', 'quantamagazine.org', 'newscientist.com', 'sciencedaily.com', 'biorxiv.org', 'ncbi.nlm.nih.gov', 'pubmed.ncbi.nlm.nih.gov', 'spacex.com', 'scientificamerican.com', 'isro.gov.in', 'downtoearth.org.in'],
  },
  {
    id: 'health',
    name: 'Health & Fitness',
    emoji: '💪',
    color: '#EF4444',
    description: 'Fitness, training, yoga, nutrition, sleep, longevity, mental health and medical topics.',
    terms: {
      3: 'fitness, workout*, gym, strength training, lifting, muscle*, cardio, marathon, zone 2, vo2 max, nutrition, protein, calorie*, fasting, keto, supplement*, creatine, vitamin*, longevity, blood pressure, cholesterol, insulin, glucose, metabolic, mental health, breathwork, microbiome, testosterone, weight loss, fat loss, body fat, ozempic, glp-1, yoga, hydration, huberman, ayurved*, pranayam*, surya namaskar, diabetes, diabetic, thyroid, pcos, pcod, whey, home remed*, gut health, bmi, belly fat, push-ups, pushups, squats, deadlift*, bench press, dengue, malaria',
      2: 'health, healthy, exercise, sleep, diet*, carbs, anxiety, depression, meditation, cancer, dopamine, running, immunity, hospital*, aiims, detox, asana*, physio*',
      1: 'sugar, aging, therapy, stress, doctor*, disease*, heart, gut, steps, body, walk, walking',
    },
    hinglish: {
      3: 'sehat, vyayam, motapa',
      2: 'neend, wajan, vajan, beemari, bimari, dawai, nuskha, nuskhe, charbi',
    },
    indic: {
      3: 'स्वास्थ्य, सेहत, योगा, योगासन, योगाभ्यास, योग दिवस, व्यायाम, कसरत, जिम, डाइट, प्रोटीन, मोटापा, आयुर्वेद, प्राणायाम, डायबिटीज, मधुमेह, बीमार, कैंसर, मानसिक स्वास्थ्य, फिटनेस, कैलोरी, ब्लड प्रेशर, कोलेस्ट्रॉल, वर्कआउट, ਵਰਕਆਊਟ, ਜਿੰਮ, आरोग्य, கொலஸ்ட்ரால், പ്രമേഹ, ஆரோக்கிய, உடற்பயிற்சி, யோகா, நீரிழிவு, ஜிம், ഡയറ്റ്',
      2: 'वजन, नींद, डॉक्टर, अस्पताल, इलाज, दवा, पाचन, इम्युनिटी, शुगर, தூக்கம், மருத்துவ, உணவு முறை',
      1: 'हृदय, दिल, तनाव',
    },
    domains: ['examine.com', 'healthline.com', 'mayoclinic.org', 'hubermanlab.com', 'peterattiamd.com', 'practo.com', '1mg.com', 'pharmeasy.in', 'healthifyme.com', 'cult.fit', 'apollo247.com', 'netmeds.com', 'ayush.gov.in'],
  },
  {
    id: 'learning',
    name: 'Learning & Resources',
    emoji: '📚',
    color: '#A855F7',
    description: 'Books, courses, tutorials, guides, exam preparation (UPSC, JEE, NEET…), deep-dive threads and reference material.',
    terms: {
      3: 'reading list, must-read, must read, books, free course*, tutorial*, step-by-step, step by step, cheat sheet*, cheatsheet*, curriculum, syllabus, textbook*, lecture*, masterclass, ultimate guide, bookmark this, save this, worth reading, handbook, crash course, deep dive, explained, beginner*, roadmap*, playbook*, upsc, prelims, jee, jee main*, jee advanced, neet, neet ug, neet pg, cbse, icse, board exam*, ncert*, mock test*, pyq*, previous year paper*, aspirant*, current affairs, answer writing, nptel, swayam, unacademy, physicswallah, gate exam*, cat exam*, ssc cgl, mpsc, tnpsc, uppsc, bpsc, wbcs, gpsc, kpsc, appsc, tspsc, competitive exam*, entrance exam*, general knowledge, olympiad*, cat mock*, varc, dilr, gmat, gre, ielts, toefl, jlpt, anki, spaced repetition, language learning, booklist*',
      2: 'book, course*, guide, learn, learning, how to, resources, essay*, podcast*, workshop*, exam*, mains, coaching, revision, studying, students, student, ias, gk, cutoff*, cut-off*, topper*, lesson*, percentile, iim, iims, flashcard*, 📚',
      1: 'thread, 🧵, mba, read this, summary of, notes on, blog post, documentary, mit, stanford, harvard, university, study, framework, notes, college, school, teacher*',
    },
    hinglish: {
      3: 'padhai*, padhaai*, kitab*, pariksha',
      2: 'padhna, padho, padhte, taiyari, taiyaari, sahitya',
    },
    indic: {
      3: 'यूपीएससी, पढाई, पढ़ाई, परीक्ष, किताब, पुस्तक, कोर्स, सिलेबस, पाठ्यक्रम, नीट, जेईई, सीबीएसई, एनसीईआरटी, मॉक टेस्ट, प्रीलिम्स, प्रिलिम्स, करंट अफेयर्स, प्रतियोगी परीक्षा, स्पर्धा परीक्षा, एमपीएससी, यूपीपीएससी, बीपीएससी, शिक्षा, ट्यूटोरियल, পড়াশোনা, ਪ੍ਰੀਖਿਆ, ਪੜ੍ਹਾਈ, தேர்வு, புத்தக, பாடத்திட்ட, டிஎன்பிஎஸ்சி, யுபிஎஸ்சி, பரீட்சை, பாடம்',
      2: 'तैयारी, तयारी, कोचिंग, छात्र, विद्यार्थी, नोट्स, आईएएस, टॉपर, साहित्य, পরীক্ষা, படிப்பு, ಓದು',
      1: 'सीख, स्कूल, कॉलेज, यूनिवर्सिटी, शिक्षक, टीचर, अभ्यास',
    },
    domains: ['coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org', 'goodreads.com', 'wikipedia.org:1.5', 'en.wikipedia.org:1.5', 'youtube.com:1.5', 'youtu.be:1.5', 'medium.com:1.5', 'substack.com:1.5', 'nptel.ac.in', 'swayam.gov.in', 'byjus.com', 'unacademy.com', 'pw.live', 'vedantu.com', 'ncert.nic.in', 'cbse.gov.in', 'testbook.com', 'adda247.com', 'drishtiias.com', 'visionias.in', 'insightsonindia.com', 'careers360.com', 'shiksha.com'],
  },
  {
    id: 'tools',
    name: 'Tools & Apps',
    emoji: '🛠️',
    color: '#64748B',
    description: 'Useful apps, websites, extensions, templates, automations and new product launches.',
    terms: {
      3: 'chrome extension*, free tool*, useful tools, tools that, websites that, alternative to, open source alternative, just launched, now available, mac app, ios app, android app, raycast, arc browser, notion template*, figma plugin*, vs code extension*, productivity tools, tech stack, my stack, zapier, n8n, make.com, no-code, nocode, low-code, ai tools, tools',
      2: 'tool, apps, plugin*, template*, alternatives, introducing, workflow*, automation, automate, extension, play store, app store',
      1: 'app, website, launched, try it, link in, macos, macbook, iphone, setup, saas, free, beta, waitlist',
    },
    indic: {
      3: 'टूल, ऐप्स, एक्सटेंशन, செயலி',
      2: 'ऐप, एप, वेबसाइट, प्ले स्टोर, ആപ്പ്',
    },
    domains: ['producthunt.com', 'chromewebstore.google.com', 'chrome.google.com', 'apps.apple.com', 'play.google.com', 'raycast.com', 'alternativeto.net', 'gumroad.com', 'tally.so'],
  },
  {
    id: 'news',
    name: 'News & Politics',
    emoji: '📰',
    color: '#78716C',
    description: 'Current events, politics, elections, policy, law, geopolitics and world affairs.',
    terms: {
      3: 'breaking news, breaking, just in, reportedly, election*, voting, trump, biden, harris, congress, senate, senator*, parliament, prime minister, democrat*, republican*, gop, politic*, ukraine, russia, israel, gaza, iran, supreme court, legislation, protest*, immigration, white house, european union, nato, sanction*, scandal, geopolitic*, lok sabha, rajya sabha, vidhan sabha, pm modi, bjp, nda, india alliance, tmc, dmk, aiadmk, shiv sena, samajwadi, chief minister, election commission, evm*, assembly election*, manifesto, high court, ordinance, mla*, paper leak, cyclone*, earthquake, stampede, ceasefire, rahul gandhi, red alert, orange alert',
      2: 'vote*, president*, minister, government, policy, war, military, lawsuit*, regulation*, china, liberal*, conservative*, modi, govt, opposition, verdict, cabinet, ministry, governor, pakistan, army, flood*, riot*, accident, pib, heavy rain*, imd',
      1: 'reports, according to, court, law, ban, border, eu, investigation, police, killed, crisis, officials, scheme, yojana, bill, state, monsoon',
    },
    hinglish: {
      3: 'sarkar, sarkaar, chunav, mantri, rajneeti, rajniti, andolan, pradhan mantri',
      2: 'neta*, kanoon, adalat, dharna',
    },
    indic: {
      3: 'राजनीति, चुनाव, निर्वाचन, लोकसभा, राज्यसभा, विधानसभा, संसद, सरकार, प्रधानमंत्र, मुख्यमंत्र, मंत्री, भाजपा, कांग्रेस, विपक्ष, मतदान, वोट, सुप्रीम कोर्ट, हाईकोर्ट, हाई कोर्ट, उच्च न्यायालय, आंदोलन, हादसा, दुर्घटना, ब्रेकिंग, राष्ट्रपति, सांसद, विधायक, युद्ध, गठबंधन, निवडणूक, राजकारण, राजकीय, ચૂંટણી, ਸਿਆਸਤ, ਚੋਣ, தேர்தல், அரசியல், முதல்வர், பிரதமர், சட்டமன்ற, நாடாளுமன்ற, திமுக, அதிமுக, பாஜக, ఎన్నికల, ಸರ್ಕಾರ, തിരഞ്ഞെടുപ്പ്, സർക്കാർ',
      2: 'नेता, अदालत, कानून, पुलिस, बाढ, खबर, समाचार, घोटाला, सेना, पाकिस्तान, मंत्रालय, राज्यपाल, அரசு, கட்சி, ప్రభుత్వ',
      1: 'चीन, अमेरिका, पार्टी, नीति, योजना',
    },
    domains: ['nytimes.com', 'washingtonpost.com', 'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'cnn.com', 'theguardian.com', 'politico.com', 'axios.com', 'foxnews.com', 'aljazeera.com', 'npr.org', 'economist.com', 'pib.gov.in', 'ndtv.com:2', 'thehindu.com:2', 'indianexpress.com:2', 'hindustantimes.com:2', 'timesofindia.indiatimes.com:2', 'navbharattimes.indiatimes.com:2', 'indiatoday.in:2', 'news18.com:2', 'thewire.in:2', 'scroll.in:2', 'theprint.in:2', 'thequint.com:2', 'firstpost.com:2', 'zeenews.india.com:2', 'aajtak.in:2', 'abplive.com:2', 'bhaskar.com:2', 'jagran.com:2', 'amarujala.com:2', 'livehindustan.com:2', 'lokmat.com:2', 'loksatta.com:2', 'anandabazar.com:2', 'eisamay.com:2', 'divyabhaskar.co.in:2', 'gujaratsamachar.com:2', 'sandesh.com:2', 'jagbani.com:2', 'ptcnews.tv:2', 'dinamalar.com:2', 'dailythanthi.com:2', 'eenadu.net:2', 'sakshi.com:2', 'prajavani.net:2', 'vijaykarnataka.com:2', 'manoramaonline.com:2', 'mathrubhumi.com:2'],
  },
  {
    id: 'sports',
    name: 'Sports',
    emoji: '🏏',
    color: '#84CC16',
    description: 'Cricket, IPL, football, kabaddi, tennis, badminton, chess, F1, Olympics and other sports — matches, players and results.',
    terms: {
      3: 'sports, sport, cricket, cricketer*, ipl, bcci, icc, t20*, t20i, odi*, test match*, test cricket, wicket*, batsman, batsmen, batter*, bowler*, bowling, batting, innings, run chase, sixes, hat-trick, hattrick, maiden century, double century, scorecard, playing xi, playing 11, team india, men in blue, world cup, champions trophy, asia cup, ranji trophy, kabaddi, pro kabaddi, pkl, hockey, football*, soccer, fifa, uefa, premier league, champions league, la liga, isl, tennis, wimbledon, grand slam, badminton, chess, grandmaster*, fide, olympic*, paralympic*, asian games, commonwealth games, formula 1, formula one, f1, grand prix, motogp, nba, nfl, mlb, super bowl, ufc, boxing, wrestling, wrestler*, athletics, javelin, medal*, tournament*, championship*, semi-final*, semifinal*, quarterfinal*, quarter-final*, umpire*, goalkeeper, free kick, transfer window, midfield*, athlete*, olympian*, csk, rcb, srh, lsg, pbks, mumbai indians, chennai super kings, royal challengers, kolkata knight riders, sunrisers, rajasthan royals, delhi capitals, punjab kings, gujarat titans, lucknow super giants, mohun bagan, manchester united, man utd, man city, real madrid, kohli, rohit sharma, hardik pandya, dhoni, bumrah, 🏏, jadeja, tendulkar, dravid, rishabh pant, suryakumar, kl rahul, neeraj chopra, pv sindhu, gukesh, praggnanandhaa, carlsen, mandhana, harmanpreet, chhetri, messi, ronaldo, lebron, federer, nadal, djokovic, alcaraz, verstappen, espncricinfo, cricbuzz',
      2: 'match, matches, stadium, captain*, toss, overs, coach, striker, derby, kkr, east bengal, arsenal, liverpool, chelsea, barcelona, virat, hitman, msd, thala, sachin, ashwin, ⚽, 🏀, 🎾, 🏸, 🏑, ♟, siraj, shami, gambhir, dream11, trophy, league, marathon, sprinter*, playoffs, final',
      1: 'pitch, runs, player, players, team, goal, scored, penalty, win, won, beat, victory, series, 🏆, 🥇',
    },
    hinglish: {
      3: 'khiladi*, chhakka, chakka, chhakke, chakke, chauka, chauke, ballebaaz*, ballebaz*, gendbaaz*, gendbaz*, kushti, pehelwan*, pahalwan*',
      2: 'khel, jeet, jeeta, jeete',
    },
    indic: {
      3: 'क्रिकेट, आईपीएल, बीसीसीआई, मैच, खिलाड, टीम इंडिया, विकेट, बल्लेबाज, गेंदबाज, शतक, अर्धशतक, छक्क, चौका, चौके, चौकों, कप्तान, सेमीफाइनल, टूर्नामेंट, विश्व कप, वर्ल्ड कप, कबड्डी, हॉकी, फुटबॉल, बैडमिंटन, टेनिस, शतरंज, ओलंपिक, पदक, कुश्ती, पहलवान, एथलीट, कोहली, धोनी, बुमराह, ম্যাচ, ফুটবল, ক্রিকেট, મેચ, ਕਬੱਡੀ, ਹਾਕੀ, ਖੇਡ, கிரிக்கெட், ஐபிஎல், மேட்ச், விக்கெட், கேப்டன், கபடி, கால்பந்து, ஒலிம்பிக், தடகள, சிஎஸ்கே, தோனி, கோலி, உலகக் கோப்பை, சதம், ఆటగాడు, ఆటగాళ్ల, సెంచరీ, కెప్టెన్, ఫుట్‌బాల్, కోహ్ల, ಪಂದ್ಯ, ಆಟಗಾರ, ಆರ್‌ಸಿಬಿ, ക്രിക്കറ്റ്, ഫുട്ബോൾ, ഐപിഎൽ',
      2: 'खेल, ओवर, पारी, टॉस, फाइनल, स्टेडियम, चैंपियन, ट्रॉफी, खिताब, रोहित, சாம்பியன், போட்டி, வீரர், பந்து, அணி, జట్టు, ತಂಡ, മത്സര, കളി',
      1: 'गोल, जीत, मैदान, रन',
    },
    domains: ['espn.com', 'espn.in', 'espncricinfo.com', 'cricbuzz.com', 'iplt20.com', 'bcci.tv', 'icc-cricket.com', 'sportstar.thehindu.com', 'sports.ndtv.com', 'sportskeeda.com', 'thebridge.in', 'khelnow.com', 'prokabaddi.com', 'indiansuperleague.com', 'olympics.com', 'fifa.com', 'uefa.com', 'premierleague.com', 'formula1.com', 'nba.com', 'chess.com', 'lichess.org', 'fancode.com'],
  },
  {
    id: 'culture',
    name: 'Culture & Entertainment',
    emoji: '🎬',
    color: '#D946EF',
    description: 'Movies, OTT and TV, music, gaming, art, food, travel, festivals and internet culture.',
    terms: {
      3: 'movie*, cinema, netflix, hbo, disney, marvel, trailer, tv show*, anime, manga, album*, spotify, concert*, rapper, playlist, gaming, gamer*, video game*, nintendo, playstation, xbox, gta, minecraft, esports, bgmi, painting*, museum, photography, photographer*, fashion, recipe*, cooking, restaurant*, celebrity, oscar*, bollywood, tollywood, kollywood, mollywood, ott, web series, jiohotstar, hotstar, jiocinema, zee5, sonyliv, prime video, box office, blockbuster, biopic, filmfare, bigg boss, reality show*, street food, foodie, itinerary, shah rukh, shahrukh, srk, salman khan, rajinikanth, prabhas, allu arjun, thalapathy, arijit, ar rahman, a.r. rahman, fdfs, pandal hopping',
      2: 'film*, music, song*, game, games, travel, art, teaser, actor*, actress*, director, singer*, ghazal, qawwali, trek*, sitcom, standup, stand-up, pvr, inox, multiplex, pandal*, ranbir, new season, trip, 🎬, 🍿',
      1: 'series, episode*, artist*, steam, photo, food, culture, diwali, holi, durga puja, pongal, onam, navratri, ganesh chaturthi, lohri, baisakhi, bihu, eid, christmas, biryani, chai, hotel*, 🎶, 🎵',
    },
    hinglish: {
      3: 'gaana, gaane, gaano, picture dekhi',
      2: 'filmi, natak, serial, safar, ghumna, ghoomna, mithai, khana',
    },
    indic: {
      3: 'फिल्म, सिनेमा, सिनिम, बॉलीवुड, वेब सीरीज, ओटीटी, गाना, गाने, गानों, संगीत, अभिनेता, अभिनेत्री, ट्रेलर, बॉक्स ऑफिस, नेटफ्लिक्स, धारावाहिक, रेसिपी, मूवी, गेमिंग, चित्रपट, पर्यटन, ਫ਼ਿਲਮ, திரைப்பட, சினிமா, பாடல், நடிகர், நடிகை, டிரெய்லர், தியேட்டர், இயக்குநர், சமையல், ரஜினி, చిత్రం, పాటలు, ట్రైలర్, దర్శకుడు, థియేటర్, టాలీవుడ్, നടൻ, നടി, ഗാന',
      2: 'एक्टर, सीरियल, कलाकार, शायरी, घूमने, ट्रिप, প্যান্ডেল, व्यंजन, गान, चित्र, गायक, ছবি, ਗਾਇਕ, படம், இசை, பயண, ಸಿನಿಮಾ, ಹಾಡು',
      1: 'हीरो, यात्रा, सीजन, होटल, खाना, त्योहार, दिवाली, होली, गरबा, पुजो, பொங்கல்',
    },
    domains: ['imdb.com', 'letterboxd.com', 'spotify.com', 'open.spotify.com', 'twitch.tv', 'rottentomatoes.com', 'music.apple.com', 'soundcloud.com', 'netflix.com', 'primevideo.com', 'hotstar.com:2', 'jiohotstar.com:2', 'jiocinema.com:2', 'zee5.com:2', 'sonyliv.com:2', 'bollywoodhungama.com', 'filmcompanion.in', 'pinkvilla.com', 'koimoi.com', 'sacnilk.com', 'gaana.com', 'jiosaavn.com', 'wynk.in', 'bookmyshow.com'],
  },
  {
    id: 'humor',
    name: 'Humor & Memes',
    emoji: '😂',
    color: '#FB7185',
    description: 'Jokes, memes, shitposts and genuinely funny posts.',
    terms: {
      3: 'lmao, lmfao, rofl, meme*, shitpost*, hilarious, comedy, humor, humour, nobody:, me when, pov:, unhinged, cursed, touch grass, iykyk, "i\'m crying", im crying, sharma ji, sharmaji, relatable, indian parents, indian dad*, indian mom*',
      2: 'lol, 😂, 🤣, 💀, funny, joke*, haha*, roast*, me:, mummy:, relatives',
      1: 'bro, be like, based, ratio, no way, 😭, savage, mom:, papa:',
    },
    hinglish: {
      3: 'mazaak, mazak, majak, chutkula, chutkule',
      2: 'hasi, hassi, hansi',
    },
    indic: {
      3: 'मीम, चुटकुल, मजाक, कॉमेडी, हास्य, நகைச்சுவை, மீம், காமெடி, కామెడీ, തമാശ',
      2: 'हंसी, हंस, फनी, व्यंग्य, ठहाक, মজা',
    },
  },
  {
    id: FALLBACK_CATEGORY_ID,
    name: 'Other',
    emoji: '📦',
    color: '#A1A1AA',
    description: 'Anything that does not clearly fit another category.',
    terms: {},
  },
];

/** Parse a comma separated term list. Quoted terms may contain commas. */
export function splitTerms(list: string | undefined): string[] {
  if (!list) return [];
  const out: string[] = [];
  const re = /\s*"([^"]+)"\s*|([^,]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(list))) {
    const term = (m[1] ?? m[2] ?? '').trim().toLowerCase();
    if (term) out.push(term);
  }
  return out;
}

/** "ndtv.com:2" → ["ndtv.com", 2]; plain domains weigh 3. */
export function parseDomain(entry: string): [string, number] {
  const i = entry.lastIndexOf(':');
  if (i < 0) return [entry, 3];
  const w = Number(entry.slice(i + 1));
  return [entry.slice(0, i), Number.isFinite(w) ? w : 3];
}
