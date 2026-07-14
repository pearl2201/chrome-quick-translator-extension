import { useState, useRef } from 'react';
import { initQuickTranslator, translateToVietnamese } from '../translator/quickTranslator';
import WordLookup from './WordLookup';

export default function TranslatePage() {
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [translateEngine, setTranslateEngine] = useState('quick-translator-ts');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setIsTranslating(true);
    try {
      if (translateEngine === 'quick-translator-ts') {
        await initQuickTranslator();
        const result = translateToVietnamese(inputText);
        setTranslatedText(result);
      } else {
        setTranslatedText(`[${translateEngine}] Engine not yet integrated.\nInput:\n${inputText}`);
      }
    } catch (err) {
      console.error('Translation failed:', err);
      setTranslatedText('Translation engine error: ' + (err as Error).message);
    } finally {
      setIsTranslating(false);
    }
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) setIsFullscreen(false);
  });

  const handleDownloadPdf = () => {
    const content = translatedText || inputText;
    if (!content) return;
    const html = `<html><body><pre style="font-family:sans-serif;white-space:pre-wrap;word-wrap:break-word;padding:2em">${content}</pre></body></html>`;
    const blob = new Blob([html], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'translated-text.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div ref={fullscreenRef} className="h-screen w-screen bg-slate-900 text-white flex flex-col overflow-hidden selection:bg-indigo-500">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-4 py-2 border-b border-slate-800 shrink-0 bg-slate-950">
        <h1 className="text-lg font-bold tracking-tight text-indigo-400">
          SnapFull Suite — Translate
        </h1>
        <div className="flex items-center gap-2">
          {/* Engine selector */}
          <select
            value={translateEngine}
            onChange={(e) => setTranslateEngine(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="quick-translator-ts">Quick Translator</option>
            <option value="hachimitu-60-qt">HachimiMT-60-QT</option>
            <option value="gemini">Gemini</option>
          </select>

          <button
            onClick={handleTranslate}
            disabled={isTranslating || !inputText.trim()}
            className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-emerald-900 disabled:text-slate-500 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1"
          >
            {isTranslating ? '⏳ Translating…' : '🌐 Translate'}
          </button>
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1"
          >
            {isFullscreen ? '⛶ Exit Fullscreen' : '⛶ Fullscreen'}
          </button>
          <button
            onClick={handleDownloadPdf}
            className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1"
          >
            📄 Download PDF
          </button>
        </div>
      </nav>

      {/* Two-panel view */}
      <main className="flex-1 grid grid-cols-2 gap-4 p-4 overflow-hidden">
        <div className="flex flex-col gap-2 overflow-hidden">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
            Chinese Text
          </label>
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste or type Chinese text here…"
            className="flex-1 w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-sm font-mono text-slate-200 resize-none focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
          />
          <WordLookup textareaRef={inputRef} />
        </div>
        <div className="flex flex-col gap-2 overflow-hidden">
          <label className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider shrink-0">
            Translated Text
            <span className="text-[10px] font-mono text-indigo-500/70 normal-case ml-2">
              engine: {translateEngine}
            </span>
          </label>
          <textarea
            readOnly
            value={translatedText}
            placeholder="Translated output will appear here…"
            className="flex-1 w-full p-3 bg-slate-950 border border-indigo-900/50 rounded-lg text-sm font-mono text-indigo-200 resize-none focus:outline-none placeholder:text-indigo-200/30"
          />
        </div>
      </main>
    </div>
  );
}
