# Datalynx

A drop-in enhancement for an `<input>` with a `<datalist>`: a searchable popover of its suggestions in the look of [Platypicker](https://github.com/peter-petkov/platypicker), with the same search, long lists and languages, while the `<input>` stays the real control. In browsers without support, the browser's own datalist works as before.

Work in progress: not on npm yet. Skins and the phone sheet are still to come.

## Usage

Wrap the `<input>` in `<data-lynx>`; its `<datalist>` can be anywhere in the page:

```html
<link rel="stylesheet" href="node_modules/datalynx/src/datalynx.css">
<script type="module">import "datalynx";</script>

<data-lynx>
  <input name="fruit" list="fruits">
</data-lynx>
<datalist id="fruits">
  <option value="Apple" data-icon="🍎"></option>
  <option value="Banana" data-icon="🍌"></option>
  <option value="LHR" data-subtext="United Kingdom">London Heathrow</option>
</datalist>
```

The input keeps its value, its form submission and its own `input` and `change` events: type anything, or pick a suggestion, which puts its value in the input as typing it would. Datalynx doesn't style the input; it keeps the page's look.

## How it behaves

- **Opening.** Typing opens the popover with the suggestions that match. Down, Alt+Down or a click in the input open it even when it's empty, with every suggestion. Focus alone doesn't open it, so tabbing through a form stays quiet. It closes when nothing matches, when the input is emptied, on Esc, Alt+Up or a pick, and when focus leaves the input.
- **Search.** As in Platypicker: case and accents don't matter ("zurich" finds Zürich), initials find a suggestion ("nyc" finds New York City), strong matches (where every matched part starts a word) come first, and the matches are highlighted. A suggestion is found by its label, its value, its `data-subtext` and its `data-icon`: "ams", "amsterdam" and "netherlands" all find `<option value="AMS" data-subtext="Netherlands">Amsterdam</option>`.
- **Rows.** A row shows the option's label (its `label` attribute or text, or else its value), its `data-subtext` beside it, and before it an image (`data-image`) or an icon (`data-icon`), as in Platypicker. Hidden and disabled options are left out, as the browser's own datalist leaves out disabled ones.
- **Keyboard.** Focus stays in the input. Down and Up move through the suggestions (Down on a closed input opens it on the first one; Up from the first goes back to what was typed), Page Down and Page Up by a popover's height, Enter picks the active suggestion (without one, Enter does what it does in the input, such as submitting the form), Esc closes and leaves the text. Home and End move the caret, as in any input.
- **Long lists.** Rows are shown a batch at a time (`batch-size`, 50 by default) and more as the list scrolls, so a datalist of thousands of options opens at once.
- **Live changes.** Options added, removed or changed in the datalist show up, also while the popover is open, where the active suggestion stays active.
- **Accessibility.** The input is a combobox (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant`) controlling a listbox of options. Screen readers hear how many suggestions match once typing pauses. Forced colors (Windows High Contrast) are supported.
- **The browser's own datalist.** Chrome and Firefox show their datalist popup whenever an input has a `list`, so while Datalynx enhances an input it takes its `list` attribute off and sets `autocomplete="off"` (Firefox would show the input's form history instead), and puts both back as they were when it's removed. Meanwhile `input.list` is null; the element's `datalist` property has the datalist. Turning `autocomplete` off also turns off the browser's autofill for that input.

## Attributes

| Attribute    | Type   | Default | Description |
|--------------|--------|---------|-------------|
| `batch-size` | number | `50`    | How many suggestions the list works with at a time: the rows shown first, and how far ahead it searches. More rows are shown a few at a time as you scroll. `0` renders them all. A missing or invalid value uses the default. |

It's reflected as the `batchSize` property.

## Theming

Variables, set on `data-lynx` or any ancestor:

| Variable                        | What it colors or sizes |
|---------------------------------|-------------------------|
| `--datalynx-bg`                 | the popover's background |
| `--datalynx-color`              | text |
| `--datalynx-muted-color`        | subtexts |
| `--datalynx-header-color`       | group labels |
| `--datalynx-border-color`       | lines inside the popover |
| `--datalynx-field-border-color` | the popover's border |
| `--datalynx-hover-bg`           | a row under the pointer, or active |
| `--datalynx-accent-color`       | the active row's outline |
| `--datalynx-highlight-bg`       | search match background |
| `--datalynx-highlight-color`    | search match text |
| `--datalynx-radius`             | rows (`6px`) |
| `--datalynx-menu-radius`        | the popover (`8px`) |
| `--datalynx-shadow`             | the popover's shadow |
| `--datalynx-max-height`         | the popover's height limit (`45vh`) |
| `--datalynx-image-size`         | a row's image, and its icon's width (`1.25em`) |

The colors follow the page's `color-scheme`, light or dark. Every part has a fixed `dlx-*` class (`dlx-menu`, `dlx-list`, `dlx-item`, `dlx-item-image`, `dlx-item-icon`, `dlx-item-label`, `dlx-item-subtext`, `dlx-status`; the input gets `dlx-input`), and a class plug in `DataLynx.classes` (see `src/classes.js`), filled before the elements are created, as in Platypicker.

## Localization

Datalynx follows the nearest `lang` attribute, with translations for the same 22 languages as Platypicker, loaded only when needed. It has one text:

| Text           | English                        | Where |
|----------------|--------------------------------|-------|
| `matchesLabel` | {count} match, {count} matches | read out to screen readers once typing pauses |

Change it in `DataLynx.languageMap` (English) or `DataLynx.languages` (by language code), as in Platypicker.

## JavaScript API

```js
import DataLynx from "datalynx";

DataLynx.get(document.querySelector("input[name=fruit]")); // the Datalynx enhancing an input
DataLynx.defaultBatchSize = 100;                            // for elements without batch-size
DataLynx.languageMap.matchesLabel = { one: "{count} suggestion", other: "{count} suggestions" };
DataLynx.languages.de = { matchesLabel: "{count} Vorschläge" };
DataLynx.classes.menu = "my-menu";
```

`<data-lynx>` has the custom state `:state(open)` while its popover is open. Types come with the package (`src/datalynx.d.ts`).

## Browser support

Datalynx needs anchor positioning with `anchor-scope`, the popover attribute and the CSS Custom Highlight API: Chrome and Edge 135 and later, current Firefox, Safari 27 and later. Elsewhere `<data-lynx>` does nothing and the browser's own datalist works. So far checked in Chrome, Firefox and WebKit on a desktop; Safari and phones aren't tested yet.

## License

Datalynx is released under the [MIT License](LICENSE).