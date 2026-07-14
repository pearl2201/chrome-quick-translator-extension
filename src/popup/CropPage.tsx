import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Group, Image as KonvaImage, Rect, Transformer } from 'react-konva';
import { createWorker } from 'tesseract.js';
import { initQuickTranslator, translateToVietnamese } from '../translator/quickTranslator';
import WordLookup from './WordLookup';

export default function CropPage() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');

  const [cropRect, setCropRect] = useState({ x: 50, y: 50, width: 200, height: 150 });
  const [zoom, setZoom] = useState(0.75);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [extractedText, setExtractedText] = useState('');
  const [page, setPage] = useState<'CROP' | 'TRANSLATE'>('CROP');
  const [translatedText, setTranslatedText] = useState('');
  const [translateEngine, setTranslateEngine] = useState('quick-translator-ts');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const ocrTextRef = useRef<HTMLTextAreaElement>(null);
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Read image from chrome.storage.local on mount
  useEffect(() => {
    chrome.storage.local.get('capturedImage', (result) => {
      const uri = result.capturedImage as string | undefined;
      if (uri) {
        setImageUri(uri);
      }
    });
  }, []);

  // Load image element when URI is available
  useEffect(() => {
    if (imageUri) {
      const img = new window.Image();
      img.src = imageUri;
      img.onload = () => setImageEl(img);
    }
  }, [imageUri]);

  // Measure container size
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Initialize cropRect to full image and attach transformer when image loads
  useEffect(() => {
    if (imageEl) {
      setCropRect({ x: 0, y: 0, width: imageEl.width, height: imageEl.height });
    }
  }, [imageEl]);

  useEffect(() => {
    if (trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [imageEl]);

  const getCroppedCanvas = (): HTMLCanvasElement | null => {
    if (!imageEl || !shapeRef.current) return null;
    const exportCanvas = document.createElement('canvas');
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return null;

    const rect = shapeRef.current;
    const x = rect.x();
    const y = rect.y();
    const w = rect.width() * rect.scaleX();
    const h = rect.height() * rect.scaleY();

    exportCanvas.width = w;
    exportCanvas.height = h;
    ctx.drawImage(imageEl, x, y, w, h, 0, 0, w, h);
    console.log(`Crop canvas: ${x}-${y}, size: ${w}-${h}`);
    return exportCanvas;
  };

  const handleDownload = () => {
    const canvas = getCroppedCanvas();
    if (!canvas) return;
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';

    const link = document.createElement('a');
    link.download = `cropped-snap.${format}`;
    link.href = canvas.toDataURL(mimeType, format === 'jpeg' ? 0.9 : undefined);
    link.click();
    canvas.remove();
  };

  const handleCrop = () => {
    const canvas = getCroppedCanvas();
    if (!canvas) return;

    const croppedDataUrl = canvas.toDataURL('image/png');
    canvas.remove();

    // Replace the full-page image with the cropped version,
    // preserving containerSize and resetting cropRect to cover the new image
    const img = new window.Image();
    img.src = croppedDataUrl;
    img.onload = () => {
      setImageEl(img);
      setImageUri(croppedDataUrl);
      console.log(`New image size: ${img.width} - ${img.height}`)
      setCropRect({ x: 0, y: 0, width: img.width, height: img.height });
    };
  };



  const handleGetText = async () => {
    const canvas = getCroppedCanvas();
    if (!canvas) return;

    setIsProcessingOcr(true);
    setOcrProgress(0);

    try {
      const dataUrl = canvas.toDataURL('image/png');

      // Fetch worker script and create a blob URL to bypass CSP
      const worker = await createWorker(['chi_sim', 'chi_tra', 'eng'], 1, {
        workerPath: chrome.runtime.getURL('tesseract/worker.min.js'),
        // CRUCIAL FOR v7: corePath must point to the FOLDER, not the specific file string.
        corePath: chrome.runtime.getURL('tesseract/'),
        // Points to your local public folder containing your .traineddata files
        langPath: chrome.runtime.getURL('tesseract/'),
        //langPath: chrome.runtime.getURL('tesseract/'), // Point to folder containing eng.traineddata
        workerBlobURL: false,
        // FIX: Catch and suppress the false-positive initialization path errors
        errorHandler: (err: any) => {
          const errorString = String(err);
          if (
            errorString.includes("Error opening data file") ||
            errorString.includes("Failed loading language")
          ) {
            // Ignore this specific text asset loading loop artifact
            return;
          }
          // Otherwise, log genuine engine failures
          console.error("Tesseract Engine Error:", err);
        },
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      // 3. Re-initialize the worker to combine all loaded languages for this active job
      await worker.reinitialize('chi_sim+chi_tra+eng');
      const { data: { text } } = await worker.recognize(dataUrl);
      await worker.terminate();
      setExtractedText(text || '(No text detected)');
      setTranslatedText('');
      setPage('TRANSLATE');
    } catch (err) {
      console.error('OCR failed:', err);
      setExtractedText('OCR processing error.');
      setPage('TRANSLATE');
    } finally {
      setIsProcessingOcr(false);
      canvas.remove();
    }
  };

  const handleReset = () => {
    chrome.storage.local.remove('capturedImage');
    window.close();
  };

  // Compute base scale (fit image width to container), then multiply by zoom
  let baseScale = 1;
  let stageWidth = containerSize.width;
  let stageHeight = containerSize.height;
  if (imageEl && containerSize.width > 0) {
    baseScale = containerSize.width / imageEl.width;
    const imgDisplayW = imageEl.width * baseScale * zoom;
    const imgDisplayH = imageEl.height * baseScale * zoom;
    stageWidth = Math.max(containerSize.width, imgDisplayW + 200);
    stageHeight = Math.max(containerSize.height, imgDisplayH + 200);
  }
  const displayScale = baseScale * zoom;
  // Offset so the image is centered in the Stage when Stage is larger
  const imgDisplayW = imageEl ? imageEl.width * displayScale : 0;
  const imgDisplayH = imageEl ? imageEl.height * displayScale : 0;
  const offsetX = Math.max(0, (stageWidth - imgDisplayW) / 2);
  const offsetY = Math.max(0, (stageHeight - imgDisplayH) / 2);

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
    const content = translatedText || extractedText;
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

  const zoomIn = () => setZoom((z) => Math.min(z * 1.3, 10));
  const zoomOut = () => setZoom((z) => Math.max(z / 1.3, 0.1));
  const zoomReset = () => setZoom(1);

  const zoomPercent = Math.round(zoom * 100);
  console.log(`Stage (${stageWidth}x${stageHeight}). Offset ${offsetX}-${offsetY}`);
  return (
    <div className="h-screen w-screen bg-slate-900 text-white flex flex-col overflow-hidden selection:bg-indigo-500">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-4 py-2 border-b border-slate-800 shrink-0 bg-slate-950">
        {/* Left group: Crop + Zoom */}
        <div className="flex items-center gap-2">
          <>
            <button
              onClick={handleCrop}
              className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-lg shadow-md transition"
            >
              ✂ Crop
            </button>
            <button
              onClick={handleGetText}
              disabled={isProcessingOcr}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-emerald-900 disabled:text-slate-500 text-white text-xs font-semibold rounded-lg shadow-md transition"
            >
              {isProcessingOcr ? `${ocrProgress}%` : '📝 Get Text'}
            </button>
            <span className="w-px h-5 bg-slate-700" />
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                onClick={zoomOut}
                className="px-2 py-1 text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-700 rounded transition"
                title="Zoom out"
              >
                −
              </button>
              <button
                onClick={zoomReset}
                className="px-2 py-1 text-xs font-semibold text-indigo-400 min-w-[48px] text-center hover:bg-slate-700 rounded transition"
                title="Reset zoom"
              >
                {zoomPercent}%
              </button>
              <button
                onClick={zoomIn}
                className="px-2 py-1 text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-700 rounded transition"
                title="Zoom in"
              >
                +
              </button>
            </div>
          </>
        </div>

        {/* Right group: Save PNG / Translate / Close */}
        <div className="flex items-center gap-2">
          <>
            <div className="flex bg-slate-800 rounded-md p-0.5 border border-slate-700">
              <button
                className={`px-2.5 py-1 text-xs font-bold rounded ${format === 'png' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                onClick={() => setFormat('png')}
              >
                PNG
              </button>
              <button
                className={`px-2.5 py-1 text-xs font-bold rounded ${format === 'jpeg' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                onClick={() => setFormat('jpeg')}
              >
                JPG
              </button>
            </div>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1"
            >
              💾 Save
            </button>
            <span className="w-px h-5 bg-slate-700" />
          </>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 border border-slate-700 bg-slate-800 text-slate-300 text-xs rounded-lg hover:bg-slate-700 transition"
          >
            ✕ Close
          </button>
        </div>
      </nav>

      {/* Body — Crop Mode */}
      {page === 'CROP' && (
        <main className="flex-1 flex overflow-hidden">
          <div ref={containerRef} className="flex-1 bg-slate-950 overflow-auto relative">
            {!imageEl ? (
              <div className="flex items-center justify-center h-full text-slate-400">
                Preparing canvas engine...
              </div>
            ) : (
              <Stage
                width={stageWidth}
                height={stageHeight}
                ref={stageRef}
              >
                <Layer>
                  <Group x={offsetX} y={offsetY} scaleX={displayScale} scaleY={displayScale}>
                    <KonvaImage image={imageEl} x={0} y={0} />
                    <Rect
                      ref={shapeRef}
                      {...cropRect}
                      draggable
                      stroke="#6366f1"
                      strokeWidth={3 / displayScale}
                      fill="rgba(99, 102, 241, 0.15)"
                      onDragEnd={(e) =>
                        setCropRect({ ...cropRect, x: e.target.x(), y: e.target.y() })
                      }
                      onTransformEnd={() => {
                        const node = shapeRef.current;
                        // Flatten the transform: multiply scale into base dimensions
                        // so scaleX/scaleY stay 1 and width/height reflect actual size
                        const newW = Math.max(5, node.width() * node.scaleX());
                        const newH = Math.max(5, node.height() * node.scaleY());
                        node.scaleX(1);
                        node.scaleY(1);
                        node.width(newW);
                        node.height(newH);
                        setCropRect({
                          x: node.x(),
                          y: node.y(),
                          width: newW,
                          height: newH,
                        });
                      }}
                    />
                    <Transformer
                      ref={trRef}
                      rotateEnabled={false}
                      keepRatio={false}
                      enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                    />
                  </Group>
                </Layer>
              </Stage>
            )}
            {/* OCR loading overlay — fixed to cover viewport regardless of scroll */}
            {isProcessingOcr && (
              <div className="fixed inset-0 bg-slate-950/80 flex flex-col items-center justify-center z-20">
                <div className="text-5xl animate-spin mb-4">⏳</div>
                <p className="text-lg font-semibold text-slate-300">
                  Recognizing text... {ocrProgress}%
                </p>
              </div>
            )}

            {/* Bottom-left info overlay — stays visible at viewport bottom when scrolling */}
            {imageEl && !isProcessingOcr && (
              <div className="fixed bottom-3 left-3 flex gap-4 text-[11px] font-mono text-slate-500 pointer-events-none z-10">
                <span>{imageEl.width}×{imageEl.height}px</span>
                <span>
                  crop: {Math.round(cropRect.x)},{Math.round(cropRect.y)} {Math.round(cropRect.width)}×{Math.round(cropRect.height)}
                </span>
              </div>
            )}
          </div>
        </main>
      )}

      {/* Body — Translate Mode */}
      {page === 'TRANSLATE' && (
        <div ref={fullscreenRef} className="flex-1 flex flex-col bg-slate-900 text-white overflow-hidden">
          {/* Translate navbar */}
          <nav className="flex items-center justify-between px-4 py-2 border-b border-slate-800 shrink-0 bg-slate-950">
            <button
              onClick={() => setPage('CROP')}
              className="px-3 py-1.5 border border-slate-700 bg-slate-800 text-slate-300 text-xs rounded-lg hover:bg-slate-700 transition"
            >
              ← Back to Crop
            </button>

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

            <div className="flex items-center gap-2">
              {translateEngine === 'quick-translator-ts' && (
                <button
                  onClick={async () => {
                    if (!extractedText) return;
                    setIsTranslating(true);
                    try {
                      await initQuickTranslator();
                      const result = translateToVietnamese(extractedText);
                      setTranslatedText(result);
                    } catch (err) {
                      console.error('Translation failed:', err);
                      setTranslatedText('Translation engine error: ' + (err as Error).message);
                    } finally {
                      setIsTranslating(false);
                    }
                  }}
                  disabled={isTranslating}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-emerald-900 disabled:text-slate-500 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1"
                >
                  {isTranslating ? '⏳ Translating…' : '🌐 Translate'}
                </button>
              )}
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

          {/* Two-panel text view */}
          <main className="flex-1 grid grid-cols-2 gap-4 p-4 overflow-hidden">
            <div className="flex flex-col gap-2 overflow-hidden">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                Extracted Text (OCR)
              </label>
              <textarea
                ref={ocrTextRef}
                readOnly
                className="flex-1 w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-sm font-mono text-slate-200 resize-none focus:outline-none"
                value={extractedText}
              />
              <WordLookup textareaRef={ocrTextRef} />
            </div>
            <div className="flex flex-col gap-2 overflow-hidden">
              <label className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider shrink-0">
                Translated Text
                <span className="text-[10px] font-mono text-indigo-500/70 normal-case ml-2">
                  engine: {translateEngine}
                </span>
              </label>
              <textarea
                value={translatedText}
                onChange={(e) => setTranslatedText(e.target.value)}
                placeholder={`[${translateEngine}]\nTranslated output will appear here…`}
                className="flex-1 w-full p-3 bg-slate-950 border border-indigo-900/50 rounded-lg text-sm font-mono text-indigo-200 resize-none focus:outline-none placeholder:text-indigo-200/30"
              />
            </div>
          </main>
        </div>
      )}

    </div>
  );
}
