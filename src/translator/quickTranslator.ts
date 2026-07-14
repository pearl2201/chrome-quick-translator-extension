import {
    TranslatorEngine,
    FileSystemConfig,
    DictionaryConfigurationHelper,
} from 'quick-translator-engine';

/**
 * Browser-compatible file system adapter for the QuickTranslator engine.
 * Pre-fetches all dictionary files into an in-memory cache so sync reads work.
 */
class ExtensionFileSystem {
    private cache = new Map<string, string>();
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    /** Pre-fetch a file and store in cache. */
    async preload(path: string): Promise<void> {
        if (this.cache.has(path)) return;
        const url = `${this.baseUrl}/${path.replace(/\\/g, '/')}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load: ${url}`);
        this.cache.set(path, await res.text());
    }

    /** Pre-fetch all dictionary files listed in Dictionaries.config. */
    async preloadAll(): Promise<void> {
        // Try Dictionaries.config first, fall back to Dictionaries.ini
        let configText: string;
        const configUrl = `${this.baseUrl}/Dictionaries.config`;
        const iniUrl = `${this.baseUrl}/Dictionaries.ini`;
        const configRes = await fetch(configUrl);
        if (configRes.ok) {
            configText = await configRes.text();
        } else {
            const iniRes = await fetch(iniUrl);
            if (!iniRes.ok) throw new Error(`Missing Dictionaries.config or Dictionaries.ini`);
            configText = await iniRes.text();
        }
        this.cache.set('Dictionaries.config', configText);

        // Parse all file paths from config — skip non-file values (numbers, booleans, theme names)
        const files: string[] = [];
        for (const line of configText.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eq = trimmed.indexOf('=');
            if (eq > 0) {
                const val = trimmed.slice(eq + 1).trim();
                // Only preload values that look like file paths (contain . or / or \)
                if (val && /[\.\\\/]/.test(val)) files.push(val);
            }
        }
        console.log(`[ExtensionFileSystem] Preloading ${files.length} dictionary files:`, files);
        const results = await Promise.allSettled(files.map((f) => this.preload(f)));
        const failed = results.filter((r) => r.status === 'rejected');
        if (failed.length > 0) {
            console.warn(`[ExtensionFileSystem] ${failed.length} file(s) failed to load:`, failed.map((r: any) => r.reason?.message));
        }
    }

    // ── Path helpers ──

    join(...paths: string[]): string {
        return paths.map((p) => p.replace(/\\/g, '/').replace(/\/+$/, '')).join('/');
    }

    dirname(path: string): string {
        const parts = path.replace(/\\/g, '/').split('/');
        parts.pop();
        return parts.join('/') || '.';
    }

    basename(path: string, ext?: string): string {
        const base = path.replace(/\\/g, '/').split('/').pop() || '';
        return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
    }

    extname(path: string): string {
        const base = path.replace(/\\/g, '/').split('/').pop() || '';
        const i = base.lastIndexOf('.');
        return i > 0 ? base.slice(i) : '';
    }

    isAbsolute(_path: string): boolean {
        return false;
    }

    // ── Sync I/O (reads from preloaded cache) ──

    /** Extract the last path segment (filename) to match against cached keys. */
    private cacheKey(path: string): string {
        const normalized = path.replace(/\\/g, '/');
        const basename = normalized.split('/').pop() || normalized;
        // Also try stripping baseUrl prefix
        const withoutBase = normalized.replace(this.baseUrl.replace(/\\/g, '/') + '/', '');
        const key = this.cache.has(basename) ? basename
            : this.cache.has(withoutBase) ? withoutBase
                : path;
        return key;
    }

    readFileSync(path: string, _encoding?: string): string {
        const key = this.cacheKey(path);
        const cached = this.cache.get(key);
        if (cached !== undefined) return cached;
        throw new Error(`File not preloaded: ${path} (tried key: ${key})`);
    }

    existsSync(path: string): boolean {
        return this.cache.has(this.cacheKey(path));
    }

    statSync(_path: string): { size: number } {
        return { size: 0 };
    }

    // ── Stubs ──

    writeFileSync(_path: string, _data: string, _encoding?: string): void { }
    appendFileSync(_path: string, _data: string, _encoding?: string): void { }
    copyFileSync(_src: string, _dest: string): void { }
    unlinkSync(_path: string): void { }
    openSync(_path: string, _flags: string): number { return 0; }
    readSync(_fd: number, _buffer: Uint8Array, _offset: number, _length: number, _position: number): number { return 0; }
    closeSync(_fd: number): void { }
}

let engineInitialized = false;

/**
 * Initialize the QuickTranslator engine with dictionaries from the extension.
 * Call this once before translating.
 */
export async function initQuickTranslator(): Promise<void> {
    if (engineInitialized) return;

    const dictBaseUrl = chrome.runtime.getURL('dictionaries');
    const fs = new ExtensionFileSystem(dictBaseUrl);

    // Preload all dictionary files into cache
    await fs.preloadAll();

    // Set our browser file system and config
    FileSystemConfig.setInstance(fs as any);
    DictionaryConfigurationHelper.setDirectoryPath(dictBaseUrl);

    await TranslatorEngine.LoadDictionaries();

    // Merge user-saved entries from chrome.storage.local into the NamePhu dictionary
    // (must await — callback fires after engineInitialized otherwise)
    await new Promise<void>((resolve) => {
        chrome.storage.local.get('userDictionaryEntries', (res: { userDictionaryEntries?: Record<string, string> }) => {
            const entries = res.userDictionaryEntries;
            if (entries) {
                for (const [key, value] of Object.entries(entries)) {
                    try {
                        console.log(`Load name: ${key}: ${value}`)
                        TranslatorEngine.UpdateNameDictionary(key, value, false, false);
                    } catch {
                        // skip entries that fail to insert
                    }
                }
            }
            resolve();
        });
    });

    engineInitialized = true;
}

/**
 * Translate Chinese text to Vietnamese using the QuickTranslator engine.
 * Make sure to call initQuickTranslator() first.
 */
export function translateToVietnamese(
    text: string,
    wrapType = 0,
    algorithm = 0,
    prioritizedName = true,
): string {
    const standardized = TranslatorEngine.StandardizeInput(text);
    const vp = TranslatorEngine.ChineseToVietPhraseOneMeaning(
        standardized,
        wrapType,
        algorithm,
        prioritizedName,
    );
    return vp.result;
}
