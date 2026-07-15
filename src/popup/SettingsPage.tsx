import { useState, useEffect } from 'react';
import { getEngineSettings, saveEngineSettings } from '../translator/engineSettings';
import type { EngineSettings } from '../translator/engineSettings';

export default function SettingsPage() {
  const [settings, setSettings] = useState<EngineSettings>({
    defaultEngine: 'quick-translator-ts',
    geminiApiKey: '',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getEngineSettings().then(setSettings);
  }, []);

  const handleSave = async () => {
    await saveEngineSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="h-screen w-screen bg-slate-900 text-white flex flex-col overflow-hidden selection:bg-indigo-500">
      <nav className="flex items-center justify-between px-4 py-2 border-b border-slate-800 shrink-0 bg-slate-950">
        <h1 className="text-lg font-bold tracking-tight text-indigo-400">
          Settings
        </h1>
        <button
          onClick={handleSave}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
            saved
              ? 'bg-emerald-700 text-white'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
          }`}
        >
          {saved ? '✅ Saved' : '💾 Save'}
        </button>
      </nav>

      <main className="flex-1 overflow-auto p-6 space-y-6 max-w-xl">
        {/* Default Engine */}
        <section>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Default Translation Engine
          </label>
          <select
            value={settings.defaultEngine}
            onChange={(e) => setSettings((s) => ({ ...s, defaultEngine: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="quick-translator-ts">Quick Translator</option>
            <option value="gemini">Gemini</option>
            <option value="hachimitu-60-qt">HachimiMT-60-QT</option>
          </select>
          <p className="text-xs text-slate-600 mt-1">
            Used as the default when opening Translate, Batch, or Crop pages.
          </p>
        </section>

        {/* Gemini API Key */}
        <section>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Gemini API Key
          </label>
          <input
            type="password"
            value={settings.geminiApiKey}
            onChange={(e) => setSettings((s) => ({ ...s, geminiApiKey: e.target.value }))}
            placeholder="Enter your Gemini API key…"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-sm font-mono rounded-lg focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
          />
          <p className="text-xs text-slate-600 mt-1">
            Required when using the Gemini engine. Stored locally in your browser.
          </p>
        </section>
      </main>
    </div>
  );
}
