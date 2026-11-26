"use strict";

import Highlighter from "burrowkit/highlighter.js";
import Languages from "burrowkit/languages.js";
import Search from "burrowkit/search.js";
import { addClasses, classes, removeClasses } from "./classes.js";
import DatalistSource from "./datalist-source.js";
import translations, { languages } from "./languages.js";
import SuggestionsView from "./suggestions-view.js";

/**
 * <data-lynx>: enhances the <input list="…"> inside it with a popover of its <datalist>'s suggestions, searched the
 * way Platypicker searches (folding, initials, strong matches first). The input stays the control: its value, its
 * events and what screen readers see are its own, with the ARIA combobox pattern on top. Without browser support it
 * does nothing, and the browser's own datalist works as before.
 */
export default class DataLynx extends HTMLElement {
    static #registry = new WeakMap(); // <input> -> DataLynx instance

    // While the popover is open, changes to the datalist are applied once they pause for #reconcileDelay milliseconds.
    static #reconcileDelay = 50;

    /** How many rows are rendered at a time. A batch-size attribute on the element overrides it. */
    static defaultBatchSize = 50;

    /**
     * The extra classes each part gets, on top of its fixed dlx-* class. A skin fills these with a framework's
     * classes, and must be imported before any Datalynx is created. See classes.js for the parts.
     */
    static classes = classes;

    /**
     * The texts, in English, for a Datalynx whose language has no translation, and for whatever a language leaves out.
     */
    static languageMap = {
        // What screen readers hear once typing pauses: how many suggestions match.
        matchesLabel: { one: "{count} match", other: "{count} matches" },
    };

    /**
     * Languages of the page's own, by code ("de", "pt-BR"): each an object of texts like languageMap. A Datalynx uses
     * the one of its nearest lang attribute, over Datalynx's own translation of it, if there is one.
     */
    static languages = languages;

    /** The Datalynx that enhances a given <input>, if there is one. */
    static get(input) {
        return DataLynx.#registry.get(input);
    }

    // What Datalynx needs, as datalynx.css checks too: anchor positioning with anchor-scope, which keeps each popover on
    // its own input, and the popover attribute. Browsers without them keep the native datalist.
    static #isSupported = CSS.supports("anchor-scope", "all") && CSS.supports("selector(:popover-open)");

    static observedAttributes = ["batch-size"];

    #internals;
    #input;
    #datalist;
    #source;
    #highlighter;
    #view;
    #abort;
    #given = null;          // The input's own list and autocomplete attributes, put back on disconnect.
    #locale = "";           // Its language: its nearest lang attribute.
    #texts = null;          // The texts for it, as far as they're loaded.
    #stale = false;         // Whether the datalist changed since the list last caught up with it.
    #reconcileTimer;
    #picking = false;       // Whether the input events of a pick are being fired.

    constructor() {
        super();
        this.#internals = this.attachInternals();
    }

    // -----------------------------------------------------------------
    // Custom element lifecycle
    // -----------------------------------------------------------------

    connectedCallback() {
        this.#input = this.querySelector(":scope > input");
        this.#datalist = this.#input?.list ?? null;

        // Defined by a plain script in the head, the element connects while the page is still being read, before its
        // input or datalist is, so it waits for the rest of the page.
        if ((!this.#input || !this.#datalist) && document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => this.isConnected && this.connectedCallback(),
                { once: true });
            return;
        }

        if (!this.#input || !this.#datalist || DataLynx.#registry.has(this.#input)) return;

        if (!DataLynx.#isSupported) return; // graceful degradation: the native datalist works as before

        this.#abort = new AbortController();
        this.#syncLanguage();

        addClasses(this, "host");
        addClasses(this.#input, "input");

        this.#source = new DatalistSource(this.#datalist);
        this.#highlighter = new Highlighter("datalynx-highlight");
        this.#view = new SuggestionsView({
            input: this.#input,
            source: this.#source,
            highlighter: this.#highlighter,
            signal: this.#abort.signal,
            actions: { pick: entry => this.#pick(entry) },
        });
        this.#view.configure(this.#viewConfig());

        this.#takeOverList();

        // The ARIA combobox pattern: focus stays in the input, which controls the listbox of suggestions.
        this.#input.setAttribute("role", "combobox");
        this.#input.setAttribute("aria-autocomplete", "list");
        this.#input.setAttribute("aria-controls", this.#view.listId);
        this.#input.setAttribute("aria-expanded", "false");

        this.#wireInput();
        this.#source.observe(() => this.#datalistChanged());

        DataLynx.#registry.set(this.#input, this);
    }

    disconnectedCallback() {
        if (!this.#input || DataLynx.#registry.get(this.#input) !== this) return;

        this.#abort.abort();
        clearTimeout(this.#reconcileTimer);
        this.#source.disconnect();
        this.#highlighter.clear();
        this.#view.destroy();
        this.#internals.states.delete("open");

        DataLynx.#registry.delete(this.#input);

        for (const name of ["role", "aria-autocomplete", "aria-controls", "aria-expanded"])
            this.#input.removeAttribute(name);
        this.#giveBackList();
        removeClasses(this.#input, "input");
        removeClasses(this, "host");

        this.#input = this.#datalist = this.#source = this.#highlighter = this.#view = null;
    }

    attributeChangedCallback() {
        this.#view?.configure(this.#viewConfig());
    }

    /** The <datalist> the input's suggestions come from. The input's own `list` is taken off while it's enhanced. */
    get datalist() {
        return this.#datalist;
    }

    /**
     * How many suggestions the list works with at a time: the rows shown first, and how far ahead it searches. More
     * rows are shown a few at a time as the list scrolls. 0 renders them all, and a missing or invalid value means the
     * default.
     */
    get batchSize() {
        const value = this.getAttribute("batch-size")?.trim();

        return /^\d+$/.test(value ?? "") ? Number(value) : DataLynx.defaultBatchSize;
    }

    set batchSize(value) {
        this.setAttribute("batch-size", value);
    }

    #viewConfig() {
        return {
            batchSize: this.batchSize,
            locale: this.#locale,
            matchesLabel: count => Languages.format(this.#text("matchesLabel"), count, this.#locale),
        };
    }

    #text(name) {
        return (this.#texts ?? DataLynx.languageMap)[name];
    }

    /**
     * Takes the texts of the element's language, as far as they're loaded, and again once a translation it waits for
     * has loaded. Runs when it connects and each time the popover opens, which is when a changed lang is picked up.
     */
    #syncLanguage() {
        const locale = Languages.of(this);
        const { texts, ready } = translations.texts(locale, DataLynx.languageMap);

        this.#locale = locale;
        this.#texts = texts;
        this.#view?.configure(this.#viewConfig());

        ready?.then(() => {
            if (this.#view && Languages.of(this) === locale) this.#syncLanguage();
        });
    }

    // -----------------------------------------------------------------
    // The browser's own datalist
    // -----------------------------------------------------------------

    /**
     * Keeps the browser's own suggestions away while Datalynx shows its own. Chrome and Firefox show their datalist
     * popup whenever the input has a list, whatever CSS or autocomplete say, so the list attribute comes off; and
     * Firefox then shows the input's form history instead, unless autocomplete is off. Both are put back as they were
     * on disconnect (see #giveBackList).
     */
    #takeOverList() {
        const input = this.#input;
        this.#given = { list: input.getAttribute("list"), autocomplete: input.getAttribute("autocomplete") };
        input.removeAttribute("list");
        input.setAttribute("autocomplete", "off");
    }

    #giveBackList() {
        const input = this.#input;
        for (const [name, value] of Object.entries(this.#given ?? {})) {
            if (value === null) input.removeAttribute(name);
            else input.setAttribute(name, value);
        }
        this.#given = null;
    }

    // -----------------------------------------------------------------
    // Opening, closing, picking
    // -----------------------------------------------------------------

    get #isOpen() {
        return this.#view.popover.matches(":popover-open");
    }

    /** What's typed, folded for searching. */
    #query() {
        return Search.fold(this.#input.value.trim(), this.#locale);
    }

    /**
     * Opens the popover with the suggestions matching what's typed (all of them for an empty input), unless none
     * match. Returns whether it's open.
     */
    #open() {
        if (this.#isOpen) return true;

        this.#syncLanguage();
        this.#catchUp(true);
        this.#view.show(this.#query());
        if (this.#view.isEmpty) return false;

        this.#view.popover.showPopover();
        this.#internals.states.add("open");
        this.#input.setAttribute("aria-expanded", "true");
        this.#view.opened();
        return true;
    }

    #close() {
        if (!this.#isOpen) return;

        this.#view.popover.hidePopover();
        this.#view.clearActive();
        this.#internals.states.delete("open");
        this.#input.setAttribute("aria-expanded", "false");
    }

    /** Shows what matches the text as it is now, closing when nothing does. */
    #refilter() {
        this.#view.show(this.#query());
        if (this.#view.isEmpty) this.#close();
    }

    /** Puts a suggestion's value in the input, as typing it would, and closes. */
    #pick(entry) {
        const input = this.#input;

        this.#close();
        if (input.value !== entry.value) {
            input.value = entry.value;
            this.#picking = true;
            try {
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
            } finally {
                this.#picking = false;
            }
        }
        input.focus({ preventScroll: true });
    }

    #wireInput() {
        const { signal } = this.#abort;
        const input = this.#input;

        // Typing opens it, and narrows it down. An emptied input closes it; Down or a click brings every suggestion.
        input.addEventListener("input", () => {
            if (this.#picking) return;

            if (!input.value.trim()) this.#close();
            else if (this.#isOpen) this.#refilter();
            else this.#open();
        }, { signal });

        input.addEventListener("click", () => this.#open(), { signal });

        // Focus leaving the input closes it. A press on the popover keeps focus in the input (see SuggestionsView).
        input.addEventListener("blur", () => this.#close(), { signal });

        input.addEventListener("keydown", e => {
            if (e.isComposing || e.ctrlKey || e.metaKey) return;

            if (e.altKey) {
                // Alt+Down opens, Alt+Up closes, as on a native select.
                if (e.code === "ArrowDown") {
                    e.preventDefault();
                    this.#open();
                } else if (e.code === "ArrowUp" && this.#isOpen) {
                    e.preventDefault();
                    this.#close();
                }
                return;
            }

            switch (e.code) {
                case "ArrowDown":
                case "ArrowUp":
                    e.preventDefault();
                    // Down opens it on the first suggestion, as Chrome's own datalist does.
                    if (!this.#isOpen) {
                        if (e.code === "ArrowDown" && this.#open()) this.#view.move(1);
                        return;
                    }
                    this.#view.move(e.code === "ArrowDown" ? 1 : -1);
                    return;

                case "PageDown":
                case "PageUp":
                    if (!this.#isOpen) return;
                    e.preventDefault();
                    this.#view.jump(e.code === "PageDown" ? 1 : -1);
                    return;

                case "Enter":
                case "NumpadEnter": {
                    // Picks the active suggestion, rather than submitting the form; without one, Enter does what it
                    // does in the input.
                    const entry = this.#isOpen && this.#view.activeEntry;
                    if (!entry) return;
                    e.preventDefault();
                    this.#pick(entry);
                    return;
                }

                case "Escape":
                    // Closes, and leaves the text. On a closed popover Esc does what the input does.
                    if (!this.#isOpen) return;
                    e.preventDefault();
                    this.#close();
                    return;
            }
        }, { signal });
    }

    // -----------------------------------------------------------------
    // The datalist changing
    // -----------------------------------------------------------------

    #datalistChanged() {
        this.#stale = true;
        if (!this.#isOpen) return;

        clearTimeout(this.#reconcileTimer);
        this.#reconcileTimer = setTimeout(() => this.#catchUp(), DataLynx.#reconcileDelay);
    }

    /**
     * Applies pending changes to the datalist, if there are any. While open, the rows are brought up to date in place;
     * as it opens (`opening`), the source is read again and the list rendered afresh.
     */
    #catchUp(opening = false) {
        clearTimeout(this.#reconcileTimer);

        if (!this.#source) return;
        if (this.#source.takePendingChanges()) this.#stale = true;
        if (!this.#stale) return;

        this.#stale = false;
        this.#source.rebuild();
        if (opening || !this.#isOpen) return;

        this.#view.reconcile(this.#query());
        if (this.#view.isEmpty) this.#close();
    }
}

customElements.define("data-lynx", DataLynx);