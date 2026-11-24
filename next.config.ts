import type { NextConfig } from "next";

// The OCR child is launched by filename, outside Next's module graph.
const ocrPackages = ["bmp-js","is-url","wasm-feature-detect","regenerator-runtime","zlibjs",
  "sharp","@img/colour","@img/sharp-*","detect-libc","semver"];
const config: NextConfig = {
  devIndicators: false,
  agentRules: false,
  outputFileTracingIncludes: {
    "/api/session": [
      "./server/ocr-worker.mts","./server/ocr-result.ts",
      "./lib/accounts.ts","./lib/config.ts","./lib/loans.ts","./lib/locations.ts",
      "./node_modules/tesseract.js/package.json","./node_modules/tesseract.js/src/**/*",
      "./node_modules/tesseract.js-core/package.json",...["tesseract-core","tesseract-core-simd","tesseract-core-relaxedsimd"].flatMap(core =>
        ["", "-lstm"].flatMap(suffix => ["js","wasm"].map(ext => "./node_modules/tesseract.js-core/" + core + suffix + "." + ext))),
      "./node_modules/@tesseract.js-data/eng/index.js","./node_modules/@tesseract.js-data/eng/package.json","./node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz",
      ...ocrPackages.map(name => "./node_modules/" + name + "/**/*"),
    ],
    "/api/verification/samples/*": ["./server/samples/*.png"],
  },
};
export default config;
