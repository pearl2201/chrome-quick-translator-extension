import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: "Quick Translator JS",
  version: "1.0.0",
  description: "Full-page capture, OCR, and Chinese-to-Vietnamese translation engine.",
  permissions: [
    "activeTab",
    "scripting",
    "debugger",
    "storage"
  ],
  background: {
    // FIX: Targets raw source file directly with relative tracking
    service_worker: "src/background/background.ts",
    type: "module"
  },
  content_scripts: [
    {
      "matches": [
        "<all_urls>"
      ],
      "js": [
        // FIX: Replaced compiled string wrapper back to clean source path
        "src/content/content.ts"
      ]
    }
  ],
  action: {
    default_popup: "index.html"
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
        "tesseract/*"
      ],
      "use_dynamic_url": false
    }
  ]
})
