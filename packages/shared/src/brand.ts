export const BRAND = {
  name: 'twtdash',
  tagline: 'Your X bookmarks, finally organized.',
  description:
    'twtdash syncs every post you have bookmarked on X, sorts it into smart categories automatically, and gives you a fast, beautiful library to search, tag and rediscover it — stored privately in your browser.',
  /** Free Vercel subdomain — swap in a custom domain if you ever buy one. */
  website: 'https://twtdash.vercel.app',
  /** Free support channel: GitHub Issues on the public repo. */
  supportUrl: 'https://github.com/ayushman46/twt/issues',
  supportLabel: 'GitHub Issues',
  repoUrl: 'https://github.com/ayushman46/twt',
  colors: {
    accent: '#8B6DFF',
    gradient: ['#7B61FF', '#B14CF2', '#FF5C9D'],
    ink: '#08080C',
    paper: '#F6F6F9',
  },
} as const;

export const PRICING = {
  currency: 'USD',
  pro: { monthly: 5, yearly: 48 },
  /** Pro in Indian rupees, shown to visitors from India. */
  inr: { monthly: 99, yearly: 799 },
} as const;
