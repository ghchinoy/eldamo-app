import { WordEntry } from "./components/result-card";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
export const isWails = () =>
  typeof window !== "undefined" &&
  Boolean((window as any).go?.app?.App || (window as any).go?.main?.App);

export interface Category {
  id: string;
  group_id: string;
  group_label: string;
  num: string;
  label: string;
  word_count: number;
}

export interface CategoryGroup {
  group_id: string;
  group_label: string;
  categories: Category[];
}

export interface SourceMeta {
  source: string;
  word_count: number;
}

export interface BrowseResult {
  entries: WordEntry[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface NotificationEvent {
  level: "info" | "warning" | "error";
  message: string;
  timestamp: string;
}

export function onAppNotification(callback: (event: NotificationEvent) => void): () => void {
  const win = window as any;
  if (win.runtime?.EventsOn) {
    win.runtime.EventsOn("app_notification", callback);
    return () => win.runtime?.EventsOff("app_notification", callback);
  }
  return () => {};
}

export interface ProgressEvent {
  stage: string;
  status_text: string;
  percent: number;
  completed: boolean;
  error?: string;
}

export interface DBInfo {
  exists: boolean;
  path: string;
  word_count: number;
  language_count: number;
  embedding_model: string;
  size_bytes: number;
  dataset_version?: string;
  dataset_sha256?: string;
  built_at?: string;
}

export function onDBProgress(callback: (event: ProgressEvent) => void): () => void {
  const win = window as any;
  if (win.runtime?.EventsOn) {
    win.runtime.EventsOn("db_progress", callback);
    return () => win.runtime?.EventsOff("db_progress", callback);
  }
  return () => {};
}

export function onOpenAbout(callback: () => void): () => void {
  const win = window as any;
  if (win.runtime?.EventsOn) {
    win.runtime.EventsOn("menu_open_about", callback);
    return () => win.runtime?.EventsOff("menu_open_about", callback);
  }
  return () => {};
}

export function onOpenConfig(callback: () => void): () => void {
  const win = window as any;
  if (win.runtime?.EventsOn) {
    win.runtime.EventsOn("menu_open_config", callback);
    return () => win.runtime?.EventsOff("menu_open_config", callback);
  }
  return () => {};
}

export async function invokeApi<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const win = window as any;
  const app = win.go?.app?.App || win.go?.main?.App;

  if (app) {
    if (cmd === "get_db_info") {
      return (await app.GetDBInfo()) as T;
    }
    if (cmd === "start_download_db") {
      return (await app.StartDownloadDB(args?.url ?? null)) as T;
    }
    if (cmd === "start_build_local_db") {
      return (await app.StartBuildLocalDB(args?.generate_vectors ?? false)) as T;
    }
    if (cmd === "search_fts") {
      return (await app.SearchFTS(args?.query, args?.lang ?? null, args?.speech ?? null, args?.limit ?? null)) as T;
    }
    if (cmd === "search_vector_query") {
      return (await app.SearchVectorQuery(args?.query, args?.limit ?? null)) as T;
    }
    if (cmd === "search_vector") {
      return (await app.SearchVector(args?.query_vector, args?.limit ?? null)) as T;
    }
    if (cmd === "browse_words") {
      return (await app.BrowseWords(args?.letter ?? null, args?.lang ?? null, args?.page ?? null, args?.page_size ?? null)) as T;
    }
    if (cmd === "get_entry") {
      const pid = Number(args?.page_id ?? args?.pageId);
      return (await app.GetEntry(pid)) as T;
    }
    if (cmd === "get_category_tree") {
      return (await app.GetCategoryTree()) as T;
    }
    if (cmd === "browse_by_category") {
      return (await app.BrowseByCategory(args?.cat_id ?? args?.catId, args?.page ?? null, args?.page_size ?? args?.pageSize ?? null)) as T;
    }
    if (cmd === "get_sources_list") {
      return (await app.GetSourcesList()) as T;
    }
    if (cmd === "get_concordance") {
      return (await app.GetConcordance(args?.root, args?.page ?? null, args?.page_size ?? args?.pageSize ?? null)) as T;
    }
    if (cmd === "get_attestations_by_source") {
      return (await app.GetAttestationsBySource(args?.source, args?.page ?? null, args?.page_size ?? args?.pageSize ?? null)) as T;
    }
    if (cmd === "get_languages") {
      return (await app.GetLanguages()) as T;
    }
    if (cmd === "set_api_key") {
      return (await app.SetAPIKey(args?.key)) as T;
    }
    if (cmd === "get_api_key") {
      return (await app.GetAPIKey()) as T;
    }
    if (cmd === "set_gemini_model") {
      return (await app.SetGeminiModel(args?.model)) as T;
    }
    if (cmd === "get_gemini_model") {
      return (await app.GetGeminiModel()) as T;
    }
    if (cmd === "get_app_version") {
      return (await app.GetAppVersion()) as T;
    }
    if (cmd === "ask_assistant") {
      return (await app.AskAssistant(args?.prompt)) as T;
    }
  }

  console.warn(`[Web Dev Mode] IPC not active. Using mock fallback for '${cmd}'.`);
  return getMockResponse<T>(cmd, args);
}

export function saveApiKey(key: string): void {
  const trimmed = key.trim();
  try {
    localStorage.setItem("eldamo_gemini_key", trimmed);
  } catch (e) {
    console.error("Failed to save API key to localStorage:", e);
  }
  if (isTauri || isWails()) {
    invokeApi("set_api_key", { key: trimmed }).catch((err) => console.error("Error saving API key in IPC:", err));
  }
}

export async function loadApiKey(): Promise<string> {
  let key = "";
  if (isTauri || isWails()) {
    try {
      const savedKey = await invokeApi<string | null>("get_api_key");
      if (savedKey) key = savedKey;
    } catch (e) {
      console.warn("Could not read API key from IPC storage:", e);
    }
  }
  if (!key) {
    try {
      key = localStorage.getItem("eldamo_gemini_key") || "";
    } catch (e) {
      // ignore
    }
  }
  return key;
}

export function saveGeminiModel(model: string): void {
  const trimmed = model.trim();
  try {
    localStorage.setItem("eldamo_gemini_model", trimmed);
  } catch (e) {
    console.error("Failed to save Gemini model to localStorage:", e);
  }
  if (isTauri || isWails()) {
    invokeApi("set_gemini_model", { model: trimmed }).catch((err) => console.error("Error saving Gemini model in IPC:", err));
  }
}

export async function loadGeminiModel(): Promise<string> {
  let model = "";
  if (isTauri || isWails()) {
    try {
      const savedModel = await invokeApi<string | null>("get_gemini_model");
      if (savedModel) model = savedModel;
    } catch (e) {
      console.warn("Could not read Gemini model from IPC storage:", e);
    }
  }
  if (!model) {
    try {
      model = localStorage.getItem("eldamo_gemini_model") || "";
    } catch (e) {
      // ignore
    }
  }
  return model || "gemini-3.5-flash-lite";
}

function getMockResponse<T>(cmd: string, _args?: Record<string, unknown>): T {
  if (cmd === "get_category_tree") {
    return [
      {
        group_id: "PW",
        group_label: "Physical World",
        categories: [
          { id: "PW_ST", group_id: "PW", group_label: "Physical World", num: "1.1", label: "Star", word_count: 42 },
          { id: "PW_LT", group_id: "PW", group_label: "Physical World", num: "1.2", label: "Light", word_count: 58 },
        ],
      },
    ] as unknown as T;
  }
  if (cmd === "browse_by_category") {
    return {
      entries: [
        {
          page_id: 1825557517,
          v: "elen",
          l: "q",
          speech: "n",
          gloss: "star",
          cat: "PW_ST",
          mark: "",
          stem: "elen-",
          from_v: "EL",
          tengwar: "",
          orthography: "elen",
          notes_clean: "Quenya word for star.",
          notes_raw: "",
        },
      ],
      total_count: 1,
      page: 1,
      page_size: 50,
    } as unknown as T;
  }
  if (cmd === "get_db_info") {
    return {
      exists: true,
      path: "dist/eldamo.db",
      word_count: 35900,
      language_count: 48,
      embedding_model: "gemini-embedding-2",
      size_bytes: 157286400,
      dataset_version: "0.8.13",
      dataset_sha256: "4e561d4dfc15919d300adcb3ef8cb93298cb0b6fe0291f8fd1bef93abeea7979",
      built_at: "2026-07-22T15:13:45Z",
    } as unknown as T;
  }
  if (cmd === "get_app_version") {
    return "0.1.4" as unknown as T;
  }
  if (cmd === "get_gemini_model") {
    return "gemini-3.5-flash-lite" as unknown as T;
  }
  if (cmd === "get_languages") {
    return [
      { id: "q", name: "Quenya" },
      { id: "s", name: "Sindarin" },
      { id: "p", name: "Primitive Elvish" },
      { id: "ad", name: "Adûnaic" },
      { id: "n", name: "Noldorin" },
    ] as unknown as T;
  }
  if (cmd === "browse_words") {
    return {
      entries: [
        {
          page_id: 1825557517,
          v: "aew",
          l: "s",
          speech: "n",
          gloss: "small bird",
          cat: "",
          mark: "",
          stem: "",
          from_v: "",
          tengwar: "",
          orthography: "",
          notes_clean: "Sindarin word for small bird.",
          notes_raw: "",
        },
        {
          page_id: 2800476029,
          v: "alda",
          l: "q",
          speech: "n",
          gloss: "tree",
          cat: "",
          mark: "",
          stem: "ald-",
          from_v: "",
          tengwar: "",
          orthography: "",
          notes_clean: "Quenya word for tree.",
          notes_raw: "",
        },
      ],
      total_count: 2,
      page: 1,
      page_size: 50,
    } as unknown as T;
  }
  if (cmd === "search_fts" || cmd === "search_vector") {
    return [
      {
        entry: {
          page_id: 1825557517,
          v: "elen",
          l: "q",
          speech: "n",
          gloss: "star",
          cat: "PW_ST",
          mark: "",
          stem: "elen-",
          from_v: "EL",
          tengwar: "",
          orthography: "elen",
          notes_clean: "Quenya word for star derived from root EL.",
          notes_raw: "<p>Quenya word for star derived from root EL.</p>",
        },
        score: 1.0,
      },
      {
        entry: {
          page_id: 2800476029,
          v: "calë",
          l: "q",
          speech: "n",
          gloss: "light",
          cat: "PW_LT",
          mark: "",
          stem: "cal-",
          from_v: "KAL",
          tengwar: "",
          orthography: "calë",
          notes_clean: "Quenya word for light or brightness.",
          notes_raw: "<p>Quenya word for light or brightness.</p>",
        },
        score: 0.85,
      },
    ] as unknown as T;
  }
  if (cmd === "get_entry") {
    return {
      entry: {
        page_id: 1825557517,
        v: "elen",
        l: "q",
        speech: "n",
        gloss: "star",
        cat: "PW_ST",
        mark: "",
        stem: "elen-",
        from_v: "EL",
        tengwar: "",
        orthography: "elen",
        notes_clean: "Quenya word for star derived from root EL.",
        notes_raw: "<p>Quenya word for star derived from root EL.</p>",
      },
      refs: [{ source: "PE17/067", v: "elen", gloss: "star" }],
      derivations: [{ source_v: "EL", source_lang: "p", ref_source: "PE17/067" }],
      cognates: [{ cognate_v: "êl", cognate_lang: "s", ref_source: "PE17/067" }],
      children: [],
    } as unknown as T;
  }
  return [] as unknown as T;
}
