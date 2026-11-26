// The modules the README imports by path, which have no .d.ts of their own. datalynx.d.ts references this file, so
// importing datalynx brings them in.

/**
 * One of Datalynx's translations, as an object of texts. A Datalynx loads it on its own when it needs it; import it to
 * bundle it instead, and register it: `DataLynx.languages.de = de`.
 */
declare module "datalynx/src/languages/*.js" {
    const texts: import("./languages.js").Texts;
    export default texts;
}