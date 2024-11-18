import * as Redom from "redom";
export default class AtmosAutocomplete {
    static autocompletes = new Map();
    static openedAutocomplete;
    inputElement;
    datalistElement;
    menuMock;
    selectedMenuItemMock;
    showAllOptionsButton;
    optionsChangeMutationObserver;
    inputElementAttributesChangeMutationObserver;
    listeners = {};
    visibleOptions = 0;
    menuItemMocks = new Array();
    static customHighlight;
    static maxHighlights = 100;
    constructor(inputElement, datalistElement) {
        if (AtmosAutocomplete.autocompletes.has(inputElement))
            return;
        this.inputElement = inputElement;
        this.datalistElement = datalistElement;
        this.generateMocks();
        this.listeners.inputFocusListener = () => {
            if (this.shouldOpenOnFocus &&
                !this.inputElement.readOnly &&
                this.menuItemMocks.some(c => !c.classList.contains("hidden"))) {
                if (this.hidden) {
                    let result = this.inputElement.dispatchEvent(new CustomEvent("beforeshow.atmos-autocomplete", {
                        detail: {
                            filter: this.inputElement.value
                        },
                        cancelable: true
                    }));
                    if (!result)
                        return;
                    this.show();
                }
                else if (!this.visibleOptions) {
                    this.hide();
                }
                this.positionMenuMock();
                this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });
            }
        };
        this.inputElement.addEventListener("focus", this.listeners.inputFocusListener);
        this.listeners.keydownListener = (e) => {
            if (!this.datalistElement)
                return;
            if (e.code === "ArrowDown") {
                e.preventDefault();
                if (this.visibleOptions <= 1)
                    return;
                let nextOption = this.selectedMenuItemMock;
                let i = this.menuItemMocks.indexOf(nextOption);
                let previousOption;
                do {
                    previousOption = nextOption;
                    nextOption = this.menuItemMocks[++i];
                    if (!nextOption) {
                        i = 0;
                        nextOption = this.menuItemMocks[0];
                    }
                } while (!nextOption ||
                    (previousOption && nextOption === previousOption) ||
                    nextOption.classList.contains("hidden") ||
                    nextOption.classList.contains("disabled"));
                this.updateInputElement(nextOption.datalistOption.textContent);
                this.inputElement.dispatchEvent(new CustomEvent("change", {
                    bubbles: true,
                    detail: {
                        filterMenu: false,
                        optionToSelect: nextOption
                    }
                }));
                this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });
            }
            else if (e.code === "ArrowUp") {
                e.preventDefault();
                if (this.visibleOptions <= 1)
                    return;
                let nextOption = this.selectedMenuItemMock;
                let i = this.menuItemMocks.indexOf(nextOption);
                let previousOption;
                do {
                    previousOption = nextOption;
                    nextOption = this.menuItemMocks[--i];
                    if (!nextOption) {
                        i = this.menuItemMocks.length - 1;
                        nextOption = this.menuItemMocks[this.menuItemMocks.length - 1];
                    }
                } while (!nextOption ||
                    (nextOption === previousOption) ||
                    nextOption.classList.contains("hidden") ||
                    nextOption.classList.contains("disabled"));
                this.updateInputElement(nextOption.datalistOption.textContent);
                this.inputElement.dispatchEvent(new CustomEvent("change", {
                    bubbles: true,
                    detail: {
                        filterMenu: false,
                        optionToSelect: nextOption
                    }
                }));
                this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });
            }
            else if (e.code === "Escape") {
                e.preventDefault();
                this.hide();
            }
            else if (e.code === "Enter") {
                e.preventDefault();
                this.toggle();
            }
            else if (e.code === "Tab") {
                this.hide();
            }
        };
        this.inputElement.addEventListener("keydown", this.listeners.keydownListener);
        this.listeners.inputListener = (e) => {
            if (!this.datalistElement)
                return;
            if (this.hidden && e?.type === "input" && this.visibleOptions) {
                let result = this.inputElement.dispatchEvent(new CustomEvent("beforeshow.atmos-autocomplete", {
                    detail: {
                        filter: this.inputElement.value
                    },
                    cancelable: true
                }));
                if (!result)
                    return;
            }
            if (e?.detail?.filterMenu !== false) {
                this.filterMenuMock(this.inputElement.value);
            }
            let selectedOption;
            if (e.detail?.optionToSelect)
                selectedOption = e.detail.optionToSelect;
            else
                selectedOption = this.menuItemMocks.find(o => !o.datalistOption.disabled && o.datalistOption.textContent.trim() === this.inputElement.value.trim());
            this.updateMenuMock(selectedOption);
            this.updateInputElementTitle(this.selectedMenuItemMock?.title);
            if (this.hidden && e?.type === "input")
                this.show();
            else if (!this.visibleOptions)
                this.hide();
            this.positionMenuMock();
            this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });
        };
        this.inputElement.addEventListener("input", this.listeners.inputListener);
        this.inputElement.addEventListener("change", this.listeners.inputListener);
        this.menuMock.addEventListener("click", e => {
            if (!this.datalistElement || this.isSuggestModeEnabled)
                return;
            let target = e.target.closest(".atmos-autocomplete-menu-item");
            if (!target)
                return;
            if (target.classList.contains("disabled"))
                return;
            this.updateInputElement(target.datalistOption.textContent);
            this.inputElement.dispatchEvent(new CustomEvent("change", {
                bubbles: true,
                detail: {
                    filterMenu: false,
                    optionToSelect: target
                }
            }));
            this.inputElement.focus();
        });
        this.showAllOptionsButton?.addEventListener("click", () => {
            if (!this.datalistElement)
                return;
            let result = this.inputElement.dispatchEvent(new CustomEvent("beforeshow.atmos-autocomplete", {
                detail: {
                    filter: ""
                },
                cancelable: true
            }));
            if (!result)
                return;
            this.filterMenuMock("", false);
            if (this.hidden)
                this.show();
            this.positionMenuMock();
            this.selectedMenuItemMock?.scrollIntoView({ block: "nearest" });
            this.inputElement.focus();
        });
        this.optionsChangeMutationObserver = new MutationObserver(() => {
            if (this.datalistElement.options.length !== this.menuItemMocks.length ||
                this.menuItemMocks.some(item => !item.datalistOption.isConnected)) {
                this.generateOptionMocks();
            }
            this.generateOptionMocks();
        });
        if (this.datalistElement) {
            this.optionsChangeMutationObserver.observe(this.datalistElement, {
                childList: true
            });
        }
        this.inputElementAttributesChangeMutationObserver = new MutationObserver(() => {
            if (this.showAllOptionsButton)
                this.showAllOptionsButton.disabled = inputElement.disabled || inputElement.readOnly;
            if (this.inputElement.list) {
                this.pauseOptionsChangeObserver();
                this.datalistElement = this.inputElement.list;
                this.generateOptionMocks();
                this.inputElement.removeAttribute("list");
                this.positionMenuMock();
                this.resumeOptionsChangeObserver();
            }
        });
        this.inputElementAttributesChangeMutationObserver.observe(inputElement, {
            attributes: true,
            attributeFilter: ["disabled", "readonly", "list"]
        });
        this.visibleOptions = this.datalistElement?.childElementCount ?? 0;
        AtmosAutocomplete.autocompletes.set(inputElement, this);
    }
    get shouldOpenOnFocus() {
        return this.inputElement.dataset.focusOpen !== "false";
    }
    get isSuggestModeEnabled() {
        return this.inputElement.dataset.suggest === "true";
    }
    get menuPosition() {
        return this.inputElement.dataset.menuPosition ?? "";
    }
    get hidden() {
        return this.menuMock.classList.contains("hidden");
    }
    static init() {
        let inputElements = document.querySelectorAll("[data-toggle=autocomplete]");
        for (const inputElement of inputElements) {
            new AtmosAutocomplete(inputElement, inputElement.list);
        }
        new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const addedNode of mutation.addedNodes) {
                    if (!(addedNode instanceof HTMLElement))
                        continue;
                    let toggles = [];
                    if (addedNode.dataset?.toggle === "autocomplete")
                        toggles.push(addedNode);
                    toggles.push(...addedNode.querySelectorAll("[data-toggle=autocomplete]"));
                    for (const toggle of toggles) {
                        if (this.autocompletes.has(toggle))
                            continue;
                        new AtmosAutocomplete(toggle, toggle.list);
                    }
                }
                for (const removedNode of mutation.removedNodes) {
                    if (!(removedNode instanceof HTMLElement))
                        continue;
                    let toggles = [];
                    if (removedNode.dataset?.toggle === "autocomplete")
                        toggles.push(removedNode);
                    toggles.push(...removedNode.querySelectorAll("[data-toggle=autocomplete]"));
                    for (const toggle of toggles) {
                        AtmosAutocomplete.get(toggle)?.destroy();
                    }
                }
            }
        }).observe(document, {
            childList: true,
            subtree: true
        });
        document.addEventListener("click", (e) => {
            if (!AtmosAutocomplete.openedAutocomplete)
                return;
            let target = e.target;
            if (target.closest(".atmos-autocomplete-menu") === AtmosAutocomplete.openedAutocomplete.menuMock) {
                if (target.closest(".atmos-autocomplete-menu-item.disabled")) {
                    return;
                }
                else if (target.closest(".atmos-autocomplete-menu-optgroup") &&
                    !target.closest(".atmos-autocomplete-menu-item")) {
                    return;
                }
                else if (target.closest(".atmos-autocomplete-menu.readonly")) {
                    return;
                }
            }
            else if (target.closest(".atmos-autocomplete-input") ===
                AtmosAutocomplete.openedAutocomplete.inputElement) {
                return;
            }
            else if (AtmosAutocomplete.openedAutocomplete.showAllOptionsButton &&
                target.closest(".atmos-autocomplete-menu-toggle") ===
                    AtmosAutocomplete.openedAutocomplete.showAllOptionsButton) {
                return;
            }
            AtmosAutocomplete.openedAutocomplete.hide();
        });
        window.addEventListener("resize", () => {
            if (!AtmosAutocomplete.openedAutocomplete)
                return;
            if (!AtmosAutocomplete.openedAutocomplete.hidden)
                AtmosAutocomplete.openedAutocomplete.positionMenuMock();
        });
        let initialRect;
        window.addEventListener("scroll", (e) => {
            if (!AtmosAutocomplete.openedAutocomplete ||
                AtmosAutocomplete.openedAutocomplete.hidden ||
                e.target === AtmosAutocomplete.openedAutocomplete.menuMock)
                return;
            let inputRect = AtmosAutocomplete.openedAutocomplete.inputElement.getBoundingClientRect();
            if (!initialRect)
                initialRect = inputRect;
            if (e.target !== document)
                AtmosAutocomplete.openedAutocomplete.menuMock.style.transform =
                    `translate(${inputRect.right - initialRect.right}px, ${inputRect.bottom - initialRect.bottom}px)`;
        }, { capture: true, passive: true });
        window.addEventListener("scrollend", (e) => {
            if (!AtmosAutocomplete.openedAutocomplete ||
                AtmosAutocomplete.openedAutocomplete.hidden ||
                e.target === AtmosAutocomplete.openedAutocomplete.menuMock)
                return;
            AtmosAutocomplete.openedAutocomplete.positionMenuMock();
            initialRect = null;
        }, { capture: true, passive: true });
        if (CSS.highlights) {
            this.customHighlight = new Highlight();
            CSS.highlights.set("atmos-autocomplete-highlight", this.customHighlight);
        }
    }
    static get(element) {
        return this.autocompletes.get(element);
    }
    hide() {
        this.menuMock.classList.add("hidden");
        AtmosAutocomplete.openedAutocomplete = null;
        this.menuMock.dispatchEvent(new CustomEvent("hide.atmos-autocomplete"));
    }
    show() {
        if (!this.visibleOptions)
            return;
        if (!AtmosAutocomplete.openedAutocomplete?.hidden)
            AtmosAutocomplete.openedAutocomplete?.hide();
        this.menuMock.classList.remove("hidden");
        AtmosAutocomplete.openedAutocomplete = this;
        this.menuMock.dispatchEvent(new CustomEvent("show.atmos-autocomplete"));
    }
    toggle() {
        if (!this.visibleOptions && this.hidden)
            return;
        if (this.hidden) {
            if (!AtmosAutocomplete.openedAutocomplete?.hidden)
                AtmosAutocomplete.openedAutocomplete?.hide();
        }
        this.menuMock.classList.toggle("hidden");
        this.positionMenuMock();
        let customEvent;
        if (!this.menuMock.classList.contains("hidden")) {
            customEvent = new CustomEvent("show.atmos-autocomplete");
            AtmosAutocomplete.openedAutocomplete = this;
        }
        else {
            customEvent = new CustomEvent("hide.atmos-autocomplete");
            AtmosAutocomplete.openedAutocomplete = null;
        }
        this.menuMock.dispatchEvent(customEvent);
    }
    pauseOptionsChangeObserver() {
        this.optionsChangeMutationObserver.disconnect();
    }
    resumeOptionsChangeObserver() {
        if (!this.datalistElement)
            return;
        this.optionsChangeMutationObserver.observe(this.datalistElement, {
            childList: true
        });
    }
    refreshMenu() {
        let selectedOption = this.menuItemMocks
            .find(o => !o.datalistOption.disabled && o.datalistOption.textContent.trim() === this.inputElement.value.trim());
        if (this.datalistElement.options.length !== this.menuItemMocks.length ||
            this.menuItemMocks.some(item => !item.datalistOption.isConnected)) {
            this.generateOptionMocks();
        }
        else {
            this.updateMenuMock(selectedOption);
        }
        this.updateInputElementTitle(this.selectedMenuItemMock?.title);
    }
    destroy() {
        this.inputElement.removeEventListener("focus", this.listeners.inputFocusListener);
        this.inputElement.removeEventListener("input", this.listeners.inputListener);
        this.inputElement.removeEventListener("change", this.listeners.inputListener);
        this.inputElement.removeEventListener("keydown", this.listeners.keydownListener);
        this.optionsChangeMutationObserver.disconnect();
        this.inputElementAttributesChangeMutationObserver.disconnect();
        if (this.datalistElement)
            this.inputElement.setAttribute("list", this.datalistElement.id);
        this.menuMock.remove();
        this.showAllOptionsButton.remove();
        AtmosAutocomplete.autocompletes.delete(this.inputElement);
        if (AtmosAutocomplete.openedAutocomplete === this)
            AtmosAutocomplete.openedAutocomplete = null;
        this.inputElement = null;
        this.datalistElement = null;
        this.menuMock = null;
        this.selectedMenuItemMock = null;
        this.showAllOptionsButton = null;
        this.optionsChangeMutationObserver = null;
        this.inputElementAttributesChangeMutationObserver = null;
        this.listeners = null;
        this.visibleOptions = null;
    }
    updateInputElement(value) {
        this.inputElement.value = value ?? "";
    }
    updateInputElementTitle(value) {
        if (!value === null || value === undefined)
            value = "";
        if (value?.toString()) {
            this.inputElement.title = value?.toString();
        }
        else {
            this.inputElement.removeAttribute("title");
        }
    }
    updateMenuMock(selectedOption) {
        console.debug(`Update menu's options.`);
        let value = this.inputElement.value.trim().toLowerCase();
        for (const menuItemMock of this.menuItemMocks) {
            let hasContentBeenUpdated = false;
            let itemText = menuItemMock.querySelector(".atmos-autocomplete-menu-item-text");
            if (itemText.textContent !== menuItemMock.datalistOption.textContent) {
                itemText.textContent = menuItemMock.datalistOption.textContent;
                hasContentBeenUpdated = true;
            }
            let valueToTestAgainst = menuItemMock.datalistOption.dataset.subtext ?? "";
            let itemSubtext = menuItemMock.querySelector(".atmos-autocomplete-menu-item-value");
            if (itemSubtext.textContent !== valueToTestAgainst) {
                itemSubtext.textContent = valueToTestAgainst ?? "";
                hasContentBeenUpdated = true;
            }
            menuItemMock?.classList.remove("selected");
            if (hasContentBeenUpdated && value) {
                this.adjustHighlightRange(menuItemMock, menuItemMock.datalistOption.textContent.trim().toLowerCase(), menuItemMock.datalistOption.dataset.subtext?.trim().toLowerCase(), value);
            }
        }
        this.selectedMenuItemMock = null;
        selectedOption?.classList.add("selected");
        this.selectedMenuItemMock = selectedOption;
    }
    filterMenuMock(value, clearHighlights = true) {
        console.debug(`Filtering menu.`);
        this.visibleOptions = 0;
        if (!value) {
            for (const menuItemMock of this.menuMock.querySelectorAll(".hidden")) {
                menuItemMock.classList.remove("hidden");
            }
            this.visibleOptions = this.datalistElement.children.length;
            if (clearHighlights)
                AtmosAutocomplete.customHighlight?.clear();
            return;
        }
        if (clearHighlights)
            AtmosAutocomplete.customHighlight?.clear();
        for (const menuItemMock of this.menuItemMocks) {
            let normalizedOptionText = menuItemMock.datalistOption.textContent.toLowerCase().trim();
            let normalizedOptionSubtext = menuItemMock.datalistOption.dataset.subtext?.toLowerCase().trim() ?? "";
            let normalizedText = value.toLowerCase().trim();
            if (menuItemMock.datalistOption.textContent === value ||
                menuItemMock.datalistOption.dataset.subtext === value) {
                menuItemMock.classList.remove("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-autocomplete-menu-optgroup"))
                    menuItemMock.parentElement.classList.remove("hidden");
                this.visibleOptions++;
                this.adjustHighlightRange(menuItemMock, normalizedOptionText, normalizedOptionSubtext, normalizedText);
            }
            else if (normalizedOptionText.includes(normalizedText) ||
                normalizedOptionSubtext.includes(normalizedText)) {
                menuItemMock.classList.remove("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-autocomplete-menu-optgroup"))
                    menuItemMock.parentElement.classList.remove("hidden");
                this.visibleOptions++;
                this.adjustHighlightRange(menuItemMock, normalizedOptionText, normalizedOptionSubtext, normalizedText);
            }
            else {
                menuItemMock.classList.add("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-autocomplete-menu-optgroup"))
                    menuItemMock.parentElement.classList.add("hidden");
                this.hideHighlightRange(menuItemMock);
            }
        }
        let visibleMenuItemMocksWithHiddenOptgroup = this.menuMock.querySelectorAll(".atmos-autocomplete-menu-optgroup.hidden .atmos-autocomplete-menu-item:not(.hidden)");
        for (const menuItemMock of visibleMenuItemMocksWithHiddenOptgroup) {
            menuItemMock.parentElement.classList.remove("hidden");
        }
    }
    positionMenuMock() {
        this.menuMock.style.removeProperty("height");
        let inputRect = this.inputElement.getBoundingClientRect();
        let menuRect = this.menuMock.getBoundingClientRect();
        if (inputRect.bottom + menuRect.height + 15 > window.innerHeight && inputRect.top - 15 < menuRect.height) {
            if (this.menuPosition === "up") {
                this.menuMock.style.top = `${window.scrollY + 5}px`;
                this.menuMock.style.height = `${inputRect.top - 10}px`;
            }
            else {
                this.menuMock.style.top = `${inputRect.bottom + window.scrollY + 5}px`;
                this.menuMock.style.height = `${window.innerHeight - inputRect.bottom - 10}px`;
            }
        }
        else if (inputRect.bottom + menuRect.height + 15 > window.innerHeight) {
            this.menuMock.style.top = `${inputRect.top - menuRect.height - 5 + window.scrollY}px`;
        }
        else if (this.menuPosition === "up" && inputRect.top - 15 < menuRect.height) {
            this.menuMock.style.top = `${inputRect.bottom + window.scrollY + 5}px`;
        }
        else {
            if (this.menuPosition === "up") {
                this.menuMock.style.top = `${inputRect.top - menuRect.height - 5 + window.scrollY}px`;
            }
            else {
                this.menuMock.style.top = `${inputRect.bottom + window.scrollY + 5}px`;
            }
        }
        let left = inputRect.left;
        if (inputRect.left + menuRect.width + 15 > window.innerWidth) {
            left -= inputRect.left + menuRect.width + 15 + window.scrollY - window.innerWidth;
        }
        console.debug(`Positioning menu to ${inputRect.width}, ${inputRect.left}.`);
        this.menuMock.style.minWidth = `${inputRect.width}px`;
        this.menuMock.style.left = `${left}px`;
        this.menuMock.style.removeProperty("transform");
    }
    generateMocks() {
        this.inputElement.classList.add("atmos-autocomplete-input");
        this.inputElement.removeAttribute("list");
        let menuMock = Redom.el("ul.atmos-autocomplete-menu.hidden");
        if (this.inputElement.id)
            menuMock.dataset.origin = this.inputElement.id;
        if (this.isSuggestModeEnabled)
            menuMock.classList.add("readonly");
        Redom.mount(document.body, menuMock);
        this.menuMock = menuMock;
        let showAllOptionsButton = Redom.el("button.atmos-autocomplete-menu-toggle", {
            tabIndex: -1,
            type: "button",
            disabled: this.inputElement.disabled || this.inputElement.readOnly,
            title: "Show all"
        });
        this.inputElement.insertAdjacentElement("afterend", showAllOptionsButton);
        this.showAllOptionsButton = showAllOptionsButton;
        this.generateOptionMocks();
    }
    generateOptionMocks() {
        Redom.setChildren(this.menuMock, []);
        AtmosAutocomplete.customHighlight?.clear();
        if (!this.datalistElement)
            return;
        this.menuItemMocks = [];
        this.selectedMenuItemMock = null;
        for (const child of this.datalistElement.children) {
            if (child instanceof HTMLOptGroupElement) {
                let optgroupMock = Redom.el("li.atmos-autocomplete-menu-optgroup", Redom.el("span.atmos-autocomplete-menu-optgroup-text", child.label));
                Redom.mount(this.menuMock, optgroupMock);
                for (const option of child.querySelectorAll("option")) {
                    this.generateOptionMock(optgroupMock, option);
                }
            }
            else if (child instanceof HTMLOptionElement) {
                this.generateOptionMock(this.menuMock, child);
            }
        }
        this.visibleOptions = this.datalistElement.childElementCount;
    }
    generateOptionMock(parent, option) {
        let menuItemMock = Redom.el("li.atmos-autocomplete-menu-item");
        if (option.title)
            menuItemMock.title = option.title;
        Redom.mount(parent, menuItemMock);
        let textMock = Redom.el("span.atmos-autocomplete-menu-item-text", option.textContent);
        Redom.mount(menuItemMock, textMock);
        let menuItemSubtext = Redom.el("small.atmos-autocomplete-menu-item-value", option.dataset.subtext ?? "");
        Redom.mount(menuItemMock, menuItemSubtext);
        menuItemMock["datalistOption"] = option;
        if (this.inputElement.value === option.textContent && !option.disabled && !this.selectedMenuItemMock) {
            menuItemMock.classList.add("selected");
            this.selectedMenuItemMock = menuItemMock;
            this.updateInputElementTitle(this.selectedMenuItemMock.title);
        }
        if (option.disabled ||
            (parent.classList.contains("atmos-autocomplete-menu-optgroup") &&
                option.parentElement instanceof HTMLOptGroupElement &&
                option.parentElement.disabled)) {
            menuItemMock.classList.add("disabled");
        }
        let selectedTickImage = Redom.el("span.atmos-autocomplete-menu-item-tick");
        Redom.mount(menuItemMock, selectedTickImage);
        let value = this.inputElement.value.trim().toLowerCase();
        if (value) {
            this.adjustHighlightRange(menuItemMock, option.textContent.trim().toLowerCase(), option.dataset.subtext?.trim().toLowerCase(), value);
        }
        this.menuItemMocks.push(menuItemMock);
    }
    adjustHighlightRange(menuItemMock, optionText, optionSubtext, valueToTestAgainst) {
        if (!CSS.highlights)
            return;
        let start = optionText.indexOf(valueToTestAgainst);
        if (start >= 0 && AtmosAutocomplete.customHighlight.size < AtmosAutocomplete.maxHighlights) {
            if (!menuItemMock.textHighlightRange) {
                menuItemMock.textHighlightRange = new Range();
            }
            let textNode = menuItemMock.querySelector(".atmos-autocomplete-menu-item-text").childNodes[0];
            menuItemMock.textHighlightRange.setStart(textNode, start);
            menuItemMock.textHighlightRange.setEnd(textNode, start + valueToTestAgainst.length);
            AtmosAutocomplete.customHighlight.add(menuItemMock.textHighlightRange);
        }
        else if (menuItemMock.textHighlightRange) {
            AtmosAutocomplete.customHighlight.delete(menuItemMock.textHighlightRange);
            menuItemMock.textHighlightRange = null;
        }
        if (optionSubtext && optionSubtext !== optionText) {
            start = optionSubtext.indexOf(valueToTestAgainst);
            if (start >= 0 && AtmosAutocomplete.customHighlight.size < AtmosAutocomplete.maxHighlights) {
                if (!menuItemMock.subtextHighlightRange) {
                    menuItemMock.subtextHighlightRange = new Range();
                }
                let textNode = menuItemMock.querySelector(".atmos-autocomplete-menu-item-value").childNodes[0];
                menuItemMock.subtextHighlightRange.setStart(textNode, start);
                menuItemMock.subtextHighlightRange.setEnd(textNode, start + valueToTestAgainst.length);
                AtmosAutocomplete.customHighlight.add(menuItemMock.subtextHighlightRange);
            }
            else if (menuItemMock.subtextHighlightRange) {
                AtmosAutocomplete.customHighlight.delete(menuItemMock.subtextHighlightRange);
                menuItemMock.subtextHighlightRange = null;
            }
        }
    }
    hideHighlightRange(menuItemMock) {
        if (!CSS.highlights)
            return;
        if (menuItemMock.textHighlightRange) {
            AtmosAutocomplete.customHighlight.delete(menuItemMock.textHighlightRange);
            menuItemMock.textHighlightRange = null;
        }
        if (menuItemMock.subtextHighlightRange) {
            AtmosAutocomplete.customHighlight.delete(menuItemMock.subtextHighlightRange);
            menuItemMock.subtextHighlightRange = null;
        }
    }
}
window["AtmosAutocomplete"] = AtmosAutocomplete;
AtmosAutocomplete.init();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXRtb3NBdXRvY29tcGxldGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvYXRtb3NBdXRvY29tcGxldGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxLQUFLLEtBQUssTUFBTSxPQUFPLENBQUM7QUFFL0IsTUFBTSxDQUFDLE9BQU8sT0FBTyxpQkFBaUI7SUFDMUIsTUFBTSxDQUFDLGFBQWEsR0FBRyxJQUFJLEdBQUcsRUFBdUMsQ0FBQztJQUN0RSxNQUFNLENBQUMsa0JBQWtCLENBQW9CO0lBRTdDLFlBQVksQ0FBbUI7SUFDL0IsZUFBZSxDQUFzQjtJQUNyQyxRQUFRLENBQWM7SUFDdEIsb0JBQW9CLENBQWdCO0lBQ3BDLG9CQUFvQixDQUFvQjtJQUV4Qyw2QkFBNkIsQ0FBbUI7SUFDaEQsNENBQTRDLENBQW1CO0lBQy9ELFNBQVMsR0FBUSxFQUFFLENBQUM7SUFDcEIsY0FBYyxHQUFXLENBQUMsQ0FBQztJQUMzQixhQUFhLEdBQUcsSUFBSSxLQUFLLEVBQWlCLENBQUM7SUFFM0MsTUFBTSxDQUFDLGVBQWUsQ0FBWTtJQUNsQyxNQUFNLENBQUMsYUFBYSxHQUFHLEdBQUcsQ0FBQztJQUVuQyxZQUFZLFlBQThCLEVBQUUsZUFBb0M7UUFDNUUsSUFBSSxpQkFBaUIsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQztZQUFFLE9BQU87UUFDOUQsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7UUFDakMsSUFBSSxDQUFDLGVBQWUsR0FBRyxlQUFlLENBQUM7UUFHdkMsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBR3JCLElBQUksQ0FBQyxTQUFTLENBQUMsa0JBQWtCLEdBQUcsR0FBRyxFQUFFO1lBQ3JDLElBQUksSUFBSSxDQUFDLGlCQUFpQjtnQkFDdEIsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVE7Z0JBQzNCLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxF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