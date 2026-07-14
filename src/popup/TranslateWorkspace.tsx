import { useEffect, useState } from 'react';
import { useCaptureStore } from '../store/useCaptureStore';

export default function TranslateWorkspace() {
    const { extractedText, translatedText, setTranslatedText, resetCapture } = useCaptureStore();
    const [isTranslating, setIsTranslating] = useState(false);

    useEffect(() => {
        const runTranslationPipeline = async () => {
            if (!extractedText || extractedText.trim() === "") return;
            setIsTranslating(true);

            try {
                // =========================================================================
                // PLACEHOLDER FOR: https://github.com/pearl2201/quick-translator-ts
                // =========================================================================
                // TODO: Import your package modules and execute your local conversion rules.
                // Example integration schema:
                //   import { QuickTranslator } from 'quick-translator-ts';
                //   const engine = new QuickTranslator({ dictPath: './dicts' });
                //   const result = await engine.translate(extractedText);
                //   setTranslatedText(result);

                // Simulating the translator pipeline processing behavior below:
                await new Promise((resolve) => setTimeout(resolve, 800));
                setTranslatedText(`[quick-translator-ts Output] Translated version of: \n${extractedText.substring(0, 60)}...`);

                // =========================================================================
            } catch (err) {
                console.error("Translation Hook Failure:", err);
                setTranslatedText("Translation execution engine failure error occurred.");
            } finally {
                setIsTranslating(false);
            }
        };

        runTranslationPipeline();
    }, [extractedText, setTranslatedText]);

    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Detected Text (OCR)</label>
                <textarea
                    readOnly
                    className="w-full h-24 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 resize-none focus:outline-none focus:border-slate-700"
                    value={extractedText}
                />
            </div>

            <div className="space-y-1">
                <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Translated Outcome</label>
                {isTranslating ? (
                    <div className="w-full h-24 flex items-center justify-center bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-500 animate-pulse">
                        Executing quick-translator-ts pipeline...
                    </div>
                ) : (
                    <textarea
                        readOnly
                        className="w-full h-24 p-2 bg-slate-950 border border-indigo-900/50 rounded-lg text-xs font-mono text-indigo-200 resize-none focus:outline-none"
                        value={translatedText}
                    />
                )}
            </div>

            <button
                onClick={resetCapture}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-xs rounded-lg transition"
            >
                🔄 Capture Another Segment
            </button>
        </div>
    );
}
