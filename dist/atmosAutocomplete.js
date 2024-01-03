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
            if (!this.datalistElement || this.inputElement.dataset.suggest?.toLowerCase() === "true")
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
                    if (!(addedNode instanceof HTMLInputElement))
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
                    if (!(removedNode instanceof HTMLInputElement))
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
            if (!AtmosAutocomplete.openedAutocomplete || AtmosAutocomplete.openedAutocomplete.hidden || e.target === AtmosAutocomplete.openedAutocomplete.menuMock)
                return;
            let inputRect = AtmosAutocomplete.openedAutocomplete.inputElement.getBoundingClientRect();
            if (!initialRect)
                initialRect = inputRect;
            AtmosAutocomplete.openedAutocomplete.menuMock.style.transform =
                `translate(${inputRect.right - initialRect.right}px, ${inputRect.bottom - initialRect.bottom}px)`;
        }, { capture: true, passive: true });
        window.addEventListener("scrollend", (e) => {
            if (!AtmosAutocomplete.openedAutocomplete || AtmosAutocomplete.openedAutocomplete.hidden || e.target === AtmosAutocomplete.openedAutocomplete.menuMock)
                return;
            AtmosAutocomplete.openedAutocomplete.positionMenuMock();
            initialRect = null;
        }, { capture: true, passive: true });
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
        if (this.inputElement.dataset.suggest?.toLowerCase() === "true")
            menuMock.classList.add("readonly");
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
        if (option.value !== option.textContent && this.inputElement.dataset.showValues === "true") {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXRtb3NBdXRvY29tcGxldGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvYXRtb3NBdXRvY29tcGxldGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxLQUFLLEtBQUssTUFBTSxPQUFPLENBQUM7QUFFL0IsTUFBTSxDQUFDLE9BQU8sT0FBTyxpQkFBaUI7SUFDMUIsTUFBTSxDQUFDLGFBQWEsR0FBRyxJQUFJLEdBQUcsRUFBdUMsQ0FBQztJQUN0RSxNQUFNLENBQUMsa0JBQWtCLENBQW9CO0lBRTdDLFlBQVksQ0FBbUI7SUFDL0IsZUFBZSxDQUFzQjtJQUNyQyxZQUFZLENBQWM7SUFDMUIsUUFBUSxDQUFjO0lBQ3RCLG9CQUFvQixDQUFnQjtJQUNwQyxvQkFBb0IsQ0FBb0I7SUFFeEMsNkJBQTZCLENBQW1CO0lBQ2hELDRDQUE0QyxDQUFtQjtJQUMvRCxTQUFTLEdBQVEsRUFBRSxDQUFDO0lBQ3BCLGNBQWMsR0FBVyxDQUFDLENBQUM7SUFDM0IsYUFBYSxHQUFHLElBQUksS0FBSyxFQUFpQixDQUFDO0lBRW5ELFlBQVksWUFBOEIsRUFBRSxlQUFvQztRQUM1RSxJQUFJLGlCQUFpQixDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDO1lBQUUsT0FBTztRQUM5RCxJQUFJLENBQUMsWUFBWSxHQUFHLFlBQVksQ0FBQztRQUNqQyxJQUFJLENBQUMsZUFBZSxHQUFHLGVBQWUsQ0FBQztRQUd2QyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7UUFHckIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsR0FBRyxHQUFHLEVBQUU7WUFDckMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFO2dCQUM5RixJ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