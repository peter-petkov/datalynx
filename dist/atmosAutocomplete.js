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
                if (!this.visibleOptions)
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
                    (previousOption && nextOption.datalistOption.textContent === previousOption.datalistOption.textContent) ||
                    nextOption.classList.contains("hidden") ||
                    nextOption.classList.contains("disabled"));
                this.updateInputElement(nextOption.datalistOption.textContent);
                this.inputElement.dispatchEvent(new CustomEvent("change", {
                    bubbles: true,
                    detail: { filterMenu: false }
                }));
                this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });
            }
            else if (e.code === "ArrowUp") {
                e.preventDefault();
                if (!this.visibleOptions)
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
                    (previousOption && nextOption.datalistOption.textContent === previousOption.datalistOption.textContent) ||
                    nextOption.classList.contains("hidden") ||
                    nextOption.classList.contains("disabled"));
                this.updateInputElement(nextOption.datalistOption.textContent);
                this.inputElement.dispatchEvent(new CustomEvent("change", {
                    bubbles: true,
                    detail: { filterMenu: false }
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
            let selectedOption = this.menuItemMocks
                .find(o => !o.datalistOption.disabled && o.datalistOption.textContent.trim() === this.inputElement.value.trim());
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
                detail: { filterMenu: false }
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
            this.filterMenuMock("");
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
    get isSubtextShown() {
        return this.inputElement.dataset.subtext === "true";
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
        this.inputElement.title = value?.toString();
    }
    updateMenuMock(selectedOption) {
        console.debug(`Update menu's options.`);
        for (const menuItemMock of this.menuItemMocks) {
            if (!menuItemMock.children[0].childNodes[0]) {
                menuItemMock.children[0].insertAdjacentHTML("afterbegin", menuItemMock.datalistOption.textContent);
            }
            else if (menuItemMock.children[0].childNodes[0].textContent !== menuItemMock.datalistOption.textContent) {
                menuItemMock.children[0].childNodes[0].textContent = menuItemMock.datalistOption.textContent;
            }
            let valueSubtextElement = menuItemMock.querySelector(".atmos-autocomplete-menu-item-value");
            if (valueSubtextElement)
                valueSubtextElement.textContent = menuItemMock.datalistOption.dataset.subtext || menuItemMock.datalistOption.value;
            menuItemMock?.classList.remove("selected");
        }
        this.selectedMenuItemMock = null;
        selectedOption?.classList.add("selected");
        this.selectedMenuItemMock = selectedOption;
    }
    filterMenuMock(value) {
        console.debug(`Filtering menu.`);
        this.visibleOptions = 0;
        if (!value) {
            for (const menuItemMock of this.menuMock.querySelectorAll(".hidden")) {
                menuItemMock.classList.remove("hidden");
            }
            this.visibleOptions = this.datalistElement.children.length;
            AtmosAutocomplete.customHighlight?.clear();
            return;
        }
        for (const menuItemMock of this.menuItemMocks) {
            let normalizedOptionText = menuItemMock.datalistOption.textContent.toLowerCase().trim();
            let normalizedOptionValue = menuItemMock.datalistOption.value.toLowerCase().trim();
            let normalizedOptionSubtext = menuItemMock.datalistOption.dataset.subtext?.toLowerCase().trim() ?? "";
            let normalizedText = value.toLowerCase().trim();
            if (menuItemMock.datalistOption.textContent === value ||
                menuItemMock.datalistOption.dataset.subtext === value ||
                menuItemMock.datalistOption.value === value) {
                menuItemMock.classList.remove("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-autocomplete-menu-optgroup"))
                    menuItemMock.parentElement.classList.remove("hidden");
                this.visibleOptions++;
                this.adjustHighlightRange(menuItemMock, normalizedOptionText, normalizedOptionSubtext, normalizedOptionValue, normalizedText);
            }
            else if (normalizedOptionText.includes(normalizedText) ||
                normalizedOptionSubtext.includes(normalizedText) ||
                normalizedOptionValue.includes(normalizedText)) {
                menuItemMock.classList.remove("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-autocomplete-menu-optgroup"))
                    menuItemMock.parentElement.classList.remove("hidden");
                this.visibleOptions++;
                this.adjustHighlightRange(menuItemMock, normalizedOptionText, normalizedOptionSubtext, normalizedOptionValue, normalizedText);
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
            this.menuMock.style.top = `${inputRect.bottom + window.scrollY + 5}px`;
            this.menuMock.style.height = `${window.innerHeight - inputRect.bottom - 10}px`;
        }
        else if (inputRect.bottom + menuRect.height + 15 > window.innerHeight) {
            this.menuMock.style.top = `${inputRect.top - menuRect.height - 5 + window.scrollY}px`;
        }
        else {
            this.menuMock.style.top = `${inputRect.bottom + window.scrollY + 5}px`;
        }
        console.debug(`Positioning menu to ${inputRect.width}, ${inputRect.left}.`);
        this.menuMock.style.minWidth = `${inputRect.width}px`;
        this.menuMock.style.left = `${inputRect.left}px`;
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
        if (!this.datalistElement)
            return;
        this.menuItemMocks = [];
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
        let menuItemMock = Redom.el("li.atmos-autocomplete-menu-item", {
            title: option.title
        });
        Redom.mount(parent, menuItemMock);
        let textMock = Redom.el("span.atmos-autocomplete-menu-item-text", option.textContent);
        Redom.mount(menuItemMock, textMock);
        if (this.isSubtextShown && (option.dataset.subtext || option.value !== option.textContent)) {
            let menuItemSubtext = Redom.el("small.atmos-autocomplete-menu-item-value", option.dataset.subtext || option.value);
            Redom.mount(textMock, menuItemSubtext);
        }
        menuItemMock["datalistOption"] = option;
        if (this.inputElement.value === option.textContent && !option.disabled) {
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
        this.menuItemMocks.push(menuItemMock);
    }
    adjustHighlightRange(menuItemMock, optionText, optionSubtext, optionValue, valueToTestFor) {
        if (!CSS.highlights)
            return;
        this.createOrModifyHighlightRange(menuItemMock.querySelector(".atmos-autocomplete-menu-item-text").childNodes[0], optionText, valueToTestFor);
        if ((optionSubtext && optionSubtext !== optionText) || optionValue !== optionText) {
            this.createOrModifyHighlightRange(menuItemMock.querySelector(".atmos-autocomplete-menu-item-value").childNodes[0], optionSubtext || optionValue, valueToTestFor);
        }
    }
    createOrModifyHighlightRange(textNode, optionText, value) {
        if (!textNode.highlightRange) {
            textNode.highlightRange = new Range();
        }
        let start = optionText.indexOf(value);
        if (start >= 0) {
            textNode.highlightRange.setStart(textNode, start);
            textNode.highlightRange.setEnd(textNode, start + value.length);
            AtmosAutocomplete.customHighlight.add(textNode.highlightRange);
        }
        else {
            AtmosAutocomplete.customHighlight.delete(textNode.highlightRange);
        }
    }
    hideHighlightRange(menuItemMock) {
        if (!CSS.highlights)
            return;
        let range = menuItemMock.querySelector(".atmos-autocomplete-menu-item-text").childNodes[0]?.highlightRange;
        if (range)
            AtmosAutocomplete.customHighlight.delete(range);
        range = menuItemMock.querySelector(".atmos-autocomplete-menu-item-value")?.childNodes[0]?.highlightRange;
        if (range)
            AtmosAutocomplete.customHighlight.delete(range);
    }
}
window["AtmosAutocomplete"] = AtmosAutocomplete;
AtmosAutocomplete.init();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXRtb3NBdXRvY29tcGxldGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvYXRtb3NBdXRvY29tcGxldGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxLQUFLLEtBQUssTUFBTSxPQUFPLENBQUM7QUFFL0IsTUFBTSxDQUFDLE9BQU8sT0FBTyxpQkFBaUI7SUFDMUIsTUFBTSxDQUFDLGFBQWEsR0FBRyxJQUFJLEdBQUcsRUFBdUMsQ0FBQztJQUN0RSxNQUFNLENBQUMsa0JBQWtCLENBQW9CO0lBRTdDLFlBQVksQ0FBbUI7SUFDL0IsZUFBZSxDQUFzQjtJQUNyQyxRQUFRLENBQWM7SUFDdEIsb0JBQW9CLENBQWdCO0lBQ3BDLG9CQUFvQixDQUFvQjtJQUV4Qyw2QkFBNkIsQ0FBbUI7SUFDaEQsNENBQTRDLENBQW1CO0lBQy9ELFNBQVMsR0FBUSxFQUFFLENBQUM7SUFDcEIsY0FBYyxHQUFXLENBQUMsQ0FBQztJQUMzQixhQUFhLEdBQUcsSUFBSSxLQUFLLEVBQWlCLENBQUM7SUFFM0MsTUFBTSxDQUFDLGVBQWUsQ0FBWTtJQUUxQyxZQUFZLFlBQThCLEVBQUUsZUFBb0M7UUFDNUUsSUFBSSxpQkFBaUIsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQztZQUFFLE9BQU87UUFDOUQsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7UUFDakMsSUFBSSxDQUFDLGVBQWUsR0FBRyxlQUFlLENBQUM7UUFHdkMsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBR3JCLElBQUksQ0FBQyxTQUFTLENBQUMsa0JBQWtCLEdBQUcsR0FBRyxFQUFFO1lBQ3JDLElBQUksSUFBSSxDQUFDLGlCQUFpQjtnQkFDdEIsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVE7Z0JBQzNCLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFFB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