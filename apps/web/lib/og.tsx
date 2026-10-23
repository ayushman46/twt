import { ImageResponse } from "next/og";
import { BRAND, DEFAULT_CATEGORIES } from "@twtdash/shared";
import { OG_IMAGE_ALT, SITE_URL } from "./site";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_ALT = OG_IMAGE_ALT;

/** Brand gradient (matches --gradient-brand in globals.css). */
export const BRAND_GRADIENT = "linear-gradient(135deg, #7B61FF 0%, #B14CF2 55%, #FF5C9D 100%)";

const LOGO_DEFS =
  '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7B61FF"/><stop offset=".55" stop-color="#B14CF2"/><stop offset="1" stop-color="#FF5C9D"/></linearGradient><linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><linearGradient id="mk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6D4BFF"/><stop offset="1" stop-color="#E0479A"/></linearGradient></defs>';

const LOGO_GLYPH =
  '<rect x="31" y="27" width="56" height="74" rx="10" fill="#fff" fill-opacity=".28" transform="rotate(-10 59 64)"/><path d="M44 24h44a7 7 0 0 1 7 7v71.2a3.2 3.2 0 0 1-5 2.6L66 88 42 104.8a3.2 3.2 0 0 1-5-2.6V31a7 7 0 0 1 7-7z" fill="#fff"/><path d="M53 41.5Q66 51.5 79 41.5Q69 54.5 79 67.5Q66 57.5 53 67.5Q63 54.5 53 41.5Z" fill="url(#mk)"/>';

/** packages/shared/assets/logo.svg (rounded squircle). */
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${LOGO_DEFS}<rect width="128" height="128" rx="30" fill="url(#bg)"/><rect width="128" height="64" rx="30" fill="url(#gl)"/>${LOGO_GLYPH}</svg>`;

/** Full-bleed variant for the Apple touch icon (iOS applies its own corner mask). */
const LOGO_FULL_BLEED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${LOGO_DEFS}<rect width="128" height="128" fill="url(#bg)"/><rect width="128" height="64" fill="url(#gl)"/>${LOGO_GLYPH}</svg>`;

const toDataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

export const LOGO_DATA_URI = toDataUri(LOGO_SVG);
export const LOGO_FULL_BLEED_DATA_URI = toDataUri(LOGO_FULL_BLEED_SVG);

/**
 * Fetch a Google Font subset as TTF for Satori. Returns null (falling back to
 * the default font) if the network is unavailable at build time.
 */
async function loadGoogleFont(family: string, text: string, axis = ""): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family}${axis}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url, { signal: AbortSignal.timeout(5000) })).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!src) return null;
    const res = await fetch(src, { signal: AbortSignal.timeout(5000) });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

const HEADLINE = "Your X bookmarks,";
const ACCENT = "finally organized.";
const SUBTITLE = "Sync, auto-categorize and search everything you’ve saved on X — privately, in your browser.";
const FOOTER = "Free forever · No account · Local-first";
const CHIP_IDS = ["ai", "dev", "design"];
const WORD_A = "twt";
const WORD_B = "dash";

type FontOptions = NonNullable<NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]>;

export async function renderOgImage(): Promise<ImageResponse> {
  const chips = CHIP_IDS.map((id) => DEFAULT_CATEGORIES.find((c) => c.id === id)).filter((c) => c !== undefined);
  const host = SITE_URL.replace(/^https?:\/\//, "");
  const sansText = `${BRAND.name}${WORD_A}${WORD_B}${HEADLINE}${SUBTITLE}${FOOTER}${host}${chips.map((c) => c.name).join("")}`;

  const [geistRegular, geistSemibold, serifItalic] = await Promise.all([
    loadGoogleFont("Geist", sansText, ":wght@400"),
    loadGoogleFont("Geist", sansText, ":wght@600"),
    loadGoogleFont("Instrument+Serif", ACCENT, ":ital@1"),
  ]);

  const fonts: FontOptions = [];
  if (geistRegular) fonts.push({ name: "Geist", data: geistRegular, weight: 400, style: "normal" });
  if (geistSemibold) fonts.push({ name: "Geist", data: geistSemibold, weight: 600, style: "normal" });
  if (serifItalic) fonts.push({ name: "Instrument Serif", data: serifItalic, weight: 400, style: "italic" });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 72px",
          backgroundColor: "#08080C",
          backgroundImage: [
            "radial-gradient(ellipse 60% 70% at 12% -5%, rgba(123,97,255,0.42), transparent 70%)",
            "radial-gradient(ellipse 50% 60% at 62% 0%, rgba(177,76,242,0.22), transparent 70%)",
            "radial-gradient(ellipse 55% 70% at 105% 105%, rgba(255,92,157,0.30), transparent 70%)",
          ].join(", "),
          color: "#FAFAFA",
          fontFamily: geistRegular ? "Geist" : undefined,
        }}
      >
        {/* top hairline */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            backgroundImage: "linear-gradient(90deg, transparent, rgba(123,97,255,0.8) 25%, rgba(255,92,157,0.8) 75%, transparent)",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img> */}
            <img src={LOGO_DATA_URI} width={64} height={64} alt="" />
            <div style={{ display: "flex", fontSize: 42, fontWeight: 600, letterSpacing: -1.8 }}>
              <span style={{ color: "#FAFAFA" }}>{WORD_A}</span>
              <span style={{ backgroundImage: BRAND_GRADIENT, backgroundClip: "text", color: "transparent", paddingRight: 2 }}>
                {WORD_B}
              </span>
            </div>
          </div>
          <span
            style={{
              display: "flex",
              fontSize: 21,
              color: "#A1A1AA",
              padding: "8px 18px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.10)",
              backgroundColor: "rgba(255,255,255,0.04)",
            }}
          >
            {host}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.02 }}>
            <span style={{ fontSize: 88, fontWeight: 600, letterSpacing: -4 }}>{HEADLINE}</span>
            <span
              style={{
                fontSize: 108,
                fontFamily: serifItalic ? "Instrument Serif" : undefined,
                fontStyle: serifItalic ? "italic" : "normal",
                fontWeight: 400,
                letterSpacing: -1.5,
                backgroundImage: BRAND_GRADIENT,
                backgroundClip: "text",
                color: "transparent",
                paddingRight: 12,
              }}
            >
              {ACCENT}
            </span>
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 28, lineHeight: 1.4, color: "#A1A1AA", maxWidth: 900 }}>
            {SUBTITLE}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {chips.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 18px",
                  borderRadius: 999,
                  border: `1px solid ${c.color}66`,
                  backgroundColor: `${c.color}22`,
                  fontSize: 21,
                  color: "#E4E4E7",
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: c.color }} />
                {c.name}
              </div>
            ))}
          </div>
          <span style={{ fontSize: 21, color: "#A1A1AA", whiteSpace: "nowrap" }}>{FOOTER}</span>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length > 0 ? fonts : undefined },
  );
}
