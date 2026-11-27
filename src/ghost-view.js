"use strict";

import { addClasses } from "./classes.js";

/**
 * The ghost completion's overlay: the faded rest of a suggestion drawn right after the input's text, over the input,
 * never in its value. It's hidden from screen readers (aria-hidden): what the ghost offers is in the listbox already.
 *
 * The overlay lies over the input's border box (anchored to it, as the popover is), padded by the input's borders and
 * padding, in the input's font. Inside, the typed text is laid out again, invisible, where the input lays out its own
 * (start, center or end, and from the start once it overflows, moved by the input's scroll); the rest hangs off its
 * end, so the typed part shapes and measures exactly as in the input, whatever the alignment or direction. The clip
 * keeps the rest inside the input's content box, short of a search field's clear button.
 *
 * DataLynx decides when a ghost shows and what it says; this only draws it. A press on the rest goes out through
 * `actions.press(pointerType)`.
 */
export default class GhostView {
    // A search field's clear button can't be measured: about this many ems at the end of the content box while the
    // field has text.
    static #clearButton = 1.4;

    // What decides where and how the input draws its text, copied onto the overlay.
    static #fontProperties = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "fontStretch", "fontVariant",
        "fontFeatureSettings", "fontVariationSettings", "fontKerning", "fontOpticalSizing", "letterSpacing",
        "wordSpacing", "textTransform", "textRendering", "direction"];

    #input;
    #actions;
    #abort = new AbortController();
    #resizeObserver;

    #overlay;
    #clip;
    #typed;
    #typedText;             // The typed text, invisible: where the input draws its own.
    #rest;
    #restText;
    #state = null;          // What shows: { rest }, or null.

    constructor({ input, actions, signal }) {
        this.#input = input;
        this.#actions = actions;
        signal?.addEventListener("abort", () => this.destroy(), { once: true });

        this.#overlay = document.createElement("div");
        addClasses(this.#overlay, "ghost");
        this.#overlay.setAttribute("aria-hidden", "true");
        this.#overlay.hidden = true;

        this.#clip = document.createElement("div");
        this.#clip.className = "dlx-ghost-clip";
        this.#typed = document.createElement("span");
        this.#typed.className = "dlx-ghost-typed";
        this.#typedText = document.createElement("span");
        this.#typedText.className = "dlx-ghost-typed-text";
        this.#rest = document.createElement("span");
        addClasses(this.#rest, "ghostText");
        this.#restText = document.createTextNode("");

        this.#rest.append(this.#restText);
        this.#typed.append(this.#typedText, this.#rest);
        this.#clip.append(this.#typed);
        this.#overlay.append(this.#clip);
        input.insertAdjacentElement("afterend", this.#overlay);

        this.#wire();
    }

    destroy() {
        this.#abort.abort();
        this.#resizeObserver?.disconnect();
        this.#overlay.remove();
        this.#state = null;
    }

    #wire() {
        const { signal } = this.#abort;
        const input = this.#input;

        // The rest follows the input's text as it scrolls, and its box as it changes size.
        input.addEventListener("scroll", () => this.#layout(), { signal, passive: true });
        this.#resizeObserver = new ResizeObserver(() => this.#layout());
        this.#resizeObserver.observe(input);

        // A press on the rest keeps focus in the input. What it does is up to DataLynx (a tap accepts, a click puts
        // the caret at the end), once the press is a click, so a touch that starts a scroll does nothing.
        let pointerType = "";
        this.#rest.addEventListener("pointerdown", e => {
            pointerType = e.pointerType;
        }, { signal });
        this.#rest.addEventListener("mousedown", e => e.preventDefault(), { signal });
        this.#rest.addEventListener("click", e => {
            e.preventDefault();
            this.#actions.press(e.pointerType || pointerType);
        }, { signal });
    }

    /** Whether a ghost is drawn. */
    get isShown() {
        return this.#state !== null;
    }

    /** Draws the rest of a suggestion after the input's text: { rest }, or null to draw nothing. */
    show(state) {
        this.#state = state;
        this.#layout();
    }

    #layout() {
        const state = this.#state;
        this.#overlay.hidden = !state;
        if (!state) return;

        const input = this.#input;
        const cs = getComputedStyle(input);
        const overlay = this.#overlay.style;

        // Its padding box is the input's content box, and its type the input's.
        const sides = {};
        for (const side of ["Top", "Right", "Bottom", "Left"]) {
            sides[side] = parseFloat(cs[`border${side}Width`]) + parseFloat(cs[`padding${side}`]);
            overlay[`padding${side}`] = `${sides[side]}px`;
        }
        for (const property of GhostView.#fontProperties) overlay[property] = cs[property];
        overlay.color = cs.color; // what the ghost color is mixed from
        // Above the input, also when the page lifts the input (as an input group does on focus).
        overlay.zIndex = cs.position !== "static" && cs.zIndex !== "auto" ? cs.zIndex : "";

        const rtl = cs.direction === "rtl";
        const align = cs.textAlign;
        const toEnd = align === "end" || align === (rtl ? "left" : "right");
        // Text longer than the field lays out from its start, as the input's does; its scroll moves it.
        const overflowing = input.scrollWidth > input.clientWidth;
        this.#clip.style.justifyContent = overflowing || !(toEnd || align === "center") ? "flex-start"
            : align === "center" ? "center" : "flex-end";
        this.#typed.style.transform = `translateX(${-input.scrollLeft}px)`;

        if (this.#typedText.textContent !== input.value) this.#typedText.textContent = input.value;
        if (this.#restText.data !== state.rest) this.#restText.data = state.rest;

        // The rest stops at the content box's end, and short of a search field's clear button.
        const clearButton = input.type === "search" && input.value
            ? GhostView.#clearButton * parseFloat(cs.fontSize) : 0;
        const width = input.offsetWidth - sides.Left - sides.Right - clearButton;
        this.#clip.style.width = `${Math.max(0, width)}px`;
    }
}