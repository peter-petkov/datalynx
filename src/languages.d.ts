import type { CountedText } from "burrowkit/languages.js";

export type { CountedText, PluralForms } from "burrowkit/languages.js";

/** The texts of a Datalynx, in one language. */
export interface Texts {
    /** What screen readers hear once typing pauses: how many suggestions match. */
    matchesLabel: CountedText;
}

/**
 * Languages registered by the page, by code ("de", "pt-BR"). Each wins over a shipped translation of the same
 * language, text by text. The same object is `DataLynx.languages`.
 */
export const languages: Record<string, Partial<Texts>>;