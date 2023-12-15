import * as Redom from "redom";
export default class AtmosAutocomplete {
    static autocompletes = new Map();
    static openedAutocomplete;
    inputElement;
    datalistElement;
    mocksWrapper;
    menuMock;
    selectedMenuItemMock;
    showAllOptionsButton;
    optionsChangeMutationObserver;
    inputElementAttributesChangeMutationObserver;
    listeners = {};
    visibleOptions = 0;
    menuItemMocks = new Array();
    constructor(inputElement, datalistElement) {
        if (AtmosAutocomplete.autocompletes.has(inputElement))
            return;
        this.inputElement = inputElement;
        this.datalistElement = datalistElement;
        this.generateMocks();
        this.listeners.inputFocusListener = () => {
            if (!this.inputElement.readOnly && this.menuItemMocks.some(c => !c.classList.contains("hidden"))) {
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
        this.mocksWrapper.addEventListener("keydown", (e) => {
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
        });
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
            if (!this.datalistElement)
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
                    if (addedNode.dataset?.toggles === "autocomplete")
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
                    if (removedNode.dataset?.toggles === "autocomplete")
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
    async refreshMenu() {
        await new Promise(resolve => requestAnimationFrame(resolve));
        this.listeners.inputListener?.(new CustomEvent("change", { detail: { filterMenu: false } }));
    }
    destroy() {
        this.inputElement.removeEventListener("focus", this.listeners.inputFocusListener);
        this.inputElement.removeEventListener("input", this.listeners.inputListener);
        this.inputElement.removeEventListener("change", this.listeners.inputListener);
        this.optionsChangeMutationObserver.disconnect();
        this.inputElementAttributesChangeMutationObserver.disconnect();
        if (this.datalistElement)
            this.inputElement.setAttribute("list", this.datalistElement.id);
        this.mocksWrapper.insertAdjacentElement("afterend", this.inputElement);
        this.menuMock.remove();
        this.mocksWrapper.remove();
        AtmosAutocomplete.autocompletes.delete(this.inputElement);
        if (AtmosAutocomplete.openedAutocomplete === this)
            AtmosAutocomplete.openedAutocomplete = null;
        this.inputElement = null;
        this.datalistElement = null;
        this.mocksWrapper = null;
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
            return;
        }
        for (const menuItemMock of this.menuItemMocks) {
            let normalizedOptionText = menuItemMock.datalistOption.textContent.toLowerCase().trim();
            let normalizedOptionValue = menuItemMock.datalistOption.value.toLowerCase().trim();
            let normalizedText = value.toLowerCase().trim();
            if (menuItemMock.datalistOption.textContent === value || menuItemMock.datalistOption.value === value) {
                menuItemMock.classList.remove("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-autocomplete-menu-optgroup"))
                    menuItemMock.parentElement.classList.remove("hidden");
                this.visibleOptions++;
            }
            else if (normalizedOptionText.includes(normalizedText) || normalizedOptionValue.includes(normalizedText)) {
                menuItemMock.classList.remove("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-autocomplete-menu-optgroup"))
                    menuItemMock.parentElement.classList.remove("hidden");
                this.visibleOptions++;
            }
            else {
                menuItemMock.classList.add("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-autocomplete-menu-optgroup"))
                    menuItemMock.parentElement.classList.add("hidden");
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
        let mocksWrapper = Redom.el("div.atmos-autocomplete-wrapper");
        this.inputElement.insertAdjacentElement("afterend", mocksWrapper);
        this.mocksWrapper = mocksWrapper;
        this.inputElement.classList.add("atmos-autocomplete-input");
        this.inputElement.removeAttribute("list");
        mocksWrapper.appendChild(this.inputElement);
        let menuMock = Redom.el("ul.atmos-autocomplete-menu.hidden");
        if (this.inputElement.id)
            menuMock.dataset.origin = this.inputElement.id;
        Redom.mount(document.body, menuMock);
        this.menuMock = menuMock;
        let showAllOptionsButton = Redom.el("button.atmos-autocomplete-menu-toggle", {
            tabIndex: -1,
            type: "button",
            disabled: this.inputElement.disabled || this.inputElement.readOnly,
            title: "Show all"
        });
        Redom.mount(mocksWrapper, showAllOptionsButton);
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
        let menuItemMock = Redom.el("li.atmos-autocomplete-menu-item", option.textContent, {
            title: option.title
        });
        Redom.mount(parent, menuItemMock);
        if (option.value !== option.textContent && this.inputElement.dataset.showValues !== "false") {
            let menuItemSubtext = Redom.el("small.atmos-autocomplete-menu-item-value", option.value);
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
}
window["AtmosAutocomplete"] = AtmosAutocomplete;
AtmosAutocomplete.init();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXRtb3NBdXRvY29tcGxldGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvYXRtb3NBdXRvY29tcGxldGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxLQUFLLEtBQUssTUFBTSxPQUFPLENBQUM7QUFFL0IsTUFBTSxDQUFDLE9BQU8sT0FBTyxpQkFBaUI7SUFDMUIsTUFBTSxDQUFDLGFBQWEsR0FBRyxJQUFJLEdBQUcsRUFBa0MsQ0FBQztJQUNqRSxNQUFNLENBQUMsa0JBQWtCLENBQW9CO0lBRTdDLFlBQVksQ0FBbUI7SUFDL0IsZUFBZSxDQUFzQjtJQUNyQyxZQUFZLENBQWM7SUFDMUIsUUFBUSxDQUFjO0lBQ3RCLG9CQUFvQixDQUFnQjtJQUNwQyxvQkFBb0IsQ0FBb0I7SUFFeEMsNkJBQTZCLENBQW1CO0lBQ2hELDRDQUE0QyxDQUFtQjtJQUMvRCxTQUFTLEdBQVEsRUFBRSxDQUFDO0lBQ3BCLGNBQWMsR0FBVyxDQUFDLENBQUM7SUFDM0IsYUFBYSxHQUFHLElBQUksS0FBSyxFQUFpQixDQUFDO0lBRW5ELFlBQVksWUFBOEIsRUFBRSxlQUFvQztRQUM1RSxJQUFJLGlCQUFpQixDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDO1lBQUUsT0FBTztRQUM5RCxJQUFJLENBQUMsWUFBWSxHQUFHLFlBQVksQ0FBQztRQUNqQyxJQUFJLENBQUMsZUFBZSxHQUFHLGVBQWUsQ0FBQztRQUd2QyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7UUFHckIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsR0FBRyxHQUFHLEVBQUU7WUFDckMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFO2dCQUM5RixJ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