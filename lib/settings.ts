// Shared between server (layout) and client (settings UI).

export type Theme = "dark" | "light";
export interface Settings {
  theme: Theme;
  accent: string;
  developer: boolean; // show the raw message console per client
  itemSort: ItemSort; // order of items inside each section
}

export type ItemSort = "default" | "amount" | "name";

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  accent: "#00ff83",
  developer: false,
  itemSort: "name",
};
export const SETTINGS_KEY = "alchemy.connect.settings";
export const HEX = /^#[0-9a-f]{6}$/i;

/** black or white text, whichever reads better on the accent */
export function onAccent(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.4 ? "#000000" : "#ffffff";
}

/** Mix two hex colors: t=0 -> a, t=1 -> b. */
function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) =>
    Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

/** Text/knob color on an accent fill (light mode): a deep shade of the accent, or a pale tint on dark accents. */
export function onAccentShade(hex: string) {
  return onAccent(hex) === "#000000" ? mix(hex, "#000000", 0.75) : mix(hex, "#ffffff", 0.88);
}

/** Inline <head> script so the saved theme applies before first paint (no flash). */
export const settingsBootScript = `try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  SETTINGS_KEY,
)})||"{}"),d=document.documentElement;if(s.theme==="light"||s.theme==="dark")d.dataset.theme=s.theme;if(/^#[0-9a-f]{6}$/i.test(s.accent||"")){d.style.setProperty("--accent",s.accent);d.style.setProperty("--on-accent-auto",s.onAccent||"#111111")}}catch(e){}`;
