/**
 * Theme Manager Service
 * Manages light, dark, and auto theme preferences and syncs Shoelace themes.
 */

export type ThemePreference = "light" | "dark" | "auto";

const STORAGE_KEY = "eldamo_theme_pref";

export function getThemePreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "auto") {
    return stored;
  }
  return "auto";
}

export function setThemePreference(pref: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, pref);
  applyTheme(pref);
}

export function applyTheme(pref?: ThemePreference): void {
  const activePref = pref || getThemePreference();
  let effectiveTheme: "light" | "dark" = "dark";

  if (activePref === "auto") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    effectiveTheme = prefersDark ? "dark" : "light";
  } else {
    effectiveTheme = activePref;
  }

  const html = document.documentElement;
  html.setAttribute("data-theme", effectiveTheme);

  if (effectiveTheme === "light") {
    html.classList.remove("sl-theme-dark");
    html.classList.add("sl-theme-light");
  } else {
    html.classList.remove("sl-theme-light");
    html.classList.add("sl-theme-dark");
  }
}

if (typeof window !== "undefined" && window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getThemePreference() === "auto") {
      applyTheme("auto");
    }
  });
}
