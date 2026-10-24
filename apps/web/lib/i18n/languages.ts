/** Languages the twtdash extension UI ships in, written in their own scripts (English + Hindi stable, the rest beta). */
export const UI_LANGUAGES = [
  { code: "en", native: "English", beta: false },
  { code: "hi", native: "हिन्दी", beta: false },
  { code: "bn", native: "বাংলা", beta: true },
  { code: "mr", native: "मराठी", beta: true },
  { code: "te", native: "తెలుగు", beta: true },
  { code: "ta", native: "தமிழ்", beta: true },
  { code: "gu", native: "ગુજરાતી", beta: true },
  { code: "kn", native: "ಕನ್ನಡ", beta: true },
  { code: "ml", native: "മലയാളം", beta: true },
  { code: "pa", native: "ਪੰਜਾਬੀ", beta: true },
] as const;
