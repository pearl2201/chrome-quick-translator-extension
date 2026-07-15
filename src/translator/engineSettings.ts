export interface EngineSettings {
  defaultEngine: string;
  geminiApiKey: string;
  thinkingLevel: string;
}

const DEFAULTS: EngineSettings = {
  defaultEngine: 'quick-translator-ts',
  geminiApiKey: '',
  thinkingLevel: 'LOW',
};

/** Read saved engine settings from chrome.storage.local. */
export function getEngineSettings(): Promise<EngineSettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ['defaultEngine', 'geminiApiKey', 'thinkingLevel'],
      (res: { defaultEngine?: string; geminiApiKey?: string; thinkingLevel?: string }) => {
        resolve({
          defaultEngine: res.defaultEngine || DEFAULTS.defaultEngine,
          geminiApiKey: res.geminiApiKey || DEFAULTS.geminiApiKey,
          thinkingLevel: res.thinkingLevel || DEFAULTS.thinkingLevel,
        });
      },
    );
  });
}

/** Persist engine settings to chrome.storage.local. */
export function saveEngineSettings(settings: EngineSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(
      { defaultEngine: settings.defaultEngine, geminiApiKey: settings.geminiApiKey, thinkingLevel: settings.thinkingLevel },
      resolve,
    );
  });
}
