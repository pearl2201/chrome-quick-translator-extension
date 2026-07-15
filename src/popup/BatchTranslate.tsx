import { useState, useEffect } from 'react';
import { initQuickTranslator, translateToVietnamese } from '../translator/quickTranslator';
import { getEngineSettings } from '../translator/engineSettings';
import { translateToVietnamese as hachimiTranslator } from '../translator/hachimiTranslator';
import { translateToVietnamese as geminiTranslator } from '../translator/geminiTranslator';

interface FileEntry {
  name: string;
  content: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  result?: string;
  error?: string;
  /** Handle to the written output file, so we can offer it for download. */
  outFileHandle?: FileSystemFileHandle;
}

export default function BatchTranslate() {
  const [files, setFiles] = useState<FileEntry[]>([]);

  const [translateEngine, setTranslateEngine] = useState('quick-translator-ts');

  useEffect(() => {
    getEngineSettings().then((s) => setTranslateEngine(s.defaultEngine));
  }, []);
  const [folderHandle, setFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const pickFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' }) as FileSystemDirectoryHandle;
      setFolderHandle(handle);

      const entries: FileEntry[] = [];
      for await (const entry of (handle as any).values()) {
        if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.txt')) {
          const file = await (entry as FileSystemFileHandle).getFile();
          const content = await file.text();
          entries.push({ name: entry.name, content, status: 'pending' });
        }
      }
      entries.sort((a, b) => a.name.localeCompare(b.name));
      setFiles(entries);
      setProgress(0);
    } catch (err) {
      console.error('Folder pick failed:', err);
    }
  };

  const runBatch = async () => {
    if (!folderHandle || files.length === 0) return;
    setIsRunning(true);
    setProgress(0);

    try {
      await initQuickTranslator();

      // Create output subdirectory
      let outputHandle: FileSystemDirectoryHandle;
      try {
        outputHandle = await folderHandle.getDirectoryHandle('output', { create: true });
      } catch {
        outputHandle = await folderHandle.getDirectoryHandle('output', { create: true });
      }

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setFiles((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'processing' };
          return next;
        });

        try {
          let result: string;
          if (translateEngine === 'quick-translator-ts') {
            result = translateToVietnamese(f.content);
          } else if (translateEngine === 'hachimitu-60-qt') {
            result = await hachimiTranslator(f.content);
          } else if (translateEngine === 'gemini') {
            result = await geminiTranslator(f.content);
          } else {
            result = `[${translateEngine}] Engine not supported in batch.`;
          }
          const outName = f.name.replace(/\.txt$/i, '_translated.txt');

          // Write output file
          const outFile = await outputHandle.getFileHandle(outName, { create: true });
          const writable = await outFile.createWritable();
          await writable.write(result);
          await writable.close();

          setFiles((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], status: 'done', result, outFileHandle: outFile };
            return next;
          });
        } catch (err) {
          setFiles((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], status: 'error', error: String(err) };
            return next;
          });
        }

        setProgress(i + 1);
      }
    } catch (err) {
      console.error('Batch failed:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleDownload = async (entry: FileEntry) => {
    if (entry.outFileHandle) {
      const file = await entry.outFileHandle.getFile();
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = entry.name.replace(/\.txt$/i, '_translated.txt');
      a.click();
      URL.revokeObjectURL(url);
    } else if (entry.result) {
      const blob = new Blob([entry.result], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = entry.name.replace(/\.txt$/i, '_translated.txt');
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleCopyOutputPath = async () => {
    if (!folderHandle) return;
    const msg = `Output files are in the "output/" subdirectory of the folder you selected.\nFolder: ${folderHandle.name}\n\nUse the 📥 Download button in the table to save each file.`;
    try {
      await navigator.clipboard.writeText(msg);
    } catch {}
    alert(msg);
  };

  const doneCount = files.filter((f) => f.status === 'done').length;
  const errorCount = files.filter((f) => f.status === 'error').length;

  return (
    <div className="h-screen w-screen bg-slate-900 text-white flex flex-col overflow-hidden selection:bg-indigo-500">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-4 py-2 border-b border-slate-800 shrink-0 bg-slate-950">
        <h1 className="text-lg font-bold tracking-tight text-indigo-400">
          Batch Translate
        </h1>
        <div className="flex items-center gap-2">
          {folderHandle && (
            <span className="text-xs text-slate-500 truncate max-w-[200px]">
              📁 {folderHandle.name}
            </span>
          )}
          <button
            onClick={pickFolder}
            disabled={isRunning}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs rounded-lg transition"
          >
            📂 Select Folder
          </button>
          <button
            onClick={runBatch}
            disabled={isRunning || files.length === 0}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-emerald-900 disabled:text-slate-500 text-white text-xs font-semibold rounded-lg transition"
          >
            {isRunning ? `⏳ ${progress}/${files.length}` : '▶ Run Batch'}
          </button>
          {doneCount > 0 && (
            <button
              onClick={handleCopyOutputPath}
              className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs rounded-lg transition"
              title="Shows output location info"
            >
              📋 Output Info
            </button>
          )}
        </div>
      </nav>

      {/* Progress bar */}
      {files.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-b border-slate-800 bg-slate-950/50">
          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
            <span>{doneCount + errorCount}/{files.length} processed</span>
            <span>{doneCount} ✅ {errorCount > 0 && `${errorCount} ❌`}</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${files.length > 0 ? ((doneCount + errorCount) / files.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* File list */}
      <main className="flex-1 overflow-auto">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-3">
            <div className="text-5xl">📂</div>
            <p className="text-sm">Click <strong>Select Folder</strong> to pick a folder with .txt files</p>
            <p className="text-xs text-slate-700">Output written to <code>output/</code> subdirectory — use 📥 to download each file</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-800 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2">File</th>
                <th className="text-center px-4 py-2 w-[60px]">Size</th>
                <th className="text-center px-4 py-2 w-[80px]">Status</th>
                <th className="text-center px-4 py-2 w-[90px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f, i) => (
                <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/50">
                  <td className="px-4 py-2 font-mono text-slate-200 truncate max-w-[300px]">
                    {f.status === 'done' ? f.name.replace(/\.txt$/i, '_translated.txt') : f.name}
                  </td>
                  <td className="px-4 py-2 text-center text-slate-500">
                    {f.content.length}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {f.status === 'pending' && <span className="text-slate-600">⏳ Pending</span>}
                    {f.status === 'processing' && <span className="text-indigo-400 animate-pulse">⟳ Processing</span>}
                    {f.status === 'done' && <span className="text-emerald-400">✅ Done</span>}
                    {f.status === 'error' && (
                      <span className="text-red-400" title={f.error}>❌ Error</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {f.status === 'done' && (
                      <button
                        onClick={() => handleDownload(f)}
                        className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-[10px]"
                        title="Download file"
                      >
                        📥
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
