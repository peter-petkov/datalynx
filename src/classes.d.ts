/**
 * The classes Datalynx puts on the elements it creates.
 *
 * Every part gets a fixed dlx-* class, which the script and datalynx.css rely on, plus the classes in its plug. The
 * plugs are the hook for skins: a skin fills them with its framework's classes, and is imported before any Datalynx is
 * created. Elements read their plug when they are created, the state plugs (itemActive) whenever their state changes.
 */

/** The parts of a Datalynx that have a class plug. */
export interface Classes {
    /** `<data-lynx>`. A skin that dresses it in a framework's classes includes `dlx-skin` here. */
    host: string;
    /** The `<input>` it enhances (`dlx-input`). */
    input: string;
    /** The popover of suggestions (`dlx-menu`). */
    menu: string;
    /** The `<ul>` of suggestions (`dlx-list`). */
    list: string;
    /** A suggestion's row (`dlx-item`). */
    item: string;
    /** State plug: the row the arrow keys are on, which Enter picks. */
    itemActive: string;
    /** A row's picture before the label, from `data-image` (`dlx-item-image`). */
    image: string;
    /** A row's icon before the label, from `data-icon` (`dlx-item-icon`). */
    icon: string;
    /** A row's label (`dlx-item-label`). */
    label: string;
    /** A row's subtext, from `data-subtext` (`dlx-item-subtext`). */
    subtext: string;
    /** A group of suggestions (`dlx-group`). */
    group: string;
    /** The list of a group's rows (`dlx-group-list`). */
    groupList: string;
    /** A group's label (`dlx-header`). */
    header: string;
    /** A line between suggestions (`dlx-divider`). */
    divider: string;
    /** A skeleton row's content (`dlx-placeholder`). */
    placeholder: string;
    /** The bar inside a skeleton row (`dlx-placeholder-bar`). */
    placeholderBar: string;
    /** How many suggestions match, for screen readers, visually hidden (`dlx-status`). */
    status: string;
}

/** The name of a part with a class plug. */
export type PartName = keyof Classes;

/**
 * The extra classes each part gets, on top of its fixed dlx-* class, as a space-separated string. Empty by default.
 * The same object is `DataLynx.classes`. Fill it before any Datalynx is created.
 */
export const classes: Classes;