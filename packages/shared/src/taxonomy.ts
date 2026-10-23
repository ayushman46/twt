/**
 * Built-in category taxonomy.
 *
 * `terms` are comma-separated phrases grouped by weight (3 = strong signal,
 * 1 = weak hint). A trailing `*` makes a term a prefix match ("fundrais*"
 * matches "fundraising"). Matching is case-insensitive and respects word
 * boundaries, so "ai" does not match "said".
 *
 * `domains` boost a category when a post links to that site.
 */
export interface CategoryDefinition {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  terms: Partial<Record<1 | 2 | 3, string>>;
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
      3: 'llm, llms, chatgpt, openai, anthropic, claude, gemini, mistral, llama, deepseek, qwen, machine learning, deep learning, neural net*, fine-tun*, finetun*, rlhf, diffusion model*, stable diffusion, midjourney, hugging face, huggingface, ai agent*, agentic, prompt engineering, embeddings, vector database*, multimodal, pretraining, pre-training, artificial intelligence, genai, generative ai, langchain, llamaindex, ollama, agi, superintelligence, mcp server*, model context protocol, pytorch, tensorflow, reinforcement learning, computer vision, context window, reasoning model*, chain of thought, hallucinat*, ai safety, vibe cod*, open weights, open-weight*, gpt-*, gpt*, claude code, cursor ai, copilot, sora, perplexity, grok, transformer model*, inference',
      2: 'ai, ml, nlp, rag, xai, nvidia, gpu*, cuda, jax, evals, benchmark*, alignment, prompt*, agents, tokens, parameters, transformers, deepmind, ai-powered, ai tools',
      1: 'model, models, weights, training, dataset*, automation',
    },
    domains: ['openai.com', 'anthropic.com', 'claude.ai', 'chatgpt.com', 'huggingface.co', 'deepmind.google', 'ai.google.dev', 'mistral.ai', 'perplexity.ai', 'replicate.com', 'together.ai', 'x.ai', 'paperswithcode.com', 'ollama.com'],
  },
  {
    id: 'dev',
    name: 'Programming',
    emoji: '💻',
    color: '#3B82F6',
    description: 'Software engineering, code, languages, frameworks, devtools, infrastructure and open source.',
    terms: {
      3: 'javascript, typescript, python, rust, rustlang, golang, kotlin, c++, react, reactjs, next.js, nextjs, vue, vuejs, svelte, angular, node.js, nodejs, deno, npm, github, gitlab, docker, kubernetes, k8s, devops, serverless, postgres*, mysql, sqlite, mongodb, redis, backend, frontend, full-stack, fullstack, web dev*, webdev, software engineer*, software development, programming, programmer*, coding, codebase, repository, pull request, compiler*, data structure*, leetcode, system design, microservice*, graphql, rest api, vscode, vs code, neovim, linux, shell script*, regex, tailwind*, wasm, webassembly, refactor*, unit test*, ci/cd, supabase, firebase, stack overflow, stackoverflow, open source, open-source, swe, sql, api, apis, sdk, cli',
      2: 'git, java, swift, bun, aws, database*, developer*, devs, repo, algorithm*, terminal, bash, vim, css, html, debug*, deploy*, vercel, cloudflare, runtime, engineers, engineering, code',
      1: 'bug*, commit*, ide, framework*, library, syntax, latency, scalab*, cursor, stack',
    },
    domains: ['github.com', 'gitlab.com', 'stackoverflow.com', 'dev.to', 'npmjs.com', 'vercel.com', 'developer.mozilla.org', 'docs.python.org', 'crates.io', 'pypi.org', 'hashnode.dev', 'go.dev', 'nextjs.org', 'react.dev'],
  },
  {
    id: 'design',
    name: 'Design & UI',
    emoji: '🎨',
    color: '#EC4899',
    description: 'Product, UI and UX design, typography, visual inspiration, motion, illustration and branding.',
    terms: {
      3: 'figma, ui design, ux design, ui/ux, ux, user interface, user experience, typography, typeface, color palette, colour palette, illustration*, icon set, branding, brand identity, visual identity, design system*, dribbble, behance, framer, webflow, motion design, micro-interaction*, microinteraction*, mockup*, wireframe*, whitespace, designer*, three.js, threejs, webgl, kerning, spline, lottie, moodboard, landing page design',
      2: 'ui, font*, gradient*, icons, logo*, animation*, aesthetic*, design, designs, landing page*, svg, shader*, blender, inspiration, layout*, interface',
      1: 'prototype*, portfolio, css, 3d, poster*, grid, pixel*, dark mode, component*, visual*, beautiful',
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
      3: 'startup*, founder*, co-founder*, cofounder*, y combinator, ycombinator, yc, fundrais*, venture capital, seed round, pre-seed, series a, series b, saas, b2b, b2c, mrr, arr, product-market fit, pmf, indie hacker*, indiehacker*, indie maker*, solopreneur*, build in public, buildinpublic, product hunt, producthunt, unit economics, go-to-market, pitch deck, term sheet, cap table, entrepreneur*, paul graham, monetiz*, bootstrapp*, churn',
      2: 'vc, vcs, investors, valuation, revenue, acquisition, acquired, ceo, business, customers, pricing, moat, equity, side project*, side hustle*, mvp, stripe, gtm, profitab*',
      1: 'profit*, launch*, exit, company, companies, competitor*, scale, users, ship, shipped, market',
    },
    domains: ['ycombinator.com', 'producthunt.com', 'indiehackers.com', 'techcrunch.com', 'paulgraham.com', 'a16z.com', 'crunchbase.com', 'stratechery.com', 'lennysnewsletter.com'],
  },
  {
    id: 'marketing',
    name: 'Marketing & Growth',
    emoji: '📣',
    color: '#EAB308',
    description: 'Growth, distribution, SEO, copywriting, content creation, audience building and sales.',
    terms: {
      3: 'marketing, marketer*, growth hack*, seo, copywriting, copywriter*, virality, go viral, content creator*, content creation, creator economy, advertising, paid ads, facebook ads, google ads, meta ads, funnel*, conversion rate*, cold email*, lead gen*, personal brand*, storytelling, ugc, influencer*, affiliate*, email list, open rate*, positioning',
      2: 'newsletter*, audience, followers, engagement, viral, headline*, ads, cta, distribution, outreach, sales, impressions, hooks, brand',
      1: 'hook, conversion, landing page, leads, tiktok, algorithm, growth, retention, messaging, content',
    },
    domains: ['beehiiv.com', 'convertkit.com', 'kit.com', 'hubspot.com', 'semrush.com', 'ahrefs.com', 'mailchimp.com'],
  },
  {
    id: 'finance',
    name: 'Finance & Investing',
    emoji: '📈',
    color: '#22C55E',
    description: 'Markets, stocks, investing, personal finance, economics and macro.',
    terms: {
      3: 'stock market, investing, s&p 500, s&p, nasdaq, dow jones, earnings, inflation, recession, interest rate*, the fed, federal reserve, fomc, dividend*, etf*, index fund*, compound interest, net worth, personal finance, hedge fund*, private equity, real estate, mortgage*, gdp, economy, economist*, bull market, bear market, warren buffett, berkshire, balance sheet, cash flow, 401k, roth ira, financial freedom, $tsla, $aapl, $nvda, $spy, $qqq, $msft, $amzn, $meta, $goog',
      2: 'stock*, invest*, treasury, bonds, wealth, money, trading, trader*, economic*, macro, tariff*, retire*, portfolio, valuation',
      1: 'investor*, yield*, options, rich, savings, budget*, tax*, price*, market*',
    },
    domains: ['bloomberg.com', 'cnbc.com', 'marketwatch.com', 'finance.yahoo.com', 'seekingalpha.com', 'investopedia.com', 'tradingview.com', 'morningstar.com', 'koyfin.com'],
  },
  {
    id: 'crypto',
    name: 'Crypto & Web3',
    emoji: '🪙',
    color: '#F59E0B',
    description: 'Bitcoin, Ethereum, DeFi, tokens, blockchains, onchain culture and prediction markets.',
    terms: {
      3: 'bitcoin, btc, $btc, ethereum, $eth, crypto*, solana, $sol, defi, nft*, web3, blockchain*, on-chain, onchain, altcoin*, memecoin*, airdrop*, stablecoin*, usdc, usdt, tether, binance, coinbase, smart contract*, satoshi, halving, hodl, degen*, uniswap, metamask, staking, rollup*, mev, polymarket, layer 2, dao',
      2: 'eth, dex, mining, ledger, l2, zk, polygon, wallet*, token*, base chain',
      1: 'pump, chain, chains, protocol',
    },
    domains: ['coinbase.com', 'binance.com', 'etherscan.io', 'solscan.io', 'coingecko.com', 'coinmarketcap.com', 'opensea.io', 'polymarket.com', 'dexscreener.com', 'pump.fun', 'basescan.org'],
  },
  {
    id: 'productivity',
    name: 'Productivity & Mindset',
    emoji: '⚡',
    color: '#14B8A6',
    description: 'Habits, focus, self-improvement, life advice, mental models and tools for thought.',
    terms: {
      3: 'productivity, productive, habit*, deep work, discipline, mindset, procrastinat*, time management, morning routine, journaling, self-improvement, self improvement, personal growth, life advice, life lessons, mental model*, stoic*, goal setting, second brain, note-taking, note taking, pomodoro, burnout, decision making, overthink*, gratitude, atomic habits, wisdom',
      2: 'routine*, focus, motivation, lessons, goals, consistency, notion, obsidian, happiness, naval, principles, todo, to-do',
      1: 'journal, meditat*, calendar, success, successful, life, advice, clarity, relationships, parenting',
    },
    domains: ['notion.so', 'obsidian.md', 'todoist.com', 'fs.blog', 'jamesclear.com', 'nav.al'],
  },
  {
    id: 'career',
    name: 'Career & Jobs',
    emoji: '💼',
    color: '#6366F1',
    description: 'Hiring, job hunting, interviews, salaries, career advice, management and remote work.',
    terms: {
      3: "we're hiring, we are hiring, job search, job hunt*, resume*, résumé, cover letter, salary, salaries, compensation, career*, internship*, recruiter*, recruiting, layoff*, laid off, remote work, remote job*, work from home, wfh, performance review, faang, offer letter, senior engineer, new grad, quit my job, workplace, coworker*, 9-5, 9 to 5",
      2: 'hiring, job*, interview*, intern, linkedin, leadership, networking, mentor*',
      1: 'cv, promotion, manager*, management, big tech, negotiat*, junior, boss, corporate, team',
    },
    domains: ['linkedin.com', 'indeed.com', 'glassdoor.com', 'levels.fyi', 'wellfound.com', 'greenhouse.io', 'lever.co', 'workatastartup.com', 'ashbyhq.com'],
  },
  {
    id: 'science',
    name: 'Science & Tech',
    emoji: '🔬',
    color: '#06B6D4',
    description: 'Research, physics, biology, space, climate, energy, hardware, robotics and emerging tech.',
    terms: {
      3: 'scientist*, scientific, study finds, new study, physics, quantum, biology, chemistry, neuroscience, genetic*, dna, crispr, nasa, spacex, starship, telescope, jwst, galaxy, astronom*, climate change, semiconductor*, tsmc, robotics, humanoid*, peer-review*, mathematic*, theorem, fusion energy, nuclear power, electric vehicle*',
      2: 'researchers, science, rocket*, mars, universe, climate, nuclear, fusion, robot*, phd, math, equation*, battery, batteries, chips, energy',
      1: 'research, study, brain, evolution, space, moon, carbon, solar, chip, drone*, ev, tesla, experiment*, journal, professor, paper',
    },
    domains: ['nature.com', 'science.org', 'arxiv.org', 'nasa.gov', 'phys.org', 'quantamagazine.org', 'newscientist.com', 'sciencedaily.com', 'biorxiv.org', 'ncbi.nlm.nih.gov', 'pubmed.ncbi.nlm.nih.gov', 'spacex.com', 'scientificamerican.com'],
  },
  {
    id: 'health',
    name: 'Health & Fitness',
    emoji: '💪',
    color: '#EF4444',
    description: 'Fitness, training, nutrition, sleep, longevity and mental health.',
    terms: {
      3: 'fitness, workout*, gym, strength training, lifting, muscle*, cardio, marathon, zone 2, vo2 max, nutrition, protein, calories, fasting, keto, supplement*, creatine, vitamin*, longevity, blood pressure, cholesterol, insulin, glucose, metabolic, mental health, breathwork, microbiome, testosterone, weight loss, fat loss, body fat, ozempic, glp-1, yoga, hydration, huberman',
      2: 'health, healthy, exercise, sleep, diet*, carbs, anxiety, depression, meditation, cancer, dopamine, running',
      1: 'sugar, aging, therapy, stress, doctor*, disease*, heart, gut, steps, body',
    },
    domains: ['examine.com', 'healthline.com', 'mayoclinic.org', 'hubermanlab.com', 'peterattiamd.com'],
  },
  {
    id: 'learning',
    name: 'Learning & Resources',
    emoji: '📚',
    color: '#A855F7',
    description: 'Books, courses, tutorials, guides, deep-dive threads, reading lists and reference material.',
    terms: {
      3: 'reading list, must-read, must read, books, free course*, tutorial*, step-by-step, step by step, cheat sheet*, cheatsheet*, curriculum, syllabus, textbook*, lecture*, masterclass, ultimate guide, bookmark this, save this, worth reading, handbook, crash course, deep dive, explained, beginner*, roadmap*, playbook*',
      2: 'book*, course*, guide, learn, learning, how to, resources, essay*, podcast*, thread, 🧵, workshop*',
      1: 'lesson*, read this, summary of, notes on, blog post, documentary, mit, stanford, harvard, university, study, framework',
    },
    domains: ['coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org', 'goodreads.com', 'wikipedia.org', 'en.wikipedia.org', 'youtube.com', 'youtu.be', 'medium.com', 'substack.com'],
  },
  {
    id: 'tools',
    name: 'Tools & Apps',
    emoji: '🛠️',
    color: '#64748B',
    description: 'Useful apps, websites, extensions, templates, automations and new product launches.',
    terms: {
      3: 'chrome extension*, free tool*, useful tools, tools that, websites that, alternative to, open source alternative, just launched, now available, mac app, ios app, android app, raycast, arc browser, notion template*, figma plugin*, vs code extension*, productivity tools, tech stack, my stack, zapier, n8n, make.com, no-code, nocode, low-code, ai tools, tools',
      2: 'tool, apps, plugin*, template*, alternatives, introducing, workflow*, automation, automate, extension',
      1: 'app, website, launched, try it, link in, macos, iphone, setup, saas, free, beta, waitlist',
    },
    domains: ['producthunt.com', 'chromewebstore.google.com', 'chrome.google.com', 'apps.apple.com', 'play.google.com', 'raycast.com', 'alternativeto.net', 'gumroad.com', 'tally.so'],
  },
  {
    id: 'news',
    name: 'News & Politics',
    emoji: '📰',
    color: '#78716C',
    description: 'Current events, politics, policy, law, geopolitics and world affairs.',
    terms: {
      3: 'breaking news, breaking, just in, reportedly, election*, voting, trump, biden, harris, congress, senate, senator*, parliament, prime minister, democrat*, republican*, gop, politic*, ukraine, russia, israel, gaza, iran, supreme court, legislation, protest*, immigration, white house, european union, nato, sanction*, scandal, geopolitic*',
      2: 'vote*, president*, minister, government, policy, war, military, lawsuit*, regulation*, china, liberal*, conservative*',
      1: 'reports, according to, court, law, ban, border, eu, investigation, police, killed, crisis, officials',
    },
    domains: ['nytimes.com', 'washingtonpost.com', 'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'cnn.com', 'theguardian.com', 'politico.com', 'axios.com', 'foxnews.com', 'aljazeera.com', 'npr.org', 'economist.com'],
  },
  {
    id: 'culture',
    name: 'Culture & Entertainment',
    emoji: '🎬',
    color: '#D946EF',
    description: 'Movies, TV, music, gaming, sports, art, food, travel and internet culture.',
    terms: {
      3: 'movie*, cinema, netflix, hbo, disney, marvel, trailer, tv show*, anime, manga, album*, spotify, concert*, rapper, playlist, gaming, gamer*, video game*, nintendo, playstation, xbox, gta, minecraft, esports, nba, nfl, soccer, premier league, champions league, world cup, messi, ronaldo, lebron, formula 1, f1, cricket, tennis, olympics, sports, painting*, museum, photography, photographer*, fashion, recipe*, cooking, restaurant*, celebrity, oscar*',
      2: 'film*, music, song*, game, games, football, travel, art',
      1: 'series, episode*, artist*, steam, photo, food, culture',
    },
    domains: ['imdb.com', 'letterboxd.com', 'spotify.com', 'open.spotify.com', 'twitch.tv', 'rottentomatoes.com', 'espn.com', 'music.apple.com', 'soundcloud.com'],
  },
  {
    id: 'humor',
    name: 'Humor & Memes',
    emoji: '😂',
    color: '#FB7185',
    description: 'Jokes, memes, shitposts and genuinely funny posts.',
    terms: {
      3: 'lmao, lmfao, rofl, meme*, shitpost*, hilarious, comedy, humor, humour, nobody:, me when, pov:, unhinged, cursed, touch grass, iykyk, "i\'m crying", im crying',
      2: 'lol, 😂, 🤣, 💀, funny, joke*',
      1: 'bro, be like, based, ratio, no way',
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
  const re = /"([^"]+)"|([^,]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(list))) {
    const term = (m[1] ?? m[2] ?? '').trim().toLowerCase();
    if (term) out.push(term);
  }
  return out;
}
