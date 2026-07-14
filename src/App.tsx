import { useCaptureStore } from './store/useCaptureStore';

const openTranslatePage = () => {
  chrome.tabs.create({ url: 'translate.html' });
};

export default function App() {
  const { isCapturing, progress, error, startCapture } = useCaptureStore();

  const handleAction = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await startCapture(tab.id);
    }
  };

  return (
    <div className="p-5 flex flex-col justify-between h-full bg-slate-900 text-white selection:bg-indigo-500 w-[350px]">
      <header className="border-b border-slate-800 pb-3">
        <h1 className="text-xl font-bold tracking-tight text-indigo-400">SnapFull Suite</h1>
        <p className="text-xs text-slate-400 mt-1">Stitch, crop, extract text, and translate layout views.</p>
      </header>

      <main className="my-4 flex flex-col justify-center flex-1">
        {isCapturing ? (
          <div className="w-full space-y-3 px-2 py-6">
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="text-slate-300 animate-pulse">Stitching segments...</span>
              <span className="text-indigo-400 font-mono font-bold">{progress}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 space-y-2">
            <div className="text-4xl">📸</div>
            <p className="text-sm text-slate-300">Ready to read current page contents</p>
          </div>
        )}

        {error && (
          <div className="mt-2 p-3 bg-red-950/50 border border-red-500/30 rounded-lg text-xs text-red-400 text-center">
            ⚠️ {error}
          </div>
        )}
      </main>

      <footer className="flex flex-col gap-2">
        <button
          disabled={isCapturing}
          onClick={handleAction}
          className={`w-full py-2.5 px-4 font-semibold text-sm rounded-lg shadow-md transition-all duration-200 text-center block ${
            isCapturing 
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' 
              : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-[0.98]'
          }`}
        >
          {isCapturing ? 'Processing Layout...' : '📸 Capture Full Page'}
        </button>
        <button
          onClick={openTranslatePage}
          className="w-full py-2.5 px-4 font-semibold text-sm rounded-lg shadow-md transition-all duration-200 text-center block bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
        >
          🌐 Translate Only
        </button>
      </footer>
    </div>
  );
}