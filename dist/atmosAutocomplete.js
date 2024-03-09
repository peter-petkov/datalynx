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
            let itemText = menuItemMock.querySelector(".atmos-autocomplete-menu-item-text");
            if (itemText.textContent !== menuItemMock.datalistOption.textContent) {
                itemText.textContent = menuItemMock.datalistOption.textContent;
            }
            let valueToTestAgainst = menuItemMock.datalistOption.dataset.subtext ||
                (itemText.textContent !==
                    menuItemMock.datalistOption.value ?
                    menuItemMock.datalistOption.value :
                    undefined);
            let itemSubtext = menuItemMock.querySelector(".atmos-autocomplete-menu-item-value");
            if (itemSubtext && valueToTestAgainst && itemSubtext.textContent !== valueToTestAgainst) {
                itemSubtext.textContent = valueToTestAgainst;
            }
            menuItemMock?.classList.remove("selected");
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
            Redom.mount(menuItemMock, menuItemSubtext);
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
        if (!textNode)
            return;
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