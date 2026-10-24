import type { Locale } from './codes';

export interface LanguageInfo {
  code: Locale;
  /** Name in English. */
  name: string;
  /** Name in the language itself (shown in the picker). */
  native: string;
  /** Machine-assisted translation that still needs native-speaker review. */
  beta: boolean;
  dir: 'ltr' | 'rtl';
}

/** Order: English and Hindi first, then by number of speakers in India. */
export const LANGUAGES: readonly LanguageInfo[] = [
  { code: 'en', name: 'English', native: 'English', beta: false, dir: 'ltr' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', beta: false, dir: 'ltr' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', beta: true, dir: 'ltr' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', beta: true, dir: 'ltr' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', beta: true, dir: 'ltr' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', beta: true, dir: 'ltr' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', beta: true, dir: 'ltr' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', beta: true, dir: 'ltr' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', beta: true, dir: 'ltr' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', beta: true, dir: 'ltr' },
];
