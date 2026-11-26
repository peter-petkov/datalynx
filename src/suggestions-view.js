"use strict";

import createDecorations from "burrowkit/decorations.js";
import RowList from "burrowkit/list.js";
import { addClasses, fixedClass, toggleClasses } from "./classes.js";

// The images (data-image) and icons (data-icon) of the rows, with Datalynx's classes.
const { hideBrokenImages, syncIcon, syncImage } = createDecorations({ addClasses, fixedClass });

/**
 * The popover of suggestions under the input, and the active row in it.
 *
 * Focus never leaves the input: the rows are options of a listbox the input controls, and the one the arrow keys are
 * on is the active one, which the input names with aria-activedescendant and Enter picks. The rows come from
 * Burrowkit's RowList (batches as the list scrolls, reconciling when the datalist changes). What the user does goes
 * out through `actions.pick`. It never changes the input itself.
 */
export default class SuggestionsView {
    static #lastId = 0;

    #input;
    #source;
    #actions;
    #signal;

    #popover;
    #rowList;
    #list;
    #status;                // Tells screen readers how many suggestions match, once typing pauses.
    #announceTimer;
    #config = {};
    #active = null;         // The record of the active row, or null.
    #lastRowId = 0;

    constructor({ input, source, highlighter, actions, signal }) {
        this.#input = input;
        this.#source = source;
        this.#actions = actions;
        this.#signal = signal;

        this.#popover = document.createElement("div");
        addClasses(this.#popover, "menu");
        this.#popover.popover = "manual";
        this.#popover.id = `datalynx-${++SuggestionsView.#lastId}`;
        input.insertAdjacentElement("afterend", this.#popover);

        this.#rowList = new RowList({
            container: this.#popover,
            classes: { addClasses, fixedClass },
            highlighter,
            signal,
            hooks: {
                createRow: () => this.#createRow(),
                updateRow: record => this.#updateRow(record),
                highlightRow: (record, view) => this.#highlightRow(record, view),
                scroller: () => this.#popover,
            },
        });
        this.#list = this.#rowList.element;
        this.#list.id = `${this.#popover.id}-list`;

        // A polite live region, visually hidden, which screen readers read out when its text changes.
        this.#status = document.createElement("div");
        addClasses(this.#status, "status");
        this.#status.setAttribute("role", "status");

        this.#popover.append(this.#list, this.#status);
        this.#wire();
    }

    get popover() {
        return this.#popover;
    }

    /** The id of the listbox, which the input names in aria-controls. */
    get listId() {
        return this.#list.id;
    }

    destroy() {
        clearTimeout(this.#announceTimer);
        this.#rowList.destroy();
        this.#popover.remove();
        this.#input.removeAttribute("aria-activedescendant");
    }

    #wire() {
        const signal = this.#signal;

        // A press on the popover keeps focus in the input, so picking a row or scrolling the list doesn't close it.
        this.#popover.addEventListener("mousedown", e => e.preventDefault(), { signal });

        this.#list.addEventListener("click", e => {
            const record = this.#rowList.recordOfElement(e.target.closest(`.${fixedClass("item")}`));
            if (record) this.#actions.pick(record.entry);
        }, { signal });

        hideBrokenImages(this.#list, ["image"], signal);
    }

    /** Applies the settings: { batchSize, locale, matchesLabel }. */
    configure(config) {
        this.#config = config;
        this.#rowList.configure({ batchSize: config.batchSize });
    }

    // -----------------------------------------------------------------
    // Rendering
    // -----------------------------------------------------------------

    /**
     * Shows the suggestions matching a folded query, from the first batch, with no row active. Screen readers hear
     * how many match once typing pauses.
     */
    show(query) {
        this.#rowList.show(this.#source.filter(query, this.#config.locale));
        this.#setActive(null);
        this.#popover.scrollTop = 0;

        clearTimeout(this.#announceTimer);
        this.#announceTimer = setTimeout(() => this.#announce(), 500);
    }

    /**
     * Brings the rows up to date after the source has read the datalist again, touching only what changed, as
     * RowList.reconcile does. The active row stays active while its suggestion is still shown.
     */
    reconcile(query) {
        const active = this.#active?.entry;
        this.#rowList.reconcile(this.#source.filter(query, this.#config.locale));
        this.#setActive(this.#rowList.recordOf(active) ?? null);
    }

    /** Whether nothing matches, so there's nothing to show. */
    get isEmpty() {
        return !this.#rowList.rows.length && !this.#rowList.hasMore;
    }

    /** Called once the popover is on screen, which is when the list can fill it. */
    opened() {
        this.#rowList.scheduleTopUp();
    }

    #announce() {
        const view = this.#rowList.view;
        if (!view?.query || this.#signal.aborted || !this.#popover.matches(":popover-open")) {
            this.#status.textContent = "";
            return;
        }

        this.#rowList.syncSetSize();
        this.#status.textContent = this.#config.matchesLabel(view.count());
    }

    /**
     * Makes a row: an option of the listbox, with an id for aria-activedescendant, and its content in this order:
     * image, icon, label, subtext. The image and icon are made by #updateRow, only for a suggestion that has one.
     */
    #createRow() {
        const li = document.createElement("li");
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", "false");
        li.id = `${this.#popover.id}-${++this.#lastRowId}`;
        addClasses(li, "item");

        const label = document.createElement("span");
        addClasses(label, "label");
        const text = document.createTextNode("");
        label.append(text);

        const small = document.createElement("small");
        addClasses(small, "subtext");

        li.append(label, small);
        return { element: li, image: null, icon: null, label, text, small };
    }

    /** Brings a row up to date with its suggestion, writing only what differs. */
    #updateRow(record) {
        const { entry, element, label, text, small } = record;

        if (text.data !== entry.label) text.data = entry.label;
        if (small.textContent !== entry.subtext) small.textContent = entry.subtext;
        if (element.title !== entry.title) element.title = entry.title;
        record.icon = syncIcon(record.icon, entry.icon, "icon", label);
        record.image = syncImage(record.image, entry.image, "image", record.icon ?? label);
    }

    /** Highlights what's typed in the label and the subtext. A match only in the value shows nowhere. */
    #highlightRow(record, view) {
        const { entry, element, text, small } = record;
        this.#rowList.highlightText(view, element, "text", text);

        const subtext = entry.subtext.toLowerCase();
        if (subtext && subtext !== entry.label.toLowerCase())
            this.#rowList.highlightText(view, element, "subtext", small.firstChild);
    }

    // -----------------------------------------------------------------
    // The active row
    // -----------------------------------------------------------------

    /** The suggestion of the active row, or null. */
    get activeEntry() {
        return this.#active?.entry ?? null;
    }

    /**
     * Moves the active row by `step` rows (see RowList.move): Down from none makes the first row active, Up from none
     * the last. Up from the first row leaves none active, back to what was typed.
     */
    move(step) {
        if (step < 0 && this.#active && this.#active === this.#rowList.rows[0]) {
            this.#setActive(null);
            return;
        }
        this.#setActive(this.#rowList.move(this.#active, step) ?? null);
    }

    /** Moves the active row by pages (-1 or 1), as Page Up and Page Down do (see RowList.jump). */
    jump(pages) {
        this.#setActive(this.#rowList.jump(this.#active, pages) ?? null);
    }

    /** Clears the active row. */
    clearActive() {
        this.#setActive(null);
    }

    #setActive(record) {
        const previous = this.#active;
        if (previous === record) return;

        if (previous) {
            previous.element.setAttribute("aria-selected", "false");
            toggleClasses(previous.element, "itemActive", false);
        }

        this.#active = record;
        if (!record) {
            this.#input.removeAttribute("aria-activedescendant");
            return;
        }

        record.element.setAttribute("aria-selected", "true");
        toggleClasses(record.element, "itemActive", true);
        this.#input.setAttribute("aria-activedescendant", record.element.id);
        this.#rowList.reveal(record.element, false);
    }
}