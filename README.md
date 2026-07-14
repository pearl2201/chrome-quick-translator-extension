# Chrome Quick Translator Extension

A Chrome extension that captures full-page screenshots, interactively crops regions of interest, performs OCR via Tesseract.js, and translates detected text — all within a popup + dedicated crop workspace UI built with **React 19**, **Konva**, and **Tailwind CSS v4**.

> **Chinese → Vietnamese translation** powered by [quick-translator-ts](https://github.com/pearl2201/quick-translator-ts) engine with bundled dictionary files.

---

## Features

- **Full-Page Screenshot** — Uses Chrome DevTools Protocol (`chrome.debugger`) to resize the viewport to the full content size and capture everything in a single PNG.
- **Interactive Crop Workspace** — Opens a dedicated browser tab with the full-page image displayed in a **Konva** stage. Drag/resize a selection rectangle with transformer handles to select a region.
- **Zoom & Pan** — Zoom in/out (10%–1000%) for precise crop control. Scroll to pan when zoomed in.
- **OCR (Optical Character Recognition)** — Runs **Tesseract.js v7** entirely in-browser to extract text from the cropped selection.
- **Translation** — Integrates with [quick-translator-ts](https://github.com/pearl2201/quick-translator-ts) engine for Chinese → Vietnamese (Hán-Việt and Việt Phrase) translation. Pluggable engine selector supports future backends (Gemini, HachimiMT).
- **Full-screen Translate View** — Side-by-side extracted text and translation with full-screen mode and PDF download.
- **Image Export** — Save the cropped selection as PNG or JPEG.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19, TypeScript 6 |
| Build | Vite 8 + CRXjs (Chrome Extension plugin) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Canvas | Konva + react-konva |
| OCR | Tesseract.js v7 |
| Translation | [quick-translator-ts](https://github.com/pearl2201/quick-translator-ts) |
| State | Zustand |
| Chrome APIs | `debugger`, `activeTab`, `scripting`, `storage`, `runtime` |

---

## Project Structure

```
chrome-quick-translator-extension/
├── crop.html                         # Standalone crop workspace page
├── index.html                        # Popup entry HTML
├── manifest.config.ts                # Chrome extension manifest (CRXjs)
├── vite.config.ts                    # Vite configuration
├── package.json
├── tsconfig.json / tsconfig.app.json
│
├── public/
│   ├── tesseract/                    # Bundled Tesseract.js worker + wasm
│   │   ├── worker.min.js
│   │   ├── tesseract-core-*.wasm.js  # (5 variants)
│   │   └── tesseract-core-*.wasm     # (5 variants)
│   └── dictionaries/                 # quick-translator-ts dictionary files
│       ├── Dictionaries.ini / .config
│       ├── Names.txt, VietPhrase.txt, …
│       └── (subdirectories: Cokiem2, PanguDict, …)
│
└── src/
    ├── main.tsx                      # Popup entry point
    ├── App.tsx                       # Popup UI — capture button + progress
    ├── index.css                     # Global styles + Tailwind import
    │
    ├── crop-main.tsx                 # Crop workspace entry point
    ├── popup/
    │   ├── CropPage.tsx              # Full crop/OCR/translate workspace
    │   ├── CropWorkspace.tsx         # (legacy)
    │   └── TranslateWorkspace.tsx    # (legacy)
    │
    ├── background/
    │   └── background.ts             # Service worker — CDP capture
    │
    ├── content/
    │   └── content.ts                # Content script (injected into pages)
    │
    ├── store/
    │   └── useCaptureStore.ts        # Zustand store
    │
    └── translator/
        └── quickTranslator.ts        # quick-translator-ts browser adapter
```

---

## Workflow

```
Popup (App.tsx)
  │  Click "Capture Full Page"
  ▼
Background (background.ts)
  │  Attach debugger → Emulation.setDeviceMetricsOverride → captureScreenshot
  │  → Restore viewport → Send CAPTURE_COMPLETE
  ▼
Popup stores image → opens crop.html tab
  │
  ▼
CropPage.tsx (dedicated tab)
  ├── Stage 1: CROP
  │     Display full-page image in Konva stage
  │     Drag/resize selection rectangle
  │     ✂ Crop → replace image with cropped region
  │     📝 Get Text → run Tesseract.js OCR
  │     Zoom in/out controls
  │
  ├── Stage 2: OCR loading overlay
  │
  └── Stage 3: TRANSLATE
        Side-by-side: extracted text | translated text
        Select engine: Quick Translator / HachimiMT / Gemini
        🌐 Translate → run quick-translator-ts
        ⛶ Fullscreen / 📄 Download PDF
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

The `postinstall` script automatically builds the `quick-translator-engine` dependency from source.

### Development

```bash
npm run dev
```

Load the `dist/` folder as an unpacked extension in `chrome://extensions` (Developer Mode).

### Build

```bash
npm run build
```

Outputs to `dist/`.

### Lint

```bash
npm run lint
```

---

## Chrome Extension Setup

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select the `dist/` folder

### Required Permissions

| Permission | Purpose |
|-----------|---------|
| `activeTab` | Access the current active tab for capture |
| `scripting` | Inject content scripts |
| `debugger` | Full-page screenshot via Chrome DevTools Protocol |
| `storage` | Pass captured image data between popup and crop tab |

---

## Key Dependencies

| Package | Purpose | Source |
|---------|---------|--------|
| `tesseract.js` | Browser-based OCR | npm |
| `react-konva` + `konva` | Interactive canvas stage + transformer | npm |
| `quick-translator-engine` | Chinese→Vietnamese translation | GitHub |
| `zustand` | Lightweight state management | npm |
| `@crxjs/vite-plugin` | Chrome extension Vite integration | npm |

---

## Architecture

For a deep dive into the codebase, see **[ARCHITECTURE.md](./ARCHITECTURE.md)** — covers:

- Data flow diagrams (capture → crop → OCR → translate)
- Component architecture (CropPage state, Konva stage sizing, transformer flattening)
- Translation engine compatibility layer (sync → async bridge)
- Chrome extension wiring (Manifest V3, CSP, service worker)
- Troubleshooting guide
- How to add new translation engines

---

## License

MIT
