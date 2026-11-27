"use strict";

import { addClasses } from "./classes.js";

/**
 * The ghost completion's overlay: the faded rest of a suggestion drawn right after the input's text, over the input,
 * never in its value, followed by a key hint ("Tab"). It's hidden from screen readers (aria-hidden): what the ghost
 * offers is in the listbox already.
 *
 * The overlay lies over the input's border box (anchored to it, as the popover is), padded by the input's borders and
 * padding, in the input's font. Inside, the typed text is laid out again, invisible, where the input lays out its own
 * (start, center or end, and from the start once it overflows, moved by the input's scroll); the rest hangs off its
 * end, so the typed part shapes and measures exactly as in the input, whatever the alignment or direction. The clip
 * keeps the rest inside the input's content box, short of a search field's clear button.
 *
 * Once a ghost is accepted, the sweep: for a moment the overlay draws the whole new value over the input, whose own
 * text turns transparent, the accepted part changing from the ghost color to the text color along its length.
 *
 * DataLynx decides when a ghost shows and what it says; this only draws it. A press on the rest goes out through
 * `actions.press(pointerType)`.
 */
export default class GhostView {
    // A search field's clear button can't be measured: about this many ems at the end of the content box while the
    // field has text.
    static #clearButton = 1.4;

    static #sweepDuration = 220;

    // What decides where and how the input draws its text, copied onto the overlay.
    static #fontProperties = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "fontStretch", "fontVariant",
        "fontFeatureSettings", "fontVariationSettings", "fontKerning", "fontOpticalSizing", "letterSpacing",
        "wordSpacing", "textTransform", "textRendering", "direction"];

    // What the sweep sets on the input to hide its own text, put back as it was afterwards.
    static #hidingProperties = ["color", "-webkit-text-fill-color", "caret-color"];

    static #noHover = matchMedia("(hover: none)");
    static #reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    static #forcedColors = matchMedia("(forced-colors: active)");

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
    #key;
    #state = null;          // What shows: { rest, key }, or null.
    #sweep = null;          // The sweep that runs: { prefix, accepted, hidden, hadStyle, animation }, or null.
    #touch = false;         // Whether the last press anywhere was a touch, which hides the key hint.

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
        this.#key = document.createElement("span");
        addClasses(this.#key, "ghostKey");

        this.#rest.append(this.#restText, this.#key);
        this.#typed.append(this.#typedText, this.#rest);
        this.#clip.append(this.#typed);
        this.#overlay.append(this.#clip);
        input.insertAdjacentElement("afterend", this.#overlay);

        this.#wire();
    }

    destroy() {
        this.#endSweep();
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

        // Typing, or leaving the field, ends a sweep at once.
        for (const type of ["beforeinput", "compositionstart", "blur"])
            input.addEventListener(type, () => this.#endSweep(), { signal });

        // A touch screen has no Tab key to hint at: the hint hides on devices without hover, and after a touch.
        document.addEventListener("pointerdown", e => {
            this.#touch = e.pointerType === "touch";
        }, { signal, capture: true, passive: true });

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

    /** Draws the rest of a suggestion after the input's text, and the key hint: { rest, key }, or null for none. */
    show(state) {
        this.#state = state;
        this.#layout();
    }

    /**
     * Plays the sweep over an accepted ghost, once the input holds the new value: `prefix` is the start of the value
     * that was typed already, which stays in the text color, and `accepted` the rest of it, which sweeps. Nothing
     * plays with reduced motion or forced colors: the value just appears.
     */
    sweep(prefix, accepted) {
        this.#endSweep();
        // Forced colors keep the input's own text in the system color, which the sweep couldn't hide.
        if (!accepted || GhostView.#reducedMotion.matches || GhostView.#forcedColors.matches) return;

        const input = this.#input;
        const cs = getComputedStyle(input);
        // Read now: computed styles are live, and these change once the text turns transparent.
        const ink = cs.color;
        const caret = cs.caretColor === "auto" ? ink : cs.caretColor;
        const rtl = cs.direction === "rtl";

        // The ghost color, as the rest is painted now.
        this.#sweep = { prefix, accepted };
        this.#layout();
        const ghostColor = getComputedStyle(this.#rest).color;

        // The input's own text turns transparent, its caret staying as it was; the overlay draws the value instead.
        const hadStyle = input.hasAttribute("style");
        const hidden = {};
        for (const name of GhostView.#hidingProperties)
            hidden[name] = [input.style.getPropertyValue(name), input.style.getPropertyPriority(name)];
        input.style.setProperty("color", "transparent", "important");
        input.style.setProperty("-webkit-text-fill-color", "transparent", "important");
        input.style.setProperty("caret-color", caret, "important");
        this.#sweep.hidden = hidden;
        this.#sweep.hadStyle = hadStyle;

        // A gradient of the two colors, twice as wide as the text and clipped to it, slides across it from its start.
        this.#overlay.classList.add("dlx-ghost-sweeping");
        this.#rest.style.backgroundImage = `linear-gradient(${rtl ? "to left" : "to right"}, ${ink} 50%, ${ghostColor} 50%)`;
        const animation = this.#rest.animate(
            [{ backgroundPosition: rtl ? "0% 0" : "100% 0" }, { backgroundPosition: rtl ? "100% 0" : "0% 0" }],
            { duration: GhostView.#sweepDuration, easing: "ease-in-out" });
        this.#sweep.animation = animation;
        animation.finished.then(() => this.#endSweep(), () => {});
    }

    #endSweep() {
        const sweep = this.#sweep;
        if (!sweep) return;

        this.#sweep = null;
        sweep.animation?.cancel();
        this.#overlay.classList.remove("dlx-ghost-sweeping");
        this.#rest.style.backgroundImage = "";
        for (const [name, [value, priority]] of Object.entries(sweep.hidden ?? {})) {
            if (value) this.#input.style.setProperty(name, value, priority);
            else this.#input.style.removeProperty(name);
        }
        // An input that had no style attribute is left without one. WebKit writes the attribute lazily, and would
        // bring it back empty after the removal unless it's read first.
        if (!sweep.hadStyle && !this.#input.style.length) {
            this.#input.getAttribute("style");
            this.#input.removeAttribute("style");
        }
        this.#layout();
    }

    #layout() {
        const sweep = this.#sweep;
        const state = this.#state;
        this.#overlay.hidden = !sweep && !state;
        if (this.#overlay.hidden) return;

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
        // What the ghost color is mixed from, and what the sweep draws in. The input's own is transparent meanwhile.
        if (!sweep?.hidden) overlay.color = cs.color;
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

        const typed = sweep ? sweep.prefix : input.value;
        const rest = sweep ? sweep.accepted : state.rest;
        if (this.#typedText.textContent !== typed) this.#typedText.textContent = typed;
        if (this.#restText.data !== rest) this.#restText.data = rest;

        const key = sweep ? "" : state.key;
        if (this.#key.textContent !== key) this.#key.textContent = key;
        this.#key.hidden = !key || this.#touch || GhostView.#noHover.matches;

        // The rest stops at the content box's end, and short of a search field's clear button.
        const clearButton = input.type === "search" && input.value
            ? GhostView.#clearButton * parseFloat(cs.fontSize) : 0;
        const width = input.offsetWidth - sides.Left - sides.Right - clearButton;
        this.#clip.style.width = `${Math.max(0, width)}px`;
    }
}