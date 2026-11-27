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

    /**
     * The suggestion a text stands for, as strict sees it, or null. Compared trimmed and folded (case and accents
     * don't matter, as in search): the first suggestion whose value is the text, or else the one suggestion whose
     * label is. A label that two or more suggestions share matches none of them.
     */
    match(text, locale = "") {
        const folded = this.fold(text.trim(), locale);
        if (!folded) return null;

        const fold = text => this.fold(text.trim(), locale);
        const byValue = this.#entries.find(entry => fold(entry.value) === folded);
        if (byValue) return byValue;

        const byLabel = this.#entries.filter(entry => fold(entry.label) === folded);
        return byLabel.length === 1 ? byLabel[0] : null;
    }

    /**
     * The ghost completion for a text as typed, or null: the suggestion it completes to and the rest of that
     * suggestion's label or value after it, as { entry, rest, covered, from: "label" | "value" }, where `covered` is
     * the part of that label or value the typed text stands for.
     *
     * A suggestion completes the text when its label or value, folded, starts with the folded text and is longer
     * than it; the label's rest is taken when both do. Given `entry` (the active row), only that suggestion is
     * tried. Otherwise the first in the popover's order: such a suggestion matches the search strongly (its first
     * letter starts it), and strong matches come first in list order, so it's the first in list order, also when its
     * row isn't rendered yet.
     */
    ghost(text, locale = "", entry = null) {
        const query = this.fold(text, locale);
        if (!query) return null;

        const complete = entry => {
            for (const from of ["label", "value"]) {
                const target = entry[from];
                const folded = this.fold(target, locale);
                if (folded.length <= query.length || !folded.startsWith(query)) continue;

                const split = DatalistSource.#split(this.#cache.prepare(target, locale), target, query);
                if (split.rest) return { entry, from, ...split };
            }
            return null;
        };

        if (entry) return complete(entry);
        for (const entry of this.#entries) {
            const ghost = complete(entry);
            if (ghost) return ghost;
        }
        return null;
    }

    // Splits a text that starts with the folded query into what the query covers and the rest. When the query ends
    // partway into a letter that folds to more than one unit ("stras" in Straße, ß being "ss"), that letter counts as
    // covered, so the rest starts after it.
    static #split({ starts, ends }, text, query) {
        const n = query.length;
        const at = !starts ? n : starts[n] === starts[n - 1] ? ends[n - 1] : starts[n];
        return { covered: text.slice(0, at), rest: text.slice(at) };
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