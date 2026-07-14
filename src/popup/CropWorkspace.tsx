import  { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Transformer } from 'react-konva';
import { createWorker } from 'tesseract.js';
import { useCaptureStore } from '../store/useCaptureStore';

export default function CropWorkspace() {
  const { stitchedImageUri, resetCapture, setExtractedText, setActiveStep } = useCaptureStore();
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  
  const [cropRect, setCropRect] = useState({ x: 50, y: 50, width: 200, height: 150 });
  
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const stageRef = useRef<any>(null);

  useEffect(() => {
    if (stitchedImageUri) {
      const img = new window.Image();
      img.src = stitchedImageUri;
      img.onload = () => setImageEl(img);
    }
  }, [stitchedImageUri]);

  useEffect(() => {
    if (trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [imageEl]);

  // Internal helper to slice crop coordinate bounds out of the main image
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

  const handleOcrAndTranslate = async () => {
    const canvas = getCroppedCanvas();
    if (!canvas) return;

    setIsProcessingOcr(true);
    setOcrProgress(0);

    try {
      const croppedDataUrl = canvas.toDataURL('image/png');
      
      // Initialize Tesseract worker 
      // Note: Swap 'eng' to 'chi_sim' or 'vie' depending on your primary novel source targets
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        }
      });

      const { data: { text } } = await worker.recognize(croppedDataUrl);
      await worker.terminate();

      setExtractedText(text || "No legible text structures detected.");
      setActiveStep('OCR_TRANSLATE'); // Move workspace step forward
    } catch (err) {
      console.error("OCR Failure Error:", err);
      setExtractedText("Failed to correctly parse layout strings.");
      setActiveStep('OCR_TRANSLATE');
    } finally {
      setIsProcessingOcr(false);
      canvas.remove();
    }
  };

  if (!imageEl) return <div className="text-center text-slate-400 py-10">Preparing Canvas engine...</div>;

  const stageWidth = 310;
  const scaleFactor = stageWidth / imageEl.width;
  const stageHeight = imageEl.height * scaleFactor;

  return (
    <div className="space-y-4">
      {isProcessingOcr ? (
        <div className="flex flex-col justify-center items-center py-16 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
          <div className="text-3xl animate-spin">⏳</div>
          <p className="text-sm font-semibold text-slate-300">Processing OCR Reading... {ocrProgress}%</p>
        </div>
      ) : (
        <>
          <div className="border border-slate-700 bg-slate-950 rounded-lg overflow-hidden relative" style={{ maxHeight: '220px', overflowY: 'auto' }}>
            <Stage width={stageWidth} height={stageHeight} scaleX={scaleFactor} scaleY={scaleFactor} ref={stageRef}>
              <Layer>
                <KonvaImage image={imageEl} x={0} y={0} />
                <Rect
                  ref={shapeRef}
                  {...cropRect}
                  draggable
                  stroke="#6366f1"
                  strokeWidth={3}
                  fill="rgba(99, 102, 241, 0.15)"
                  onDragEnd={(e) => setCropRect({ ...cropRect, x: e.target.x(), y: e.target.y() })}
                  onTransformEnd={() => {
                    const node = shapeRef.current;
                    setCropRect({ x: node.x(), y: node.y(), width: node.width(), height: node.height() });
                  }}
                />
                <Transformer ref={trRef} rotateEnabled={false} keepRatio={false} enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']} />
              </Layer>
            </Stage>
          </div>

          <div className="flex gap-2 items-center justify-between bg-slate-800/50 p-2 rounded-lg">
            <label className="text-xs font-semibold text-slate-400">Format</label>
            <div className="flex bg-slate-900 rounded-md p-0.5 border border-slate-700">
              <button className={`px-2.5 py-0.5 text-xs font-bold rounded ${format === 'png' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`} onClick={() => setFormat('png')}>PNG</button>
              <button className={`px-2.5 py-0.5 text-xs font-bold rounded ${format === 'jpeg' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`} onClick={() => setFormat('jpeg')}>JPG</button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleOcrAndTranslate}
              className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm rounded-lg shadow-md transition"
            >
              🔍 OCR & Translate Selection
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={resetCapture} className="py-2 border border-slate-700 bg-slate-800 text-slate-300 text-xs rounded-lg hover:bg-slate-700">Cancel</button>
              <button onClick={handleDownload} className="py-2 bg-slate-700 text-white text-xs font-semibold rounded-lg hover:bg-slate-600">Save Image</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
