/// <reference path="./modules.d.ts" />
import type { Classes } from "./classes.js";
import type { Texts } from "./languages.js";

export type { Classes, PartName } from "./classes.js";
export type { CountedText, PluralForms, Texts } from "./languages.js";

/**
 * `<data-lynx>`: enhances the `<input list="…">` inside it with a popover of its `<datalist>`'s suggestions. The input
 * stays the control: its value, events and form submission are its own. While enhanced, the input's `list` attribute
 * is taken off (see `datalist`) and its `autocomplete` is `off`; both come back on disconnect.
 */
export default class DataLynx extends HTMLElement {
    /** The Datalynx that enhances a given `<input>`, if there is one. */
    static get(input: HTMLInputElement): DataLynx | undefined;
    /** How many rows are rendered at a time, for elements without a `batch-size`. Default 50. */
    static defaultBatchSize: number;
    /** The extra classes each part gets, on top of its fixed `dlx-*` class. Fill it before any Datalynx is created. */
    static classes: Classes;
    /** The texts, in English, for a Datalynx whose language has no translation, and whatever a language leaves out. */
    static languageMap: Texts;
    /** Languages of the page's own, by code, which win over Datalynx's translations text by text. */
    static languages: Record<string, Partial<Texts>>;
    static readonly observedAttributes: string[];

    /** The `<datalist>` the suggestions come from (the input's own `list` is taken off while it's enhanced). */
    readonly datalist: HTMLDataListElement | null;
    /** The `batch-size` attribute: rows per batch, 0 for all at once. */
    batchSize: number;
    /** The `strict` attribute: text that matches no suggestion makes the input invalid (it stays as typed). */
    strict: boolean;
}

declare global {
    interface HTMLElementTagNameMap {
        "data-lynx": DataLynx;
    }
}