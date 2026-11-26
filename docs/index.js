// Datalynx's docs page. What the family's docs pages share (theme switch, examples printed from their templates, code
// panels, navigation, version, support notice) comes from Burrowkit's docs/page.js; theme.js applied the saved theme
// in <head>. Platypicker is loaded for the page's own selects (the section picker on narrow screens), not by Datalynx.
import {
    codePanel, eventLog, printHTML, setupCodeBlocks, setupExamples, setupNavigation, setupSupportNotice, setupTheme,
    setupTheming, setupVersion
} from "burrowkit/docs/page.js";

// ---------------------------------------------------------------------------
// Demo data. A datalist with data-items="5000" gets that many generated options. The attribute is removed afterwards,
// so the code shown for an example is plain markup (cut short after a few options).
// ---------------------------------------------------------------------------

function fillDatalists(root) {
    for (const datalist of root.querySelectorAll("datalist[data-items]")) {
        const count = Number(datalist.dataset.items);
        datalist.append(...Array.from({ length: count }, (_, i) => new Option("", `Item ${i + 1}`)));
        datalist.removeAttribute("data-items");
    }
}

// The same test Datalynx makes before it enhances anything.
function setupDatalynxSupport() {
    setupSupportNotice({
        supported: CSS.supports("anchor-scope", "all") && CSS.supports("selector(:popover-open)"),
        yes: "✓ This browser supports it, so the fields on this page are enhanced.",
        no: "✗ This browser doesn't support it, so the fields on this page keep the browser's own datalist.",
    });
}

// ---------------------------------------------------------------------------
// Opening and keyboard: the input's own events, as a page would see them
// ---------------------------------------------------------------------------

async function setupEventsDemo() {
    const example = document.querySelector("[data-events]");
    const input = (await example.stageReady).querySelector("input");
    const write = eventLog(example.querySelector(".log"));

    for (const type of ["input", "change"]) input.addEventListener(type, () => write(`${type}: "${input.value}"`));
}

// ---------------------------------------------------------------------------
// Validation: the input's events, and what a submit would send, without leaving the page
// ---------------------------------------------------------------------------

async function setupValidationDemo() {
    const example = document.querySelector("[data-validation]");
    const form = (await example.stageReady).querySelector("form");
    const input = form.querySelector("input");
    const write = eventLog(example.querySelector(".log"));

    for (const type of ["input", "change"]) input.addEventListener(type, () => write(`${type}: "${input.value}"`));
    form.addEventListener("submit", event => {
        event.preventDefault();
        write(`submitted ${new URLSearchParams(new FormData(form))}`);
    });
}

// ---------------------------------------------------------------------------
// Live changes. The buttons don't take focus from the input (mousedown is cancelled), so an open popover stays open
// while they change its datalist.
// ---------------------------------------------------------------------------

async function setupLiveDemo() {
    const example = document.querySelector("[data-live]");
    const datalist = (await example.stageReady).querySelector("datalist");
    const write = eventLog(example.querySelector(".log"));
    const extra = [["Cake", "🍰"], ["Pretzel", "🥨"], ["Chocolate", "🍫"], ["Waffle", "🧇"], ["Lollipop", "🍭"]];
    let added = 0;
    let renamed = 0;

    const actions = {
        add() {
            const [value, icon] = extra[added++ % extra.length];
            const option = new Option("", value);
            option.dataset.icon = icon;
            datalist.append(option);
            write(`added ${value}`);
        },
        remove() {
            const option = datalist.lastElementChild;
            option?.remove();
            if (option) write(`removed ${option.value}`);
        },
        rename() {
            const option = datalist.options[0];
            if (!option) return;
            const before = option.value;
            option.value = ++renamed % 2 ? `Big ${before}` : before.replace(/^Big /, "");
            write(`renamed ${before} to ${option.value}`);
        },
    };

    for (const button of example.querySelectorAll("[data-action]")) {
        button.addEventListener("mousedown", event => event.preventDefault());
        button.addEventListener("click", () => actions[button.dataset.action]());
    }
}

// ---------------------------------------------------------------------------
// Playground. Every change builds a new field from the form, prints it, and swaps it in.
// ---------------------------------------------------------------------------

const fruit = (value, icon) => `<option value="${value}" data-icon="${icon}"></option>`;
const airport = (code, city, country) => `<option value="${code}" data-subtext="${country}">${city}</option>`;
const country = (code, name) => `<option value="${name}" data-image="flags/${code}.svg"></option>`;

// The flags are in docs/flags, named by country code.
const PLAYGROUND_LISTS = {
    fruits: () => [["Apple", "🍎"], ["Banana", "🍌"], ["Cherry", "🍒"], ["Grapes", "🍇"], ["Lemon", "🍋"], ["Mango", "🥭"],
        ["Orange", "🍊"], ["Peach", "🍑"], ["Pear", "🍐"], ["Pineapple", "🍍"], ["Strawberry", "🍓"], ["Watermelon", "🍉"]]
        .map(item => fruit(...item)).join(""),
    airports: () => [["AMS", "Amsterdam", "Netherlands"], ["ATH", "Athens", "Greece"], ["BCN", "Barcelona", "Spain"],
        ["BER", "Berlin", "Germany"], ["CDG", "Paris Charles de Gaulle", "France"], ["IST", "Istanbul", "Türkiye"],
        ["JFK", "New York City JFK", "United States"], ["LHR", "London Heathrow", "United Kingdom"],
        ["SOF", "Sofia", "Bulgaria"], ["ZRH", "Zürich", "Switzerland"]].map(item => airport(...item)).join(""),
    countries: () => [["at", "Austria"], ["fr", "France"], ["de", "Germany"], ["id", "Indonesia"], ["it", "Italy"],
        ["jp", "Japan"], ["ng", "Nigeria"], ["pl", "Poland"], ["se", "Sweden"], ["ua", "Ukraine"]]
        .map(item => country(...item)).join(""),
    items: () => Array.from({ length: 5000 }, (_, i) => `<option value="Item ${i + 1}"></option>`).join(""),
};

async function setupPlayground() {
    const root = document.querySelector("[data-playground]");
    const form = root.querySelector("form");
    const host = root.querySelector("[data-playground-host]");
    const write = eventLog(root.querySelector(".log"));
    const panel = codePanel([{ label: "HTML", text: "", html: true }]);
    let timer;

    root.append(panel);

    const value = name => form.elements[name].value.trim();

    const build = () => {
        const typed = host.querySelector("input")?.value ?? "";
        const label = document.createElement("label");
        const lynx = document.createElement("data-lynx");
        const input = document.createElement("input");
        const datalist = document.createElement("datalist");
        const list = value("list");
        let nodes = [label, lynx, datalist];

        label.htmlFor = "playground-input";
        label.textContent = { fruits: "Fruit", airports: "Airport", countries: "Country", items: "Item" }[list];
        if (value("batch-size")) lynx.setAttribute("batch-size", value("batch-size"));
        if (form.elements.strict.checked) lynx.setAttribute("strict", "");
        input.id = "playground-input";
        input.name = list;
        input.setAttribute("list", "playground-list");
        if (value("placeholder")) input.placeholder = value("placeholder");
        datalist.id = "playground-list";
        datalist.innerHTML = PLAYGROUND_LISTS[list]();
        lynx.append(input);

        // lang and dir go on a wrapper, as a page would set them on an ancestor.
        if (value("lang") || value("dir")) {
            const wrapper = document.createElement("div");
            if (value("lang")) wrapper.lang = value("lang");
            if (value("dir")) wrapper.dir = value("dir");
            wrapper.append(...nodes);
            nodes = [wrapper];
        }

        panel.setCode("HTML", printHTML(nodes));
        input.value = typed;
        for (const type of ["input", "change"]) input.addEventListener(type, () => write(`${type}: "${input.value}"`));
        host.replaceChildren(...nodes);
    };

    // The pickers among the controls rebuild on change, once a pick is made; text fields wait for a pause in typing.
    form.addEventListener("input", event => {
        if (event.target.localName === "select") return;
        clearTimeout(timer);
        timer = setTimeout(build, 250);
    });
    form.addEventListener("change", event => {
        if (event.target.localName === "select") build();
    });
    form.addEventListener("submit", event => event.preventDefault());

    build();
}

// ---------------------------------------------------------------------------
// Page setup. The examples are put on their stages first, then Platypicker and Datalynx are imported, which define
// their elements and enhance what's there.
// ---------------------------------------------------------------------------

setupExamples({ prepare: fillDatalists });
setupCodeBlocks();
setupTheme("dlx-theme");
setupVersion();
setupNavigation({ wrap: "platy-picker", sync: (picker, id) => picker.setValue?.(id) });
setupDatalynxSupport();
setupEventsDemo();
setupValidationDemo();
setupLiveDemo();
setupTheming(document.querySelector("[data-theming]"), "data-lynx");
setupPlayground();

await Promise.all([import("../node_modules/platypicker/src/platypicker.js"), import("../src/datalynx.js")]);