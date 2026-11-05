# PDF.js 6.5.438

Source: official npm package `pdfjs-dist@6.5.438`, https://www.npmjs.com/package/pdfjs-dist

Project: https://mozilla.github.io/pdf.js/

License: Apache-2.0, included in `LICENSE`. Font and WASM components retain their own bundled notices.

Selected unmodified distribution files support the local archive's PDF renderer. Main module and worker are loaded only when previewing a PDF; CMaps, fonts and WASM are fetched as needed. There is no runtime CDN dependency for PDF viewing. See `archive-preview.js` for the integration.
