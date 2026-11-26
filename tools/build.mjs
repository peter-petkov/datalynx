// Writes dist/, Datalynx bundled into single files, each with a source map into src/:
//
//   node tools/build.mjs        (or npm run build)
//
//   datalynx.js            the element, with every translation, as a plain script that sets window.DataLynx
//   datalynx.esm.js        the same, as a module whose default export is the element class
//   datalynx.css           the stylesheet
//
// and each of them minified too, as .min.js and .min.css (datalynx.esm.min.js, datalynx.min.css). Skins get builds of
// their own once there are any.
//
// The work is Burrowkit's (burrowkit/tools/build.mjs); this file holds Datalynx's settings.
import { fileURLToPath } from "node:url";
import { build } from "burrowkit/tools/build.mjs";

await build({
    root: fileURLToPath(new URL("..", import.meta.url)),
    name: "datalynx",
    global: "DataLynx",
    entry: "datalynx.js",
    css: "datalynx.css",
});