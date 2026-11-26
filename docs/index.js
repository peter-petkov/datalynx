// Datalynx's docs page. What the family's docs pages share (theme switch, examples printed from their templates, code
// panels, navigation, version, support notice) comes from Burrowkit's docs/page.js; theme.js applied the saved theme
// in <head>. Platypicker is loaded for the page's own selects (the section picker on narrow screens), not by Datalynx.
import {
    eventLog, setupCodeBlocks, setupExamples, setupNavigation, setupSupportNotice, setupTheme, setupVersion
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
setupLiveDemo();

await Promise.all([import("../node_modules/platypicker/src/platypicker.js"), import("../src/datalynx.js")]);