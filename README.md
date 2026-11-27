# Datalynx

A drop-in enhancement for an `<input>` with a `<datalist>`: a searchable popover of its suggestions in the look of [Platypicker](https://github.com/peter-petkov/platypicker), with the same search, long lists and languages, while the `<input>` stays the real control. In browsers without support, the browser's own datalist works as before.

Work in progress: not on npm yet. Skins and the phone sheet are still to come.

**[Docs and live examples](https://peter-petkov.github.io/datalynx/)**, with a playground. The page goes online with the first release; until then, serve the repo and open `docs/index.html`.

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

- **Opening.** Typing opens the popover with the suggestions that match. Down, Alt+Down or a click in an input that already has focus open it even when it's empty, with every suggestion. Focusing the input doesn't, by Tab or by the click that focuses it, so moving through a form stays quiet. Emptying the input while the popover is open shows every suggestion again. It closes when nothing matches, on Esc, Alt+Up or a pick, and when focus leaves the input.
- **Search.** As in Platypicker: case and accents don't matter ("zurich" finds Zürich), initials find a suggestion ("nyc" finds New York City), strong matches (where every matched part starts a word) come first, and the matches are highlighted. A suggestion is found by its label, its value, its `data-subtext` and its `data-icon`: "ams", "amsterdam" and "netherlands" all find `<option value="AMS" data-subtext="Netherlands">Amsterdam</option>`.
- **Rows.** A row shows the option's label (its `label` attribute or text, or else its value), its `data-subtext` beside it, and before it an image (`data-image`) or an icon (`data-icon`), as in Platypicker. Hidden and disabled options are left out, as the browser's own datalist leaves out disabled ones.
- **Keyboard.** Focus stays in the input. Down and Up move through the suggestions (Down on a closed input opens it on the first one; Up from the first goes back to what was typed), Page Down and Page Up by a popover's height, Enter picks the active suggestion (without one, Enter does what it does in the input, such as submitting the form), Esc closes and leaves the text. Home and End move the caret, as in any input.
- **Ghost completion.** Opt-in with `ghost`: the faded rest of the first suggestion that starts with what's typed shows after the text, and Tab accepts it. See [Ghost completion](#ghost-completion).
- **Long lists.** Rows are shown a batch at a time (`batch-size`, 50 by default) and more as the list scrolls, so a datalist of thousands of options opens at once.
- **Live changes.** Options added, removed or changed in the datalist show up, also while the popover is open, where the active suggestion stays active.
- **Accessibility.** The input is a combobox (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant`) controlling a listbox of options. Screen readers hear how many suggestions match once typing pauses. Forced colors (Windows High Contrast) are supported.
- **The browser's own datalist.** Chrome and Firefox show their datalist popup whenever an input has a `list`, so while Datalynx enhances an input it takes its `list` attribute off and sets `autocomplete="off"` (Firefox would show the input's form history instead), and puts both back as they were when it's removed. Meanwhile `input.list` is null; the element's `datalist` property has the datalist. Turning `autocomplete` off also turns off the browser's autofill for that input.

## Attributes

| Attribute    | Type    | Default | Description |
|--------------|---------|---------|-------------|
| `batch-size` | number  | `50`    | How many suggestions the list works with at a time: the rows shown first, and how far ahead it searches. More rows are shown a few at a time as you scroll. `0` renders them all. A missing or invalid value uses the default. |
| `strict`     | boolean | off     | Text that matches no suggestion makes the input invalid, left as typed; a match in another case or with other accents, or a suggestion's label, is corrected to its value on change. See [Validation](#validation). |
| `ghost`      | boolean | off     | The faded rest of the first suggestion that starts with what's typed shows after the text; Tab accepts it. See [Ghost completion](#ghost-completion). |

They're reflected as the `batchSize`, `strict` and `ghost` properties.

## Validation

An input with a datalist takes free text, and Datalynx never rejects or clears what's typed. With `strict`, text that matches no suggestion makes the input invalid (`setCustomValidity`), so the form won't submit, the browser shows "Please enter a value from the list." and `:user-invalid` and `:invalid` apply:

```html
<form>
  <data-lynx strict>
    <input name="airport" list="airports" required>
  </data-lynx>
  <button>Book</button>
</form>
<datalist id="airports">
  <option value="SOF" data-subtext="Bulgaria">Sofia</option>
  <option value="ZRH" data-subtext="Switzerland">Zürich</option>
</datalist>
```

- **What matches.** The text, trimmed, with case and accents folded as search folds them, is a suggestion's value ("sof" or "Sof" for `SOF`), or the label of exactly one suggestion ("zurich" for Zürich). A label two or more suggestions share matches none of them. When the text is one suggestion's value and another's label, the value wins. Hidden and disabled options don't count.
- **The correction.** On `change` (leaving the field, or Enter), a match that isn't the exact value becomes it: "zurich" turns into `ZRH`, firing `input` and `change` as a pick does. With several suggestions of the same folded value, the first one's.
- **Empty is valid.** Use `required` for a field that must be filled.
- **When it's checked.** On `input`, `change`, focus out and a form reset, when the datalist's options change, when `strict` is turned on, and in the element's current language. A script that sets `input.value` fires no event, so Datalynx doesn't see it: dispatch one after it, `input.dispatchEvent(new Event("input", { bubbles: true }))`.
- **The page's own messages.** Turning `strict` off, or removing the element, clears Datalynx's message. A message the page set itself with `setCustomValidity` is left alone, neither replaced nor cleared.

Datalynx doesn't style the invalid input; the page does, for example:

```css
data-lynx input:user-invalid {
  border-color: crimson;
}
```

## Ghost completion

With `ghost`, the faded rest of a suggestion shows after what's typed, followed by a small Tab key cap, and Tab accepts it. Nothing goes into the value until it's accepted:

```html
<data-lynx ghost>
  <input name="city" list="cities">
</data-lynx>
```

- **What ghosts.** The first suggestion, in the popover's order, whose label or value starts with the text, with case and accents folded as search folds them: "zur" ghosts "ich" for Zürich, and "stras" ghosts "e des 17. Juni" for Straße des 17. Juni (ß searches as "ss", so the ghost starts after it). The text stays as typed; only the rest is drawn. When both the label and the value start with the text, the label's rest. Initials ("nyc") and matches inside a word ("rich") never ghost, nor does a text that already equals a suggestion. With an active suggestion (Down, Up), the ghost follows it while it starts with the text.
- **Accepting.** Tab accepts the ghost and keeps focus in the field. The input takes the suggestion's exact value, which for a ghost of its label is the value ("zur" on `<option value="ZRH">Zürich</option>` gives `ZRH`), with the caret at the end, and fires `input` (`inputType: "insertReplacementText"`) as typing would; `change` follows when the field is left. On a touch screen a tap on the ghost accepts it; a mouse click only puts the caret at the end. Enter, the arrows and End keep their meaning.
- **When it shows.** While the input has focus, once something was typed since it got focus, with the caret at the end, nothing selected and no IME composition going on, with the popover open or closed. Esc hides it, with the popover, until the next keystroke, and so does accepting: Tab right after accepting moves on, so it never chains completions, and someone who is only tabbing through a form is never caught.
- **The look.** The ghost is drawn over the input in its font, in the input's text color at 40 % (`--datalynx-ghost-color`), and never runs past the field's edge, nor under a search field's clear button. The key cap says `tabKey` ("Tab"), and hides on touch devices. Accepting plays a short sweep from the ghost color to the text color; with reduced motion the value just appears. Under forced colors the ghost is `GrayText`. Arabic and other joining scripts are drawn apart until accepted.
- **Screen readers.** The ghost and the key cap are hidden from them (`aria-hidden`): the suggestions are in the listbox already. Accepting is announced: the new value, politely.

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
| `--datalynx-ghost-color`        | the ghost and its key cap (the input's text color at 40 %) |

The colors follow the page's `color-scheme`, light or dark. Every part has a fixed `dlx-*` class (`dlx-menu`, `dlx-list`, `dlx-item`, `dlx-item-image`, `dlx-item-icon`, `dlx-item-label`, `dlx-item-subtext`, `dlx-status`, and for `ghost` `dlx-ghost`, `dlx-ghost-text`, `dlx-ghost-key`; the input gets `dlx-input`), and a class plug in `DataLynx.classes` (see `src/classes.js`), filled before the elements are created, as in Platypicker.

## Localization

Datalynx follows the nearest `lang` attribute, with translations for the same 22 languages as Platypicker, loaded only when needed. It has three texts:

| Text           | English                             | Where |
|----------------|-------------------------------------|-------|
| `matchesLabel` | {count} match, {count} matches      | read out to screen readers once typing pauses |
| `invalidValue` | Please enter a value from the list. | the message of a `strict` input whose text matches no suggestion |
| `tabKey`       | Tab                                 | the key cap after a ghost; "Tab" in every language, as software names the key |

Change them in `DataLynx.languageMap` (English) or `DataLynx.languages` (by language code), as in Platypicker.

## JavaScript API

```js
import DataLynx from "datalynx";

DataLynx.get(document.querySelector("input[name=fruit]")); // the Datalynx enhancing an input
DataLynx.defaultBatchSize = 100;                            // for elements without batch-size
DataLynx.languageMap.matchesLabel = { one: "{count} suggestion", other: "{count} suggestions" };
DataLynx.languages.de = { matchesLabel: "{count} Vorschläge" };
DataLynx.classes.menu = "my-menu";
document.querySelector("data-lynx").strict = true;          // see Validation
document.querySelector("data-lynx").ghost = true;           // see Ghost completion
```

`<data-lynx>` has the custom state `:state(open)` while its popover is open. Types come with the package (`src/datalynx.d.ts`).

## Browser support

Datalynx needs anchor positioning with `anchor-scope`, the popover attribute and the CSS Custom Highlight API: Chrome and Edge 135 and later, current Firefox, Safari 27 and later. Elsewhere `<data-lynx>` does nothing and the browser's own datalist works. So far checked in Chrome, Firefox and WebKit on a desktop; Safari and phones aren't tested yet.

## License

Datalynx is released under the [MIT License](LICENSE).