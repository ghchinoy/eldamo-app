export namespace app {
	
	export class AssistantResponse {
	    answer: string;
	    citations: db.WordEntry[];
	
	    static createFrom(source: any = {}) {
	        return new AssistantResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.answer = source["answer"];
	        this.citations = this.convertValues(source["citations"], db.WordEntry);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace db {
	
	export class WordEntry {
	    page_id: number;
	    v: string;
	    l: string;
	    speech: string;
	    gloss: string;
	    cat: string;
	    mark: string;
	    stem: string;
	    from_v: string;
	    tengwar: string;
	    orthography: string;
	    parent_page_id?: number;
	    notes_clean: string;
	    notes_raw: string;
	
	    static createFrom(source: any = {}) {
	        return new WordEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.page_id = source["page_id"];
	        this.v = source["v"];
	        this.l = source["l"];
	        this.speech = source["speech"];
	        this.gloss = source["gloss"];
	        this.cat = source["cat"];
	        this.mark = source["mark"];
	        this.stem = source["stem"];
	        this.from_v = source["from_v"];
	        this.tengwar = source["tengwar"];
	        this.orthography = source["orthography"];
	        this.parent_page_id = source["parent_page_id"];
	        this.notes_clean = source["notes_clean"];
	        this.notes_raw = source["notes_raw"];
	    }
	}
	export class BrowseResult {
	    entries: WordEntry[];
	    total_count: number;
	    page: number;
	    page_size: number;
	
	    static createFrom(source: any = {}) {
	        return new BrowseResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.entries = this.convertValues(source["entries"], WordEntry);
	        this.total_count = source["total_count"];
	        this.page = source["page"];
	        this.page_size = source["page_size"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Category {
	    id: string;
	    group_id: string;
	    group_label: string;
	    num: string;
	    label: string;
	    word_count: number;
	
	    static createFrom(source: any = {}) {
	        return new Category(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.group_id = source["group_id"];
	        this.group_label = source["group_label"];
	        this.num = source["num"];
	        this.label = source["label"];
	        this.word_count = source["word_count"];
	    }
	}
	export class CategoryGroup {
	    group_id: string;
	    group_label: string;
	    categories: Category[];
	
	    static createFrom(source: any = {}) {
	        return new CategoryGroup(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.group_id = source["group_id"];
	        this.group_label = source["group_label"];
	        this.categories = this.convertValues(source["categories"], Category);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DBInfo {
	    exists: boolean;
	    path: string;
	    word_count: number;
	    language_count: number;
	    embedding_model: string;
	    size_bytes: number;
	
	    static createFrom(source: any = {}) {
	        return new DBInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.exists = source["exists"];
	        this.path = source["path"];
	        this.word_count = source["word_count"];
	        this.language_count = source["language_count"];
	        this.embedding_model = source["embedding_model"];
	        this.size_bytes = source["size_bytes"];
	    }
	}
	export class WordCognate {
	    cognate_v: string;
	    cognate_lang?: string;
	    ref_source?: string;
	    resolved_page_id?: number;
	
	    static createFrom(source: any = {}) {
	        return new WordCognate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cognate_v = source["cognate_v"];
	        this.cognate_lang = source["cognate_lang"];
	        this.ref_source = source["ref_source"];
	        this.resolved_page_id = source["resolved_page_id"];
	    }
	}
	export class WordDerivation {
	    source_v: string;
	    source_lang?: string;
	    ref_source?: string;
	    resolved_page_id?: number;
	
	    static createFrom(source: any = {}) {
	        return new WordDerivation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.source_v = source["source_v"];
	        this.source_lang = source["source_lang"];
	        this.ref_source = source["ref_source"];
	        this.resolved_page_id = source["resolved_page_id"];
	    }
	}
	export class WordRef {
	    source: string;
	    v: string;
	    gloss: string;
	
	    static createFrom(source: any = {}) {
	        return new WordRef(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.source = source["source"];
	        this.v = source["v"];
	        this.gloss = source["gloss"];
	    }
	}
	export class FullEntryDetail {
	    entry: WordEntry;
	    refs: WordRef[];
	    derivations: WordDerivation[];
	    cognates: WordCognate[];
	    children: WordEntry[];
	
	    static createFrom(source: any = {}) {
	        return new FullEntryDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.entry = this.convertValues(source["entry"], WordEntry);
	        this.refs = this.convertValues(source["refs"], WordRef);
	        this.derivations = this.convertValues(source["derivations"], WordDerivation);
	        this.cognates = this.convertValues(source["cognates"], WordCognate);
	        this.children = this.convertValues(source["children"], WordEntry);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class LanguageMeta {
	    id: string;
	    name: string;
	    era: string;
	    display_order: number;
	
	    static createFrom(source: any = {}) {
	        return new LanguageMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.era = source["era"];
	        this.display_order = source["display_order"];
	    }
	}
	export class SearchResult {
	    entry: WordEntry;
	    score: number;
	
	    static createFrom(source: any = {}) {
	        return new SearchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.entry = this.convertValues(source["entry"], WordEntry);
	        this.score = source["score"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SourceMeta {
	    source: string;
	    word_count: number;
	
	    static createFrom(source: any = {}) {
	        return new SourceMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.source = source["source"];
	        this.word_count = source["word_count"];
	    }
	}
	
	
	

}

