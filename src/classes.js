"use strict";

import createClasses from "burrowkit/classes.js";

/**
 * The classes Datalynx puts on the elements it creates.
 *
 * Every part gets a fixed dlx-* class, which the script and datalynx.css rely on, plus the classes in its plug below.
 * The plugs are the hook for skins: a skin fills them with its framework's classes, and is imported before any
 * Datalynx is created. Elements read their plug when they are created, the state plugs (itemActive, itemDisabled)
 * whenever their state changes.
 */
export const classes = {
    host: "",           // <data-lynx>
    input: "",          // the <input> it enhances
    menu: "",           // the popover of suggestions
    list: "",           // the <ul> of suggestions
    item: "",           // a suggestion's row
    itemActive: "",     // the row the arrow keys are on, which Enter picks
    image: "",          // a row's picture before the label (data-image)
    icon: "",           // a row's icon before the label (data-icon)
    label: "",          // a row's label
    subtext: "",        // a row's subtext (data-subtext)
    group: "",          // a group of suggestions: its header and the list of its rows
    groupList: "",      // the list of a group's rows
    header: "",         // a group's label
    divider: "",        // a line between suggestions
    placeholder: "",    // a skeleton row's content
    placeholderBar: "", // the bar inside it
    status: "",         // how many suggestions match, for screen readers (visually hidden)
    ghost: "",          // the ghost completion's overlay over the input (ghost)
    ghostText: "",      // the ghosted rest of a suggestion, after what's typed
    ghostKey: "",       // the key hint after the ghost ("Tab")
};

const fixed = {
    input: "dlx-input",
    menu: "dlx-menu",
    list: "dlx-list",
    item: "dlx-item",
    image: "dlx-item-image",
    icon: "dlx-item-icon",
    label: "dlx-item-label",
    subtext: "dlx-item-subtext",
    group: "dlx-group",
    groupList: "dlx-group-list",
    header: "dlx-header",
    divider: "dlx-divider",
    placeholder: "dlx-placeholder",
    placeholderBar: "dlx-placeholder-bar",
    status: "dlx-status",
    ghost: "dlx-ghost",
    ghostText: "dlx-ghost-text",
    ghostKey: "dlx-ghost-key",
};

/** The helpers that put a part's fixed dlx-* class and its plug on an element (see Burrowkit's classes.js). */
export const { fixedClass, addClasses, removeClasses, toggleClasses } = createClasses(fixed, classes);