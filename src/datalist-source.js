"use strict";

import FilteredView, { SearchCache } from "burrowkit/filtered-view.js";

/**
 * One suggestion: an <option> of the datalist as the list reads it.
 */
export class SuggestionEntry {
    group = null;           // A datalist has no groups.
    dividerBefore = false;  // Nor dividers.

    constructor(option) {
        this.option = option;
    }

    /** What picking it puts in the input. */
    get value() {
        return this.option.value;
    }

    /** What its row shows: its label attribute, its text, or else its value. */
    get label() {
        return this.option.label.trim() || this.option.value;
    }

    get subtext() {
        return (this.option.dataset.subtext ?? "").trim();
    }

    /** The URL of the picture before the label (data-image), or "". */
    get image() {
        return (this.option.dataset.image ?? "").trim();
    }

    /** The text shown before the label (data-icon), such as an emoji, or "". */
    get icon() {
        return (this.option.dataset.icon ?? "").trim();
    }

    get title() {
        return this.option.title;
    }
}

/**
 * The suggestions of a Datalynx, read from the <option>s of a <datalist>. Options that are hidden or disabled are left
 * out, as the browser's own datalist leaves out disabled ones.
 */
export default class DatalistSource {
    #datalist;
    #entries = [];
    #entriesByOption = new WeakMap();
    #observer;
    // Folded and prepared texts, kept to a few times the number of entries.
    #cache = new SearchCache(() => 4 * this.#entries.length + 100);

    // What search matches a suggestion by, the strongest first: its label, its value (which is what's typed, even
    // where the row shows a label instead), its subtext and its icon.
    static #texts = entry => [entry.label, entry.value, entry.subtext, entry.icon];

    constructor(datalist) {
        this.#datalist = datalist;
        this.rebuild();
    }

    get datalist() {
        return this.#datalist;
    }

    /** The suggestions, in list order. */
    get entries() {
        return this.#entries;
    }

    /** Reads the datalist's options again. Entries of options that are still there keep their identity. */
    rebuild() {
        const entries = [];
        for (const option of this.#datalist.querySelectorAll("option")) {
            if (option.hidden || option.disabled) continue;

            let entry = this.#entriesByOption.get(option);
            if (!entry) this.#entriesByOption.set(option, entry = new SuggestionEntry(option));
            entries.push(entry);
        }
        this.#entries = entries;
    }

    /**
     * The suggestions matching what's typed, found lazily. The query is trimmed and folded for the locale (see
     * Search.fold); an empty one matches all. Strong matches come first.
     */
    filter(query, locale = "") {
        return new FilteredView(this.#entries, query, {
            fold: text => this.#cache.fold(text, locale),
            prepare: text => this.#cache.prepare(text, locale),
            texts: DatalistSource.#texts,
        });
    }

    /** Folds a text (see Search.fold), remembering it. */
    fold(text, locale = "") {
        return this.#cache.fold(text, locale);
    }

    /**
     * Calls back whenever the datalist's options change in a way that can show in the list. The call says only that
     * something changed; rebuild() reads the new state. Several changes made in one go arrive as one call.
     */
    observe(callback) {
        this.#observer?.disconnect();

        this.#observer = new MutationObserver(() => callback());
        this.#observer.observe(this.#datalist, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ["value", "label", "disabled", "hidden", "title", "data-subtext", "data-image", "data-icon"],
        });
    }

    /** Whether the options changed in a way the observer hasn't reported yet. */
    takePendingChanges() {
        return (this.#observer?.takeRecords().length ?? 0) > 0;
    }

    disconnect() {
        this.#observer?.disconnect();
        this.#observer = null;
    }
}