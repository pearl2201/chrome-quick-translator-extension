# Architecture — Chrome Quick Translator Extension

## Table of Contents

1. [Overview](#1-overview)
2. [Entry Points & Pages](#2-entry-points--pages)
3. [Data Flow](#3-data-flow)
4. [Key Modules](#4-key-modules)
5. [CropPage Component Architecture](#5-croppage-component-architecture)
6. [Translation Engine Integration](#6-translation-engine-integration)
7. [Chrome Extension Wiring](#7-chrome-extension-wiring)
8. [Build & Configuration](#8-build--configuration)
9. [Troubleshooting Guide](#9-troubleshooting-guide)
10. [How to Add a New Translation Engine](#10-how-to-add-a-new-translation-engine)

---

## 1. Overview

This extension is a React 19 single-page application packaged as a Chrome Extension (Manifest V3) using **Vite 8** + **CRXjs**. It consists of two independent HTML pages:

| Page | File | Purpose |
|------|------|---------|
| **Popup** | `index.html` → `src/main.tsx` → `App.tsx` | Small popup with capture button |
| **Crop Workspace** | `crop.html` → `src/crop-main.tsx` → `CropPage.tsx` | Full-page crop, OCR & translate |

Communication between pages uses `chrome.storage.local` and `chrome.runtime.sendMessage`.

```
┌──────────────────┐     chrome.runtime.sendMessage     ┌─────────────────────┐
│                  │  ───────────────────────────────►  │                     │
│   Popup (350px)  │                                    │  Background Script  │
│   App.tsx        │  ◄───────────────────────────────  │  background.ts      │
│                  │     chrome.runtime.onMessage        │  (service worker)   │
└──────┬───────────┘                                    └──────────┬──────────┘
       │                                                           │
       │ chrome.storage.local.set({ capturedImage })               │ chrome.debugger
       │                                                           │
       ▼                                                           ▼
┌──────────────────┐                                    ┌─────────────────────┐
│                  │                                    │                     │
│  Crop Tab        │                                    │  Target Web Page    │
│  CropPage.tsx    │                                    │  (active tab)       │
│                  │                                    │                     │
└──────────────────┘                                    └─────────────────────┘
```

---

## 2. Entry Points & Pages

### 2.1 Popup (`index.html` → `App.tsx`)

A small 350px-wide popup with a single button. The Zustand store (`useCaptureStore.ts`) manages the capture lifecycle:

| State | Description |
|-------|-------------|
| `isCapturing` | True while the background script captures |
| `progress` | 0–100% progress from CDP capture |
| `error` | Error message string or null |

On click, the popup sends `START_CAPTURE` to the background script and listens for `CAPTURE_PROGRESS` / `CAPTURE_COMPLETE` messages. On completion, it stores the image data URL in `chrome.storage.local` and opens `crop.html` in a new tab.

### 2.2 Crop Workspace (`crop.html` → `CropPage.tsx`)

A full-screen page with three internal stages:

| Internal Stage | Description |
|----------------|-------------|
| **CROP** | Displays the captured image in a Konva Stage with an interactive selection rectangle (Rect + Transformer). Supports zoom in/out (10–1000%). |
| **OCR** | (hidden between) Loading overlay during Tesseract.js processing. |
| **TRANSLATE** | Side-by-side text areas: extracted OCR text (read-only) and translated text (editable). Engine selector dropdown. |

---

## 3. Data Flow

### 3.1 Capture Flow

```
User clicks "Capture Full Page"
  │
  ▼
App.tsx: useCaptureStore.startCapture(tabId)
  │
  ├─► chrome.runtime.sendMessage({ action: "START_CAPTURE", tabId })
  │
  ├─► chrome.runtime.onMessage.addListener(progressListener)
  │     Handles CAPTURE_PROGRESS, CAPTURE_COMPLETE
  │
  ▼
background.ts: runFullPageCapture(tabId)
  │
  ├─1. chrome.debugger.attach(target, "1.3")
  ├─2. Page.getLayoutMetrics → contentSize
  ├─3. Emulation.setDeviceMetricsOverride (full page size)
  ├─4. Page.captureScreenshot (PNG)
  ├─5. Emulation.clearDeviceMetricsOverride
  ├─6. chrome.runtime.sendMessage({ action: "CAPTURE_COMPLETE", dataUrl })
  └─7. chrome.debugger.detach(target)
  │
  ▼
Popup progressListener receives CAPTURE_COMPLETE
  │
  ├─► chrome.storage.local.set({ capturedImage: dataUrl })
  └─► chrome.tabs.create({ url: "crop.html" })
  │
  ▼
CropPage.tsx: chrome.storage.local.get("capturedImage")
  └─► Loads image into Konva Stage
```

### 3.2 OCR Flow

```
User clicks "📝 Get Text"
  │
  ▼
CropPage.tsx: handleGetText()
  │
  ├─1. getCroppedCanvas() — creates a <canvas> from the Konva Rect bounds
  │     Uses: ctx.drawImage(sourceImage, rect.x, rect.y, rect.w, rect.h, …)
  │
  ├─2. fetch(chrome.runtime.getURL("tesseract/worker.min.js"))
  │     → blob URL (bypasses CSP for Web Worker)
  │
  ├─3. createWorker("eng", 1, { workerPath: blobUrl, corePath: "tesseract/" })
  │     → Tesseract.js loads the core wasm from local files
  │
  ├─4. worker.recognize(croppedDataUrl) → { data: { text } }
  │
  └─5. setPage("TRANSLATE") → shows side-by-side result
```

### 3.3 Translation Flow

```
User clicks "🌐 Translate" (with Quick Translator selected)
  │
  ▼
CropPage.tsx: onClick handler
  │
  ├─1. initQuickTranslator()
  │     ├─► fetch chrome-extension://…/dictionaries/Dictionaries.ini
  │     ├─► Parse file list → preload ALL dictionary files into memory
  │     ├─► FileSystemConfig.setInstance(ExtensionFileSystem)
  │     └─► TranslatorEngine.LoadDictionaries()
  │
  ├─2. translateToVietnamese(extractedText)
  │     ├─► TranslatorEngine.StandardizeInput(text)
  │     ├─► TranslatorEngine.ChineseToHanViet(text) → Hán-Việt
  │     └─► TranslatorEngine.ChineseToVietPhrase(text) → Việt Phrase
  │
  └─3. setTranslatedText(result) → shown in right textarea
```

---

## 4. Key Modules

### 4.1 `src/background/background.ts` — Service Worker

- Listens for `START_CAPTURE` messages
- Uses Chrome DevTools Protocol (CDP) via `chrome.debugger`:
  1. Attach to target tab
  2. Get page layout metrics (`contentSize`)
  3. Override viewport to full content dimensions
  4. Take a full-page screenshot
  5. Restore original viewport
  6. Send the base64 PNG data URL back

**Why `Emulation.setDeviceMetricsOverride`?** Without resizing the viewport, `captureScreenshot` only captures the visible viewport area. By setting the viewport to the full content dimensions, the browser renders the entire page before capturing.

### 4.2 `src/popup/CropPage.tsx` — Main Workspace

The most complex component (~450 lines). Key aspects:

- **Canvas**: Konva `Stage` + `Layer` + `Group(scale)` + `KonvaImage` + `Rect` + `Transformer`
- **Coordinate system**: The `Group` has `scaleX/scaleY = displayScale`, so all child coordinates are in **image-pixel space** (not screen pixels). This simplifies crop extraction.
- **Crop flattening**: After each transformer resize, `onTransformEnd` multiplies the Rect's `scaleX/Y` into its `width/height`, then resets scale to 1. This prevents cumulative transformation errors.
- **OCR**: Tesseract.js worker is loaded from a local blob URL to avoid CSP restrictions.
- **State**: Uses React `useState` — no global state needed for the crop page (the image comes from `chrome.storage.local`).

### 4.3 `src/store/useCaptureStore.ts` — Zustand Store

Simple state machine for the popup capture flow:

```
CAPTURE (idle) → isCapturing=true → CAPTURE (progress) → complete → open crop tab
                                                                   
                         error → display error message
```

### 4.4 `src/translator/quickTranslator.ts` — Translation Engine Adapter

This module bridges the Node.js-oriented `quick-translator-engine` with the browser extension environment.

**Key challenge:** The engine uses synchronous `readFileSync()` calls, but browsers can't do sync file I/O.

**Solution:** The `ExtensionFileSystem` class:
1. **Pre-fetches** all dictionary files into an in-memory `Map<string, string>` cache using async `fetch()`
2. Implements `readFileSync()` by reading from the cache
3. Implements path helpers (`join`, `dirname`, `basename`, `extname`, `isAbsolute`) as pure string functions

```typescript
class ExtensionFileSystem implements IFileSystem {
  private cache = new Map<string, string>();

  async preloadAll(): Promise<void> {
    // 1. Fetch Dictionaries.config (or .ini)
    // 2. Parse file paths from config
    // 3. Fetch all dictionary files into cache
  }

  readFileSync(path: string): string {
    return this.cache.get(path) ?? throw ...;
  }

  join(...paths: string[]): string { /* string join */ }
  // ... other path helpers
}
```

**Loading order:**
1. `preloadAll()` fetches config → parses files → fetches all into cache
2. `FileSystemConfig.setInstance(fs)` — replaces Node.js fs with our adapter
3. `DictionaryConfigurationHelper.setDirectoryPath(url)` — sets path for config lookup
4. `TranslatorEngine.LoadDictionaries()` — uses `readFileSync` which reads from cache

---

## 5. CropPage Component Architecture

### 5.1 State Overview

```typescript
// Image
const [imageUri, setImageUri]     // data URL from chrome.storage
const [imageEl, setImageEl]       // HTMLImageElement (loaded)

// Crop
const [cropRect, setCropRect]     // { x, y, width, height } in image pixels
const [zoom, setZoom]             // 0.1 – 10 (multiplier on base scale)

// OCR
const [isProcessingOcr, setIsProcessingOcr]
const [ocrProgress, setOcrProgress]
const [extractedText, setExtractedText]

// Translation
const [page, setPage]             // "CROP" | "TRANSLATE"
const [translatedText, setTranslatedText]
const [translateEngine, setTranslateEngine]
const [isTranslating, setIsTranslating]

// Layout
const [containerSize, setContainerSize]  // { width, height } of the canvas div
```

### 5.2 Stage Dimensions

```
baseScale = containerWidth / imageWidth
displayScale = baseScale * zoom

imgDisplayW = imageWidth * displayScale
imgDisplayH = imageHeight * displayScale

stageWidth  = max(containerWidth,  imgDisplayW + 200)
stageHeight = max(containerHeight, imgDisplayH + 200)

offsetX = max(0, (stageWidth  - imgDisplayW) / 2)   // centers image
offsetY = max(0, (stageHeight - imgDisplayH) / 2)
```

### 5.3 Crop Extraction

```typescript
const getCroppedCanvas = () => {
  const rect = shapeRef.current;   // Konva.Rect node
  const x = rect.x();               // image-pixel coordinates
  const y = rect.y();
  const w = rect.width() * rect.scaleX();
  const h = rect.height() * rect.scaleY();
  
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(imageEl, x, y, w, h, 0, 0, w, h);
  return canvas;
};
```

### 5.4 Transformer Flattening

After each resize via Transformer, the node's `scaleX/scaleY` accumulates. To prevent runaway scales, `onTransformEnd` flattens them:

```typescript
onTransformEnd={() => {
  const node = shapeRef.current;
  const newW = Math.max(5, node.width() * node.scaleX());
  const newH = Math.max(5, node.height() * node.scaleY());
  node.scaleX(1);
  node.scaleY(1);
  node.width(newW);
  node.height(newH);
  setCropRect({ x: node.x(), y: node.y(), width: newW, height: newH });
}}
```

---

## 6. Translation Engine Integration

### 6.1 Dependency

The translation engine is `quick-translator-engine` from GitHub:

```json
"quick-translator-engine": "github:pearl2201/quick-translator-ts"
```

The `postinstall` script compiles it from TypeScript source:
```json
"postinstall": "cd node_modules/quick-translator-engine && npx --yes tsc"
```

### 6.2 Browser Compatibility Layer

The engine was designed for Node.js and uses:
- `fs.readFileSync` — all dictionary I/O
- `path.join`, `path.dirname`, etc.
- `process.cwd()` — for default directory path
- `Buffer` — in `CharsetDetector`

The `ExtensionFileSystem` in `quickTranslator.ts` solves all of these:
- Pre-fetches files into a cache (async → sync bridge)
- Implements path helpers as string operations
- The `process.cwd()` guard (`typeof process !== 'undefined' ? process.cwd() : '/'`) prevents browser errors

### 6.3 Dictionary Files

Dictionary files are copied from `quick-translator-ts/examples/dictionaries/` into `public/dictionaries/`. They are bundled in the extension and served via `chrome.runtime.getURL('dictionaries/...')`.

Currently loaded dictionaries (from `Dictionaries.ini`):
- `Names.txt`, `Names2.txt` — Name dictionaries
- `VietPhrase.txt`, `VietPhrase2.txt` — Phrase dictionaries
- `ChinesePhienAmWords.txt` — Sino-Vietnamese character dictionary
- `cedict_ts.u8` — CC-CEDICT
- `Babylon.txt`, `LacViet.txt`, `ThieuChuu.txt` — Legacy dictionaries
- `LuatNhan.txt` — Rule-based translation
- `Pronouns.txt` — Pronoun substitution
- `IgnoredChinesePhrases.txt` — Skip-list

---

## 7. Chrome Extension Wiring

### 7.1 Manifest (Manifest V3)

Defined in `manifest.config.ts` (TypeScript, consumed by CRXjs):

```typescript
export default defineManifest({
  manifest_version: 3,
  permissions: ["activeTab", "scripting", "debugger", "storage"],
  background: { service_worker: "src/background/background.ts", type: "module" },
  action: { default_popup: "index.html" },
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
  },
  web_accessible_resources: [{ resources: ["**/*", "*", "tesseract/*"], matches: ["<all_urls>"] }],
});
```

### 7.2 CSP Notes

- `'wasm-unsafe-eval'` is required for Tesseract.js WebAssembly core
- Tesseract worker is loaded via `fetch()` + blob URL to avoid `worker-src` restrictions
- Dictionary files are served from `chrome-extension://` origin (covered by `'self'`)

### 7.3 Vite Configuration

Two-page setup via `rollupOptions.input`:

```typescript
rollupOptions: {
  input: {
    popup: resolve(__dirname, 'index.html'),
    crop: resolve(__dirname, 'crop.html'),
  },
  output: {
    codeSplitting: {
      groups: [
        { name: 'vendor-ocr', test: /tesseract\.js/, priority: 20 },
        { name: 'vendor-canvas', test: /(konva|react-konva)/, priority: 15 },
      ]
    }
  }
}
```

---

## 8. Build & Configuration

### 8.1 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | TypeScript check + Vite production build |
| `npm run lint` | Run oxlint |
| `npm run postinstall` | Build `quick-translator-engine` from source |

### 8.2 Public Assets

Files in `public/` are copied verbatim to `dist/`:

```
public/
├── tesseract/        →  dist/tesseract/     (Tesseract.js worker + wasm)
├── dictionaries/     →  dist/dictionaries/  (translation engine data)
├── favicon.svg       →  dist/favicon.svg
└── icons.svg         →  dist/icons.svg
```

### 8.3 Adding New Dictionary Files

1. Place the file in `public/dictionaries/`
2. Add an entry to `public/dictionaries/Dictionaries.ini`:
   ```ini
   MyDictionary=MyDictionary.txt
   ```
3. The `ExtensionFileSystem.preloadAll()` will automatically pick it up

---

## 9. Troubleshooting Guide

### "process is not defined"

**Cause:** The `quick-translator-engine` has a static initializer with `process.cwd()`.

**Fix:** The source code uses a guard:
```typescript
typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : '/'
```
If you still see this error, rebuild the dependency: `npm run postinstall`.

### "Failed to load tesseract-core-*.wasm.js"

**Cause:** Tesseract.js auto-detects SIMD support and tries different core variants. If the required variant isn't bundled, it fails.

**Fix:** Copy all core variants from `node_modules/tesseract.js-core/` to `public/tesseract/`:
```
tesseract-core-lstm.wasm.js + .wasm
tesseract-core-simd-lstm.wasm.js + .wasm
tesseract-core-relaxedsimd-lstm.wasm.js + .wasm
tesseract-core-relaxedsimd.wasm.js + .wasm
tesseract-core-simd.wasm.js + .wasm
```

### "this.fs.join is not a function"

**Cause:** The `ExtensionFileSystem` class is missing required path helper methods.

**Fix:** Ensure all `IFileSystem` interface methods are implemented: `join`, `dirname`, `basename`, `extname`, `isAbsolute`.

### CSP blocking Tesseract worker

**Cause:** Chrome extension CSP blocks loading scripts from `chrome-extension://` via Web Worker.

**Fix:** The worker is loaded by fetching the file content and creating a blob URL:
```typescript
const blob = await fetch(workerUrl).then(r => r.blob());
const blobUrl = URL.createObjectURL(blob);
// Pass blobUrl as workerPath to createWorker()
```

---

## 10. How to Add a New Translation Engine

### 10.1 Add the engine option

In `CropPage.tsx`, add to the engine selector dropdown:

```tsx
<option value="my-engine">My Engine</option>
```

### 10.2 Add the translate handler

In the translate button's `onClick`, add a condition:

```typescript
if (translateEngine === 'my-engine') {
  setIsTranslating(true);
  try {
    const result = await myEngine.translate(extractedText);
    setTranslatedText(result);
  } catch (err) {
    setTranslatedText('Error: ' + (err as Error).message);
  } finally {
    setIsTranslating(false);
  }
}
```

### 10.3 For the "Quick Translator" option, the integration is in `quickTranslator.ts`

The `ExtensionFileSystem` class handles the browser compatibility layer. If adding another file-based engine, extend the `preloadAll()` method to load additional files.
