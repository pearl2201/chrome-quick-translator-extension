import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: "Quick Translator JS",
  version: "1.0.0",
  description: "Full-page capture, OCR, and Chinese-to-Vietnamese translation engine.",
  permissions: [
    "activeTab",     // Access the current tab for screenshot capture via chrome.tabs
    "scripting",     // Inject content scripts and execute scripts for OCR/translation
    "debugger",      // Chrome DevTools Protocol — full-page screenshot via Page.captureScreenshot
    "storage"        // Persist user settings (default engine, Gemini API key, thinking level)
  ],
  background: {
    // FIX: Targets raw source file directly with relative tracking
    service_worker: "src/background/background.ts",
    type: "module"
  },
  content_scripts: [
    {
      "matches": [
        "<all_urls>"  // Run on every page to enable translation features
      ],
      "js": [
        // FIX: Replaced compiled string wrapper back to clean source path
        "src/content/content.ts"  // Injected content script for DOM interaction
      ]
    }
  ],
  // Top-level icons for Chrome management/Web Store
  icons: {
    '16': 'icons/extension-icon.png',
    '48': 'icons/extension-icon.png',
    '128': 'icons/extension-icon.png',
  },
  action: {
    default_popup: "index.html",
    // Icons for the browser toolbar button
    default_icon: {
      '16': 'icons/extension-icon.png',
      '32': 'icons/extension-icon.png',
      '48': 'icons/extension-icon.png',
    },
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
  },
  web_accessible_resources: [
    {
      "matches": [
        "<all_urls>"
      ],
      "resources": [
        "**/*",
        "*",
        "tesseract/*",
        "models/*",
        "wasm/*"
      ],
      "use_dynamic_url": false
    }
  ]
})
