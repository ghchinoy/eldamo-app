/**
 * Glaemscribe Transliteration Service
 * Wrapper around the Glaemscribe JavaScript engine, modes, and charsets.
 */

export interface ModeInfo {
  id: string;
  name: string;
  language: string;
}

export interface CharsetInfo {
  id: string;
  name: string;
}

export const MODES: ModeInfo[] = [
  { id: "quenya-tengwar-classical", name: "Quenya Classical Mode", language: "q" },
  { id: "sindarin-tengwar-general_use", name: "Sindarin General Use Mode", language: "s" },
  { id: "sindarin-tengwar-beleriand", name: "Sindarin Mode of Beleriand", language: "s" },
  { id: "adunaic-tengwar-glaemscrafu", name: "Adûnaic Mode", language: "ad" },
  { id: "westron-tengwar-glaemscrafu", name: "Westron Mode", language: "westron" },
  { id: "blackspeech-tengwar-general_use", name: "Black Speech Mode", language: "bs" },
  { id: "english-tengwar-espeak", name: "English Mode", language: "en" },
];

export const CHARSETS: CharsetInfo[] = [
  { id: "tengwar_guni_annatar", name: "Tengwar Annatar" },
  { id: "tengwar_guni_eldamar", name: "Tengwar Eldamar" },
  { id: "tengwar_guni_parmaite", name: "Tengwar Parmaite" },
  { id: "tengwar_guni_sindarin", name: "Tengwar Sindarin" },
];

let isInitialized = false;
let initPromise: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

export async function ensureGlaemscribe(): Promise<void> {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. Load core engine
      await loadScript("/glaemscribe/glaemscribe.min.js");

      // 2. Load mode scripts
      const modeFiles = [
        "quenya-tengwar-classical.glaem.js",
        "sindarin-tengwar-general_use.glaem.js",
        "sindarin-tengwar-beleriand.glaem.js",
        "adunaic-tengwar-glaemscrafu.glaem.js",
        "westron-tengwar-glaemscrafu.glaem.js",
        "blackspeech-tengwar-general_use.glaem.js",
        "english-tengwar-espeak.glaem.js",
      ];
      for (const file of modeFiles) {
        await loadScript(`/glaemscribe/modes/${file}`);
      }

      // 3. Load charset scripts
      const charsetFiles = [
        "tengwar_guni_annatar.cst.js",
        "tengwar_guni_eldamar.cst.js",
        "tengwar_guni_parmaite.cst.js",
        "tengwar_guni_sindarin.cst.js",
      ];
      for (const file of charsetFiles) {
        await loadScript(`/glaemscribe/charsets/${file}`);
      }

      // 4. Initialize resource manager
      const g = (window as any).Glaemscribe;
      if (g && g.resource_manager) {
        g.resource_manager.load_modes();
        g.resource_manager.load_charsets();
      }

      isInitialized = true;
    } catch (e) {
      console.error("Failed to initialize Glaemscribe engine:", e);
      throw e;
    }
  })();

  return initPromise;
}

export function mapLanguageToMode(langCode?: string): string {
  if (!langCode) return "quenya-tengwar-classical";
  const code = langCode.toLowerCase().trim();
  if (code === "q" || code === "quenya" || code === "pq" || code === "eq") {
    return "quenya-tengwar-classical";
  }
  if (code === "s" || code === "sindarin" || code === "n" || code === "noldorin" || code === "os" || code === "es") {
    return "sindarin-tengwar-general_use";
  }
  if (code === "ad" || code === "adunaic") {
    return "adunaic-tengwar-glaemscrafu";
  }
  if (code === "westron" || code === "w") {
    return "westron-tengwar-glaemscrafu";
  }
  if (code === "bs" || code === "blackspeech") {
    return "blackspeech-tengwar-general_use";
  }
  if (code === "en" || code === "english") {
    return "english-tengwar-espeak";
  }
  return "quenya-tengwar-classical";
}

export async function transcribe(
  text: string,
  modeId?: string,
  charsetId: string = "tengwar_guni_annatar"
): Promise<string> {
  if (!text || !text.trim()) return "";
  await ensureGlaemscribe();

  const g = (window as any).Glaemscribe;
  if (!g || !g.resource_manager) {
    return "";
  }

  const effectiveMode = modeId || "quenya-tengwar-classical";
  const mode = g.resource_manager.loaded_modes[effectiveMode] || g.resource_manager.loaded_modes["quenya-tengwar-classical"];
  const charset = g.resource_manager.loaded_charsets[charsetId] || g.resource_manager.loaded_charsets["tengwar_guni_annatar"];

  if (!mode || !charset) {
    return "";
  }

  try {
    const result = mode.transcribe(text, charset);
    if (Array.isArray(result) && result[1]) {
      return (result[1] as string).trim();
    }
  } catch (err) {
    console.warn(`Glaemscribe transcription error for '${text}':`, err);
  }

  return "";
}
