# Chrome Quick Translator Extension

A Chrome extension that captures full-page screenshots, crops regions of interest, performs OCR (Optical Character Recognition), and translates detected text — all within a popup UI built with **React**, **Konva**, and **Tesseract.js**.

## Features

- **Full-Page Capture** — Uses the Chrome DevTools Protocol (CDP) via `chrome.debugger` to stitch and capture the entire page content beyond the visible viewport.
- **Interactive Crop Workspace** — Drag and resize a selection rectangle over the captured image using **React Konva** with transformer handles. Choose between PNG and JPEG export formats.
- **OCR Text Extraction** — Run **Tesseract.js** in-browser to extract text from the selected crop region.
- **Translation Pipeline** — Displays extracted text and prepares it for translation (pluggable integration point for external translation engines).
- **Zustand State Management** — Lightweight, type-safe store drives the capture → crop → OCR/translate workflow.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19, TypeScript |
| Build | Vite + CRXjs (Chrome Extension Vite plugin) |
| Styling | Tailwind CSS v4 |
| Canvas | Konva + react-konva |
| OCR | Tesseract.js |
| State | Zustand |
| Chrome APIs | `debugger`, `activeTab`, `scripting`, `runtime` |

## Project Structure

```
src/
├── App.tsx                          # Main popup UI — routes between CAPTURE / CROP / OCR_TRANSLATE steps
├── main.tsx                         # Entry point
├── index.css                        # Global styles (Tailwind)
├── background/
│   └── background.ts                # Service worker — handles full-page capture via CDP
├── content/
│   └── content.ts                   # Content script (injected into web pages)
├── popup/
│   ├── CropWorkspace.tsx            # Image cropping UI with Konva stage + transformer
│   └── TranslateWorkspace.tsx       # Displays OCR output and translation result
└── store/
    └── useCaptureStore.ts           # Zustand store — manages capture state, progress, and step transitions
```

## Workflow

1. **CAPTURE** — Click "Capture Full Page" to take a screenshot of the entire active tab via the Chrome Debugger API. A progress bar shows stitching status.
2. **CROP** — The full-page image is displayed in a Konva stage. Drag/resize the selection rectangle to choose a region, then click **OCR & Translate Selection**.
3. **OCR_TRANSLATE** — Tesseract.js extracts text from the cropped area. The extracted text is shown alongside a placeholder for a translation engine (see [quick-translator-ts](https://github.com/pearl2201/quick-translator-ts)).

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

This starts the Vite dev server. Load the `dist/` folder as an unpacked extension in `chrome://extensions` (with Developer Mode enabled).

### Build

```bash
npm run build
```

Outputs the production-ready extension to the `dist/` directory.

### Lint

```bash
npm run lint
```

## Chrome Extension Setup

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder after building

The extension requires the following permissions (defined in `manifest.json`):
- `activeTab` — Access the current active tab
- `scripting` — Inject content scripts
- `debugger` — Capture full-page screenshots via CDP

## Pluggable Translation

The translation step in `TranslateWorkspace.tsx` contains a placeholder ready to integrate with an external translation library. The recommended integration point is:

```
https://github.com/pearl2201/quick-translator-ts
```

Replace the simulated pipeline in `TranslateWorkspace.tsx` with your translation engine import to enable real text translation.

## License

MIT
