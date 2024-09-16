// @ts-ignore
import * as Redom from "redom";

export default class AtmosAutocomplete {
    private static autocompletes = new Map<HTMLInputElement, AtmosAutocomplete>();
    private static openedAutocomplete: AtmosAutocomplete;

    private inputElement: HTMLInputElement;
    private datalistElement: HTMLDataListElement;
    private menuMock: HTMLElement;
    private selectedMenuItemMock: HTMLLIElement;
    private showAllOptionsButton: HTMLButtonElement;

    private optionsChangeMutationObserver: MutationObserver;
    private inputElementAttributesChangeMutationObserver: MutationObserver;
    private listeners: any = {};
    private visibleOptions: number = 0;
    private menuItemMocks = new Array<HTMLLIElement>();
    // @ts-ignore Not yet in DOM typings.
    private static customHighlight: Highlight;
    private static maxHighlights = 100;

    constructor(inputElement: HTMLInputElement, datalistElement: HTMLDataListElement) {
        if (AtmosAutocomplete.autocompletes.has(inputElement)) return;
        this.inputElement = inputElement;
        this.datalistElement = datalistElement;

        // First, generate the extra elements.
        this.generateMocks();

        // When focusing the input, if at least 1 option matches the input filter, show the option menu.
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
                    if (!result) return;

                    this.show();
                } else if (!this.visibleOptions) {
                    this.hide();
                }

                this.positionMenuMock();

                this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });
            }
        };
        this.inputElement.addEventListener("focus", this.listeners.inputFocusListener);

        // Keyboard navigation to match the native select element's feature
        this.listeners.keydownListener = (e) => {
            if (!this.datalistElement) return;

            if (e.code === "ArrowDown") {
                e.preventDefault();
                if (!this.visibleOptions) return;

                // If the user pressed the down arrow, search the first visible option below the currently selected one
                // or cycle back to the first visible one.
                let nextOption = this.selectedMenuItemMock;
                let i = this.menuItemMocks.indexOf(nextOption);
                let previousOption: HTMLLIElement;
                do {
                    previousOption = nextOption;
                    nextOption = this.menuItemMocks[++i] as HTMLLIElement;
                    if (!nextOption) {
                        i = 0;
                        nextOption = this.menuItemMocks[0] as HTMLLIElement
                    }
                } while (!nextOption ||
                (previousOption && nextOption.datalistOption.textContent === previousOption.datalistOption.textContent) ||
                nextOption.classList.contains("hidden") ||
                nextOption.classList.contains("disabled"))

                this.updateInputElement(nextOption.datalistOption.textContent);

                this.inputElement.dispatchEvent(new CustomEvent("change", {
                    bubbles: true,
                    detail: { filterMenu: false }
                }));

                this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });
            } else if (e.code === "ArrowUp") {
                e.preventDefault();
                if (!this.visibleOptions) return;

                // If the user pressed the up arrow, search the first visible option above the currently selected one
                // or cycle back to the last visible one.
                let nextOption = this.selectedMenuItemMock;
                let i = this.menuItemMocks.indexOf(nextOption);
                let previousOption;
                do {
                    previousOption = nextOption;
                    nextOption = this.menuItemMocks[--i] as HTMLLIElement;
                    if (!nextOption) {
                        i = this.menuItemMocks.length - 1;
                        nextOption = this.menuItemMocks[this.menuItemMocks.length - 1] as HTMLLIElement
                    }
                } while (!nextOption ||
                (previousOption && nextOption.datalistOption.textContent === previousOption.datalistOption.textContent) ||
                nextOption.classList.contains("hidden") ||
                nextOption.classList.contains("disabled"))

                this.updateInputElement(nextOption.datalistOption.textContent);

                this.inputElement.dispatchEvent(new CustomEvent("change", {
                    bubbles: true,
                    detail: { filterMenu: false }
                }));

                this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });
            } else if (e.code === "Escape") {
                // Close the option menu on Escape key
                e.preventDefault();
                this.hide();
            } else if (e.code === "Enter") {
                // Toggle the option menu on Enter key
                e.preventDefault();
                this.toggle();
            } else if (e.code === "Tab") {
                this.hide()
            }
        };
        this.inputElement.addEventListener("keydown", this.listeners.keydownListener);

        // When the user inputs a value to the autocomplete input, filter the menu mock
        // to only show options that match (partially or fully) the typed value.
        this.listeners.inputListener = (e?: CustomEvent) => {
            if (!this.datalistElement) return;

            if (this.hidden && e?.type === "input" && this.visibleOptions) {
                let result = this.inputElement.dispatchEvent(new CustomEvent("beforeshow.atmos-autocomplete", {
                    detail: {
                        filter: this.inputElement.value
                    },
                    cancelable: true
                }));
                if (!result) return;
            }

            if (e?.detail?.filterMenu !== false) {
                this.filterMenuMock(this.inputElement.value);
            }

            let selectedOption = this.menuItemMocks
                .find(o => !o.datalistOption.disabled && o.datalistOption.textContent.trim() === this.inputElement.value.trim());

            this.updateMenuMock(selectedOption);

            this.updateInputElementTitle(this.selectedMenuItemMock?.title);

            if (this.hidden && e?.type === "input") this.show();
            else if (!this.visibleOptions) this.hide();

            this.positionMenuMock();

            this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });
        }
        this.inputElement.addEventListener("input", this.listeners.inputListener);
        this.inputElement.addEventListener("change", this.listeners.inputListener);

        // When the user clicks on an option in the menu mock, select the option in the select element
        // and set the input mock value to it.
        this.menuMock.addEventListener("click", e => {
            if (!this.datalistElement || this.isSuggestModeEnabled) return;

            let target = (<HTMLElement>e.target).closest<HTMLLIElement>(".atmos-autocomplete-menu-item");
            if (!target) return;

            if (target.classList.contains("disabled")) return;

            this.updateInputElement(target.datalistOption.textContent);

            this.inputElement.dispatchEvent(new CustomEvent("change", {
                bubbles: true,
                detail: { filterMenu: false }
            }));

            this.inputElement.focus();
        });

        // When the user clicks on the "Show all" button, clear the filter and show all entries.
        this.showAllOptionsButton?.addEventListener("click", () => {
            if (!this.datalistElement) return;

            let result = this.inputElement.dispatchEvent(new CustomEvent("beforeshow.atmos-autocomplete", {
                detail: {
                    filter: ""
                },
                cancelable: true
            }));
            if (!result) return;

            this.filterMenuMock("", false);

            if (this.hidden) this.show();
            this.positionMenuMock();

            this.selectedMenuItemMock?.scrollIntoView({ block: "nearest" });

            this.inputElement.focus();
        });

        // Watch the datalist element's options for additions or removals, mirroring the structure every time.
        this.optionsChangeMutationObserver = new MutationObserver(() => {
            // If the options count has changed (added/removed options) or it has stayed the same but some options
            // have been swapped (detected by the custom datalistOption property), regenerate the option mocks.
            // This helps to not needlessly regenerate every time the slightest change is made, or the options
            // have been manually regenerated by calling the generateOptionMocks() method.
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

        // Watch the input element's attributes for changes, mirroring their state in the input mock.
        this.inputElementAttributesChangeMutationObserver = new MutationObserver(() => {
            if (this.showAllOptionsButton) this.showAllOptionsButton.disabled = inputElement.disabled || inputElement.readOnly;

            // Detect if the input element's list has been changed.
            if (this.inputElement.list) {
                this.pauseOptionsChangeObserver();

                this.datalistElement = this.inputElement.list as HTMLDataListElement;
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

    private get shouldOpenOnFocus() {
        return this.inputElement.dataset.focusOpen !== "false";
    }

    private get isSuggestModeEnabled() {
        return this.inputElement.dataset.suggest === "true";
    }

    private get isSubtextShown() {
        return this.inputElement.dataset.subtext === "true";
    }

    private get menuPosition() {
        return this.inputElement.dataset.menuPosition ?? "";
    }

    private get hidden() {
        return this.menuMock.classList.contains("hidden");
    }

    static init() {
        let inputElements = document.querySelectorAll<HTMLInputElement>("[data-toggle=autocomplete]");

        // Autodetect and create an autocomplete component for each input element found.
        for (const inputElement of inputElements) {
            new AtmosAutocomplete(inputElement, inputElement.list as HTMLDataListElement);
        }

        // Place an observer to create an autocomplete whenever an input element with an autocomplete toggle gets added.
        new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const addedNode of mutation.addedNodes) {
                    if (!(addedNode instanceof HTMLElement)) continue;

                    let toggles = [];
                    if (addedNode.dataset?.toggle === "autocomplete") toggles.push(addedNode as HTMLInputElement);
                    toggles.push(...addedNode.querySelectorAll<HTMLInputElement>("[data-toggle=autocomplete]"));

                    for (const toggle of toggles) {
                        // Skip initialization if component has already been initialized before detection.
                        if (this.autocompletes.has(toggle)) continue;

                        new AtmosAutocomplete(toggle, toggle.list as HTMLDataListElement);
                    }
                }

                for (const removedNode of mutation.removedNodes) {
                    if (!(removedNode instanceof HTMLElement)) continue;

                    let toggles = [];
                    if (removedNode.dataset?.toggle === "autocomplete") toggles.push(removedNode as HTMLInputElement);
                    toggles.push(...removedNode.querySelectorAll<HTMLInputElement>("[data-toggle=autocomplete]"));

                    for (const toggle of toggles) {
                        AtmosAutocomplete.get(toggle)?.destroy();
                    }
                }
            }
        }).observe(document, {
            childList: true,
            subtree: true
        });

        // When the user clicks somewhere else, close the opened menu mock.
        document.addEventListener("click", (e) => {
            // There is no menu open, and we don't need to execute more logic.
            if (!AtmosAutocomplete.openedAutocomplete) return;

            let target = e.target as HTMLElement;
            if (target.closest(".atmos-autocomplete-menu") === AtmosAutocomplete.openedAutocomplete.menuMock) {
                // Don't close the menu if the user clicks inside of it.
                if (target.closest(".atmos-autocomplete-menu-item.disabled")) {
                    // Don't close the menu if the user clicks on a disabled option.
                    return;
                } else if (target.closest(".atmos-autocomplete-menu-optgroup") &&
                    !target.closest(".atmos-autocomplete-menu-item")) {
                    return;
                } else if (target.closest(".atmos-autocomplete-menu.readonly")) {
                    return;
                }
            } else if (target.closest(".atmos-autocomplete-input") ===
                AtmosAutocomplete.openedAutocomplete.inputElement) {
                // Don't close the menu if the user clicks on the input.
                return;
            } else if (AtmosAutocomplete.openedAutocomplete.showAllOptionsButton &&
                target.closest(".atmos-autocomplete-menu-toggle") ===
                AtmosAutocomplete.openedAutocomplete.showAllOptionsButton) {
                // Don't close the menu if the user clicks on the "Show all" button.
                return;
            }

            AtmosAutocomplete.openedAutocomplete.hide();
        });

        // Reposition the menu mock when the user resizes the container in any way (for example Ctrl+Scroll).
        window.addEventListener("resize", () => {
            if (!AtmosAutocomplete.openedAutocomplete) return;

            if (!AtmosAutocomplete.openedAutocomplete.hidden) AtmosAutocomplete.openedAutocomplete.positionMenuMock();
        });

        let initialRect: DOMRect;
        // Scroll-linked positioning for the menu mock. Triggers warnings in Firefox!!!.
        window.addEventListener("scroll", (e) => {
            if (!AtmosAutocomplete.openedAutocomplete ||
                AtmosAutocomplete.openedAutocomplete.hidden ||
                e.target === AtmosAutocomplete.openedAutocomplete.menuMock) return;

            let inputRect = AtmosAutocomplete.openedAutocomplete.inputElement.getBoundingClientRect();
            if (!initialRect) initialRect = inputRect;

            if (e.target !== document)
                AtmosAutocomplete.openedAutocomplete.menuMock.style.transform =
                    `translate(${inputRect.right - initialRect.right}px, ${inputRect.bottom - initialRect.bottom}px)`;
        }, { capture: true, passive: true });

        window.addEventListener("scrollend", (e) => {
            if (!AtmosAutocomplete.openedAutocomplete ||
                AtmosAutocomplete.openedAutocomplete.hidden ||
                e.target === AtmosAutocomplete.openedAutocomplete.menuMock) return;

            AtmosAutocomplete.openedAutocomplete.positionMenuMock();
            initialRect = null;
        }, { capture: true, passive: true });


        // @ts-ignore Not yet in DOM typings.
        if (CSS.highlights) {
            // @ts-ignore Not yet in DOM typings.
            this.customHighlight = new Highlight();
            // @ts-ignore Not yet in DOM typings.
            CSS.highlights.set("atmos-autocomplete-highlight", this.customHighlight);
        }
    }

    static get(element: HTMLInputElement) {
        return this.autocompletes.get(element);
    }

    hide() {
        this.menuMock.classList.add("hidden");

        AtmosAutocomplete.openedAutocomplete = null;

        this.menuMock.dispatchEvent(new CustomEvent("hide.atmos-autocomplete"));
    }

    show() {
        if (!this.visibleOptions) return;

        // First hide other menu mocks, since only one needs to be shown at one time.
        if (!AtmosAutocomplete.openedAutocomplete?.hidden) AtmosAutocomplete.openedAutocomplete?.hide();

        this.menuMock.classList.remove("hidden");

        AtmosAutocomplete.openedAutocomplete = this;

        this.menuMock.dispatchEvent(new CustomEvent("show.atmos-autocomplete"));
    }

    toggle() {
        if (!this.visibleOptions && this.hidden) return;

        if (this.hidden) {
            // First hide other menu mocks, since only one needs to be shown at one time.
            if (!AtmosAutocomplete.openedAutocomplete?.hidden) AtmosAutocomplete.openedAutocomplete?.hide();
        }

        this.menuMock.classList.toggle("hidden");
        this.positionMenuMock();

        let customEvent: CustomEvent;
        if (!this.menuMock.classList.contains("hidden")) {
            customEvent = new CustomEvent("show.atmos-autocomplete");
            AtmosAutocomplete.openedAutocomplete = this;
        } else {
            customEvent = new CustomEvent("hide.atmos-autocomplete");
            AtmosAutocomplete.openedAutocomplete = null;
        }

        this.menuMock.dispatchEvent(customEvent);
    }

    pauseOptionsChangeObserver() {
        this.optionsChangeMutationObserver.disconnect();
    }

    resumeOptionsChangeObserver() {
        if (!this.datalistElement) return;

        this.optionsChangeMutationObserver.observe(this.datalistElement, {
            childList: true
        });
    }

    refreshMenu() {
        let selectedOption = this.menuItemMocks
            .find(o => !o.datalistOption.disabled && o.datalistOption.textContent.trim() === this.inputElement.value.trim());
        if (this.datalistElement.options.length !== this.menuItemMocks.length ||
            this.menuItemMocks.some(item => !item.datalistOption.isConnected)) {
            // If an option count or swap has been detected, manually regenerate all option mocks
            // without waiting for the dedicated mutation observer to fire. The observer then
            // checks for the same conditions in order to prevent double regeneration.
            this.generateOptionMocks();
        } else {
            // Else just update the selected options and text content.
            this.updateMenuMock(selectedOption);
        }

        this.updateInputElementTitle(this.selectedMenuItemMock?.title);
    }

    destroy() {
        // First remove all associated event listeners on elements that will remain.
        // The rest of the listeners will be removed when we remove the mocks.
        this.inputElement.removeEventListener("focus", this.listeners.inputFocusListener);
        this.inputElement.removeEventListener("input", this.listeners.inputListener);
        this.inputElement.removeEventListener("change", this.listeners.inputListener);
        this.inputElement.removeEventListener("keydown", this.listeners.keydownListener);

        // Disconnect all associated mutation observers.
        this.optionsChangeMutationObserver.disconnect();
        this.inputElementAttributesChangeMutationObserver.disconnect();

        if (this.datalistElement) this.inputElement.setAttribute("list", this.datalistElement.id);

        // Remove the mocks from the DOM tree and the autocomplete collection.
        this.menuMock.remove();
        this.showAllOptionsButton.remove();
        AtmosAutocomplete.autocompletes.delete(this.inputElement);

        if (AtmosAutocomplete.openedAutocomplete === this) AtmosAutocomplete.openedAutocomplete = null;

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

    private updateInputElement(value: string) {
        this.inputElement.value = value ?? "";
    }

    private updateInputElementTitle(value: string) {
        if (!value === null || value === undefined) value = "";

        if (value?.toString()) {
            this.inputElement.title = value?.toString();
        } else {
            this.inputElement.removeAttribute("title");
        }
    }

    private updateMenuMock(selectedOption: HTMLLIElement) {
        console.debug(`Update menu's options.`);

        let value = this.inputElement.value.trim().toLowerCase();
        for (const menuItemMock of this.menuItemMocks) {
            let hasContentBeenUpdated = false;
            let itemText = menuItemMock.querySelector(".atmos-autocomplete-menu-item-text");
            if (itemText.textContent !== menuItemMock.datalistOption.textContent) {
                // The option mock might not have a text or value because
                // the datalist option does not have one either.
                itemText.textContent = menuItemMock.datalistOption.textContent;
                hasContentBeenUpdated = true;
            }

            let valueToTestAgainst = menuItemMock.datalistOption.dataset.subtext ||
                (itemText.textContent !==
                menuItemMock.datalistOption.value ?
                    menuItemMock.datalistOption.value :
                    undefined);
            let itemSubtext = menuItemMock.querySelector(".atmos-autocomplete-menu-item-value");
            if (itemSubtext && valueToTestAgainst && itemSubtext.textContent !== valueToTestAgainst) {
                itemSubtext.textContent = valueToTestAgainst;
                hasContentBeenUpdated = true;
            }

            menuItemMock?.classList.remove("selected");
            if (hasContentBeenUpdated && value) {
                this.adjustHighlightRange(menuItemMock,
                    menuItemMock.datalistOption.textContent.trim().toLowerCase(),
                    menuItemMock.datalistOption.dataset.subtext?.trim().toLowerCase(),
                    menuItemMock.datalistOption.value.trim().toLowerCase(),
                    value);
            }
        }

        this.selectedMenuItemMock = null;

        selectedOption?.classList.add("selected");
        this.selectedMenuItemMock = selectedOption;
    }

    private filterMenuMock(value: string, clearHighlights = true) {
        console.debug(`Filtering menu.`);

        this.visibleOptions = 0;

        // If input value is empty, show all the options.
        if (!value) {
            for (const menuItemMock of this.menuMock.querySelectorAll(".hidden")) {
                menuItemMock.classList.remove("hidden");
            }

            this.visibleOptions = this.datalistElement.children.length;
            if (clearHighlights) AtmosAutocomplete.customHighlight?.clear();

            return;
        }

        if (clearHighlights) AtmosAutocomplete.customHighlight?.clear();

        // Iterate the available options
        for (const menuItemMock of this.menuItemMocks) {
            // First normalize the values before comparing them.
            let normalizedOptionText = menuItemMock.datalistOption.textContent.toLowerCase().trim();
            let normalizedOptionValue = menuItemMock.datalistOption.value.toLowerCase().trim();
            let normalizedOptionSubtext = menuItemMock.datalistOption.dataset.subtext?.toLowerCase().trim() ?? "";
            let normalizedText = value.toLowerCase().trim();
            if (menuItemMock.datalistOption.textContent === value ||
                menuItemMock.datalistOption.dataset.subtext === value ||
                menuItemMock.datalistOption.value === value) {
                // Case in which we have a perfectly matching option.
                // Show the option mock.
                menuItemMock.classList.remove("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-autocomplete-menu-optgroup"))
                    menuItemMock.parentElement.classList.remove("hidden");

                this.visibleOptions++;

                this.adjustHighlightRange(menuItemMock,
                    normalizedOptionText,
                    normalizedOptionSubtext,
                    normalizedOptionValue,
                    normalizedText);
            } else if (normalizedOptionText.includes(normalizedText) ||
                normalizedOptionSubtext.includes(normalizedText) ||
                normalizedOptionValue.includes(normalizedText)) {
                // Case in which we have a partially matching option.
                menuItemMock.classList.remove("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-autocomplete-menu-optgroup"))
                    menuItemMock.parentElement.classList.remove("hidden");

                this.visibleOptions++;

                this.adjustHighlightRange(menuItemMock,
                    normalizedOptionText,
                    normalizedOptionSubtext,
                    normalizedOptionValue,
                    normalizedText);
            } else {
                // Case in which we have a non-matching option and must hide it.
                menuItemMock.classList.add("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-autocomplete-menu-optgroup"))
                    menuItemMock.parentElement.classList.add("hidden");

                this.hideHighlightRange(menuItemMock);
            }
        }

        let visibleMenuItemMocksWithHiddenOptgroup =
            this.menuMock.querySelectorAll(".atmos-autocomplete-menu-optgroup.hidden .atmos-autocomplete-menu-item:not(.hidden)");
        for (const menuItemMock of visibleMenuItemMocksWithHiddenOptgroup) {
            menuItemMock.parentElement.classList.remove("hidden");
        }
    }

    private positionMenuMock() {
        this.menuMock.style.removeProperty("height");

        let inputRect = this.inputElement.getBoundingClientRect();
        let menuRect = this.menuMock.getBoundingClientRect();

        if (inputRect.bottom + menuRect.height + 15 > window.innerHeight && inputRect.top - 15 < menuRect.height) {
            // If the menu can't be positioned either on top or bottom of the input element,
            if (this.menuPosition === "up") {
                // Position it above the input and limit its height.
                this.menuMock.style.top = `${window.scrollY + 5}px`;
                this.menuMock.style.height = `${inputRect.top - 10}px`;
            } else {
                // Position it below the input and limit its height.
                this.menuMock.style.top = `${inputRect.bottom + window.scrollY + 5}px`;
                this.menuMock.style.height = `${window.innerHeight - inputRect.bottom - 10}px`;
            }
        } else if (inputRect.bottom + menuRect.height + 15 > window.innerHeight) {
            // If there isn't enough space to position the menu below the input element, position it above it instead.
            this.menuMock.style.top = `${inputRect.top - menuRect.height - 5 + window.scrollY}px`;
        } else if (this.menuPosition === "up" && inputRect.top - 15 < menuRect.height) {
            this.menuMock.style.top = `${inputRect.bottom + window.scrollY + 5}px`;
        } else {
            if (this.menuPosition === "up") {
                // Else position the menu directly above the input element, with a little margin.
                this.menuMock.style.top = `${inputRect.top - menuRect.height - 5 + window.scrollY}px`;
            } else {
                // Else position the menu directly below the input element, with a little margin.
                this.menuMock.style.top = `${inputRect.bottom + window.scrollY + 5}px`;
            }
        }

        let left = inputRect.left;
        if (inputRect.left + menuRect.width + 15 > window.innerWidth) {
            // If there isn't enough space to position the menu next to the input element, shift it slightly.
            left -= inputRect.left + menuRect.width + 15 + window.scrollY - window.innerWidth;
        }

        console.debug(`Positioning menu to ${inputRect.width}, ${inputRect.left}.`);
        // Set the option menu's width to the input's width.
        this.menuMock.style.minWidth = `${inputRect.width}px`;
        this.menuMock.style.left = `${left}px`;

        this.menuMock.style.removeProperty("transform");
    }

    private generateMocks() {
        this.inputElement.classList.add("atmos-autocomplete-input");
        this.inputElement.removeAttribute("list");

        // Create the dropdown and insert it at the end of the body element,
        // since if placed in an overflowing container it might become partly hidden.
        let menuMock = Redom.el("ul.atmos-autocomplete-menu.hidden") as HTMLUListElement;
        if (this.inputElement.id) menuMock.dataset.origin = this.inputElement.id;
        if (this.isSuggestModeEnabled) menuMock.classList.add("readonly");
        Redom.mount(document.body, menuMock);
        this.menuMock = menuMock;

        // Create a button that shows all options when clicked, positioned middle right of the input mock.
        let showAllOptionsButton = Redom.el("button.atmos-autocomplete-menu-toggle", {
            tabIndex: -1,
            type: "button",
            disabled: this.inputElement.disabled || this.inputElement.readOnly,
            title: "Show all"
        }) as HTMLButtonElement;
        this.inputElement.insertAdjacentElement("afterend", showAllOptionsButton);
        this.showAllOptionsButton = showAllOptionsButton;

        // Generate the option elements in the dropdown
        this.generateOptionMocks();
    }

    private generateOptionMocks() {
        Redom.setChildren(this.menuMock, []);
        AtmosAutocomplete.customHighlight?.clear();
        if (!this.datalistElement) return;
        this.menuItemMocks = [];

        for (const child of this.datalistElement.children) {
            if (child instanceof HTMLOptGroupElement) {
                let optgroupMock = Redom.el("li.atmos-autocomplete-menu-optgroup", Redom.el("span.atmos-autocomplete-menu-optgroup-text", child.label));
                Redom.mount(this.menuMock, optgroupMock);

                for (const option of child.querySelectorAll("option")) {
                    this.generateOptionMock(optgroupMock, option);
                }
            } else if (child instanceof HTMLOptionElement) {
                this.generateOptionMock(this.menuMock, child);
            }
        }

        this.visibleOptions = this.datalistElement.childElementCount;
    }

    private generateOptionMock(parent: HTMLElement, option: HTMLOptionElement) {
        // Create an option element with its tick box, which will remain hidden until the element is selected.
        let menuItemMock = <HTMLLIElement>Redom.el("li.atmos-autocomplete-menu-item");
        if (option.title) menuItemMock.title = option.title;

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
            this.selectedMenuItemMock = menuItemMock as HTMLLIElement;
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
            this.adjustHighlightRange(menuItemMock,
                option.textContent.trim().toLowerCase(),
                option.dataset.subtext?.trim().toLowerCase(),
                option.value.trim().toLowerCase(),
                value);
        }

        this.menuItemMocks.push(menuItemMock);
    }

    private adjustHighlightRange(menuItemMock: HTMLLIElement, optionText: string, optionSubtext: string, optionValue: string, valueToTestAgainst: string) {
        // @ts-ignore Not yet in DOM typings.
        if (!CSS.highlights) return;

        let start = optionText.indexOf(valueToTestAgainst);
        if (start >= 0 && AtmosAutocomplete.customHighlight.size < AtmosAutocomplete.maxHighlights) {
            if (!menuItemMock.textHighlightRange) {
                menuItemMock.textHighlightRange = new Range();
            }

            let textNode = menuItemMock.querySelector(".atmos-autocomplete-menu-item-text").childNodes[0] as Text;
            menuItemMock.textHighlightRange.setStart(textNode, start);
            menuItemMock.textHighlightRange.setEnd(textNode, start + valueToTestAgainst.length);
            AtmosAutocomplete.customHighlight.add(menuItemMock.textHighlightRange);
        } else if (menuItemMock.textHighlightRange) {
            AtmosAutocomplete.customHighlight.delete(menuItemMock.textHighlightRange);
            menuItemMock.textHighlightRange = null;
        }

        let subtext = optionSubtext || optionValue;
        if ((subtext && subtext !== optionText) && menuItemMock.querySelector(".atmos-autocomplete-menu-item-value")) {
            start = subtext.indexOf(valueToTestAgainst);
            if (start >= 0 && AtmosAutocomplete.customHighlight.size < AtmosAutocomplete.maxHighlights) {
                if (!menuItemMock.subtextHighlightRange) {
                    menuItemMock.subtextHighlightRange = new Range();
                }

                let textNode = menuItemMock.querySelector(".atmos-autocomplete-menu-item-value").childNodes[0] as Text;
                menuItemMock.subtextHighlightRange.setStart(textNode, start);
                menuItemMock.subtextHighlightRange.setEnd(textNode, start + valueToTestAgainst.length);
                AtmosAutocomplete.customHighlight.add(menuItemMock.subtextHighlightRange);
            } else if (menuItemMock.subtextHighlightRange) {
                AtmosAutocomplete.customHighlight.delete(menuItemMock.subtextHighlightRange);
                menuItemMock.subtextHighlightRange = null;
            }
        }
    }

    private hideHighlightRange(menuItemMock: HTMLLIElement) {
        // @ts-ignore Not yet in DOM typings.
        if (!CSS.highlights) return;

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