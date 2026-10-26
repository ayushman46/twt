import { ImageResponse } from "next/og";
import { BRAND, DEFAULT_CATEGORIES } from "@twtdash/shared";
import { OG_IMAGE_ALT, SITE_URL } from "./site";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_ALT = OG_IMAGE_ALT;

/* Same neutral system as the site (dark theme tokens in app/globals.css). */
const C = {
  bg: "#0C0C0D",
  panel: "#141416",
  line: "rgba(255,255,255,0.13)",
  fg: "#F2F2F0",
  fg2: "#CFCFCB",
  muted: "#8F8F8A",
  blue: "#3D5BD9",
} as const;

/** packages/shared/assets/logo.svg: flat blue squircle, white bookmark with a dash cut out. */
const LOGO_GLYPH =
  '<path transform="translate(-2 0)" d="M44 24h44a7 7 0 0 1 7 7v71.2a3.2 3.2 0 0 1-5 2.6L66 88 42 104.8a3.2 3.2 0 0 1-5-2.6V31a7 7 0 0 1 7-7z" fill="#fff"/><rect x="52" y="49" width="24" height="9" rx="4.5" fill="#3D5BD9"/>';

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#3D5BD9"/>${LOGO_GLYPH}</svg>`;

/** Full-bleed variant for the Apple touch icon (iOS applies its own corner mask). */
const LOGO_FULL_BLEED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="#3D5BD9"/>${LOGO_GLYPH}</svg>`;

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

const HEADLINE = ["Your X bookmarks,", "finally organized."];
const SUBTITLE = "Sync, sort and search everything you’ve saved on X, privately in your browser.";
const FOOTER = "Free forever · No account · Local-first";
const CHIP_IDS = ["ai", "dev", "design"];

type FontOptions = NonNullable<NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]>;

export async function renderOgImage(): Promise<ImageResponse> {
  const chips = CHIP_IDS.map((id) => DEFAULT_CATEGORIES.find((c) => c.id === id)).filter((c) => c !== undefined);
  const host = SITE_URL.replace(/^https?:\/\//, "");
  const text = `${BRAND.name}${HEADLINE.join("")}${SUBTITLE}${FOOTER}${host}${chips.map((c) => c.name).join("")}`;

  const [geistRegular, geistSemibold] = await Promise.all([
    loadGoogleFont("Geist", text, ":wght@400"),
    loadGoogleFont("Geist", text, ":wght@600"),
  ]);

  const fonts: FontOptions = [];
  if (geistRegular) fonts.push({ name: "Geist", data: geistRegular, weight: 400, style: "normal" });
  if (geistSemibold) fonts.push({ name: "Geist", data: geistSemibold, weight: 600, style: "normal" });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundColor: C.bg,
          color: C.fg,
          fontFamily: geistRegular ? "Geist" : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img> */}
            <img src={LOGO_DATA_URI} width={52} height={52} alt="" />
            <span style={{ fontSize: 38, fontWeight: 600, letterSpacing: -1.2, color: C.fg }}>{BRAND.name}</span>
          </div>
          <span
            style={{
              display: "flex",
              fontSize: 21,
              color: C.muted,
              padding: "8px 16px",
              borderRadius: 10,
              border: `1px solid ${C.line}`,
            }}
          >
            {host}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 92, fontWeight: 600, letterSpacing: -3.6, lineHeight: 1.02 }}>
            <span>{HEADLINE[0]}</span>
            <span>{HEADLINE[1]}</span>
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 30, lineHeight: 1.4, color: C.muted, maxWidth: 900 }}>{SUBTITLE}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 10 }}>
            {chips.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: `1px solid ${C.line}`,
                  backgroundColor: C.panel,
                  fontSize: 21,
                  color: C.fg2,
                }}
              >
                {c.name}
              </div>
            ))}
          </div>
          <span style={{ fontSize: 21, color: C.muted, whiteSpace: "nowrap" }}>{FOOTER}</span>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length > 0 ? fonts : undefined },
  );
}
