import * as Redom from "redom";
export default class AtmosAutocomplete {
    static autocompletes = new Map();
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
                    this.inputElement.dispatchEvent(new CustomEvent("beforeshow.atmos-autocomplete"));
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
                this.inputElement.dispatchEvent(new CustomEvent("beforeshow.atmos-autocomplete"));
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
        this.listeners.documentClickListener = (e) => {
            let target = e.target;
            if (target.closest(".atmos-autocomplete-menu") === this.menuMock) {
                if (target.closest(".atmos-autocomplete-menu-item.disabled")) {
                    return;
                }
            }
            else if (target.closest(".atmos-autocomplete-input") === this.inputElement) {
                return;
            }
            else if (this.showAllOptionsButton && target.closest(".atmos-autocomplete-menu-toggle") === this.showAllOptionsButton) {
                return;
            }
            this.hide();
        };
        document.addEventListener("click", this.listeners.documentClickListener);
        this.listeners.documentResizeListener = () => {
            if (!this.hidden)
                this.positionMenuMock();
        };
        window.addEventListener("resize", this.listeners.documentResizeListener);
        this.showAllOptionsButton?.addEventListener("click", () => {
            if (!this.datalistElement)
                return;
            this.inputElement.dispatchEvent(new CustomEvent("beforeshow.atmos-autocomplete"));
            this.filterMenuMock("");
            if (this.hidden)
                this.show();
            this.positionMenuMock();
            this.selectedMenuItemMock?.scrollIntoView({ block: "nearest" });
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
    }
    static get(element) {
        return this.autocompletes.get(element);
    }
    hide() {
        this.menuMock.classList.add("hidden");
        this.menuMock.dispatchEvent(new CustomEvent("hide.atmos-autocomplete"));
    }
    show() {
        if (!this.visibleOptions)
            return;
        for (const [_, autocomplete] of AtmosAutocomplete.autocompletes) {
            if (!autocomplete.hidden)
                autocomplete.hide();
        }
        this.menuMock.classList.remove("hidden");
        this.menuMock.dispatchEvent(new CustomEvent("show.atmos-autocomplete"));
    }
    toggle() {
        if (!this.visibleOptions && this.hidden)
            return;
        this.menuMock.classList.toggle("hidden");
        this.positionMenuMock();
        let customEvent = this.menuMock.classList.contains("hidden")
            ? new CustomEvent("hide.atmos-autocomplete")
            : new CustomEvent("show.atmos-autocomplete");
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
        document.removeEventListener("click", this.listeners.documentClickListener);
        document.removeEventListener("resize", this.listeners.documentResizeListener);
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
        if (this.inputElement.dataset.wrapperClass)
            mocksWrapper.classList.add(this.inputElement.dataset.wrapperClass);
        if (this.inputElement.dataset.menuClass)
            menuMock.classList.add(this.inputElement.dataset.menuClass);
        if (this.inputElement.dataset.showAllButtonClass)
            this.showAllOptionsButton.classList.add(this.inputElement.dataset.showAllButtonClass);
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
        if (this.inputElement.dataset.menuItemClass)
            menuItemMock.classList.add(this.inputElement.dataset.menuItemClass);
        this.menuItemMocks.push(menuItemMock);
    }
}
window["AtmosAutocomplete"] = AtmosAutocomplete;
AtmosAutocomplete.init();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXRtb3NBdXRvY29tcGxldGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvYXRtb3NBdXRvY29tcGxldGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxLQUFLLEtBQUssTUFBTSxPQUFPLENBQUM7QUFFL0IsTUFBTSxDQUFDLE9BQU8sT0FBTyxpQkFBaUI7SUFDMUIsTUFBTSxDQUFDLGFBQWEsR0FBRyxJQUFJLEdBQUcsRUFBa0MsQ0FBQztJQUVqRSxZQUFZLENBQW1CO0lBQy9CLGVBQWUsQ0FBc0I7SUFDckMsWUFBWSxDQUFjO0lBQzFCLFFBQVEsQ0FBYztJQUN0QixvQkFBb0IsQ0FBZ0I7SUFDcEMsb0JBQW9CLENBQW9CO0lBQ3hDLDZCQUE2QixDQUFtQjtJQUNoRCw0Q0FBNEMsQ0FBbUI7SUFDL0QsU0FBUyxHQUFRLEVBQUUsQ0FBQztJQUNwQixjQUFjLEdBQVcsQ0FBQyxDQUFDO0lBQzNCLGFBQWEsR0FBRyxJQUFJLEtBQUssRUFBaUIsQ0FBQztJQUVuRCxZQUFZLFlBQThCLEVBQUUsZUFBb0M7UUFDNUUsSUFBSSxpQkFBaUIsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQztZQUFFLE9BQU87UUFDOUQsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7UUFDakMsSUFBSSxDQUFDLGVBQWUsR0FBRyxlQUFlLENBQUM7UUFHdkMsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBR3JCLElBQUksQ0FBQyxTQUFTLENBQUMsa0JBQWtCLEdBQUcsR0FBRyxFQUFFO1lBQ3JDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRTtnQkFDOUYsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO29CQUNi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