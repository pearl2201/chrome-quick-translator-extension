import {
  TranslatorEngine,
  FileSystemConfig,
  DictionaryConfigurationHelper,
} from 'quick-translator-engine';

/**
 * Browser-compatible file system adapter for the QuickTranslator engine.
 * Fetches dictionary files bundled in the extension's public/dictionaries/ folder.
 */
class ExtensionFileSystem {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  readFileSync(_path: string): string {
    throw new Error('Sync read not supported in browser');
  }

  readFile(_path: string, _encoding?: string): Promise<string> {
    const url = `${this.baseUrl}/${_path.replace(/\\/g, '/')}`;
    return fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Failed to load dictionary: ${url}`);
      return r.text();
    });
  }

  existsSync(_path: string): boolean {
    return false;
  }

  exists(_path: string): Promise<boolean> {
    const url = `${this.baseUrl}/${_path.replace(/\\/g, '/')}`;
    return fetch(url, { method: 'HEAD' }).then((r) => r.ok);
  }

  writeFileSync(_path: string, _data: string): void {
    // Not needed for translation
  }

  writeFile(_path: string, _data: string): Promise<void> {
    return Promise.resolve();
  }

  mkdirSync(_path: string): void {}
  mkdir(_path: string): Promise<void> {
    return Promise.resolve();
  }

  unlinkSync(_path: string): void {}
  unlink(_path: string): Promise<void> {
    return Promise.resolve();
  }

  readdirSync(_path: string): string[] {
    return [];
  }

  readdir(_path: string): Promise<string[]> {
    return Promise.resolve([]);
  }

  statSync(_path: string): { isFile(): boolean; isDirectory(): boolean } {
    return { isFile: () => true, isDirectory: () => false };
  }

  stat(_path: string): Promise<{ isFile(): boolean; isDirectory(): boolean }> {
    return Promise.resolve({ isFile: () => true, isDirectory: () => false });
  }
}

let engineInitialized = false;

/**
 * Initialize the QuickTranslator engine with dictionaries from the extension.
 * Call this once before translating.
 */
export async function initQuickTranslator(): Promise<void> {
  if (engineInitialized) return;

  const dictBaseUrl = chrome.runtime.getURL('dictionaries');

  // Set our browser file system
  FileSystemConfig.setInstance(new ExtensionFileSystem(dictBaseUrl) as any);
  DictionaryConfigurationHelper.setDirectoryPath(dictBaseUrl);

  await TranslatorEngine.LoadDictionaries();
  engineInitialized = true;
}

/**
 * Translate Chinese text to Vietnamese using the QuickTranslator engine.
 * Make sure to call initQuickTranslator() first.
 */
export function translateToVietnamese(
  text: string,
  wrapType = 1,
  algorithm = 0,
  prioritizedName = true,
): string {
  const standardized = TranslatorEngine.StandardizeInput(text);
  const hv = TranslatorEngine.ChineseToHanViet(standardized);
  const vp = TranslatorEngine.ChineseToVietPhrase(
    standardized,
    wrapType,
    algorithm,
    prioritizedName,
  );
  return [
    `=== Hán-Việt ===\n${hv.result}`,
    ``,
    `=== Việt Phrase ===\n${vp.result}`,
  ].join('\n');
}
