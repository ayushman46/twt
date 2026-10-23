export const BRAND = {
  name: 'twtdash',
  tagline: 'Your X bookmarks, finally organized.',
  description:
    'twtdash syncs every post you have bookmarked on X, sorts it into smart categories automatically, and gives you a fast, beautiful library to search, tag and rediscover it — stored privately in your browser.',
  website: 'https://twtdash.app',
  supportEmail: 'support@twtdash.app',
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
} as const;
