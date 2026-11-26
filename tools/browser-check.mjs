// Opens the docs page in your installed Firefox (or Chrome), or in Playwright's WebKit, headless, and reports what that
// browser supports of what Datalynx uses and how many inputs it enhanced:
//
//   node tools/browser-check.mjs [firefox|chrome|webkit] [--page docs/index.html#labels] [--run script.js] [--shot out.png]
//
// The work is Burrowkit's (burrowkit/tools/browser-check.mjs, which explains the options); this file holds Datalynx's
// settings.
import { fileURLToPath } from "node:url";
import { check } from "burrowkit/tools/browser-check.mjs";

await check({
    root: fileURLToPath(new URL("..", import.meta.url)),
    enhanced: "data-lynx > input.dlx-input",
});