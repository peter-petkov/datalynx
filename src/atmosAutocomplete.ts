import * as Redom from "redom";

export default class AtmosAutocomplete {
    private static autocompletes = new Map<HTMLElement, AtmosAutocomplete>();

    private selectElement: HTMLSelectElement;
    private mocksWrapper: HTMLElement;
    private inputMock: HTMLInputElement;
    private menuMock: HTMLElement;
    private selectedMenuItemMock: HTMLLIElement;
    private showAllOptionsButton: HTMLButtonElement;
    private selectElementOptionsChangeMutationObserver: MutationObserver;
    private selectElementAttributesChangeMutationObserver: MutationObserver;
    private listeners: any = {};
    private visibleOptions: number;
    private get hidden() {
        return this.menuMock.classList.contains("hidden");
    }

    constructor(selectElement: HTMLSelectElement) {
        if (AtmosAutocomplete.autocompletes.has(selectElement)) return;
        this.selectElement = selectElement;

        selectElement.style.display = "none";

        // First, generate the extra elements.
        this.generateMocks();

        this.selectElement["autocompleteInput"] = this.inputMock;
        this.inputMock["selectElement"] = this.selectElement;

        // If the hidden select element somehow gets focus, move that focus to the input mock and open the menu,
        // filtering the options if the input has any value.
        this.listeners.selectElementFocusListener = () => {
            if (!selectElement.disabled) {
                this.inputMock.focus();
                this.filterMenuMock(this.inputMock.value);
            }
        }
        selectElement.addEventListener("focus", this.listeners.selectElementFocusListener);

        // When focusing the input mock, if at least 1 option matches the input filter, show the option menu.
        this.inputMock.addEventListener("focus", () => {
            if ([ ...this.menuMock.children ].some(c => !c.classList.contains("hidden"))) {
                // If the user manually focuses the input mock, we want to show all the options available,
                // since showing only 1 option might not be so useful. Manually typing should still filter the options.
                // this.filterMenuMock(""/*, false*/);

                if (this.hidden) this.show();
                else if (!this.visibleOptions) this.hide();

                this.positionMenuMock();

                this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });
            }
        });

        // Keyboard navigation to match the native select element's feature
        this.mocksWrapper.addEventListener("keydown", (e) => {
            if (e.code === "ArrowDown") {
                e.preventDefault();

                // If the user pressed the down arrow, search the first visible option below the currently selected one
                // or cycle back to the first visible one.
                do {
                    selectElement.selectedIndex++;
                    if (selectElement.selectedIndex === -1) selectElement.selectedIndex++;
                } while (selectElement.selectedIndex >= 0 &&
                (this.menuMock.children[selectElement.selectedIndex].classList.contains("hidden") ||
                    this.menuMock.children[selectElement.selectedIndex].classList.contains("disabled")))

                if (selectElement.selectedIndex < 0) {
                    selectElement.selectedIndex = 0;
                }

                selectElement.dispatchEvent(new Event("change", { bubbles: true }));
            } else if (e.code === "ArrowUp") {
                e.preventDefault();

                // If the user pressed the up arrow, search the first visible option above the currently selected one
                // or cycle back to the last visible one.
                do {
                    selectElement.selectedIndex -= 1;
                    if (selectElement.selectedIndex === -1) selectElement.selectedIndex = selectElement.options.length - 1;
                } while (selectElement.selectedIndex >= 0 &&
                (this.menuMock.children[selectElement.selectedIndex].classList.contains("hidden") ||
                    this.menuMock.children[selectElement.selectedIndex].classList.contains("disabled")))

                if (selectElement.selectedIndex < 0) {
                    selectElement.selectedIndex = selectElement.options.length - 1;
                }

                selectElement.dispatchEvent(new Event("change", { bubbles: true }));
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
        });

        // When the select element gets its selected option changed for whatever reason,
        // also update the selected value in the autocomplete menu.
        this.listeners.selectElementChangeListener = () => {
            this.updateInputMock(this.selectElement.selectedOptions[0]?.textContent?.trim());
            this.updateInputMockTitle(this.selectElement.selectedOptions[0]?.title);

            this.updateMenuMock(this.selectElement.selectedIndex);

            if (!this.visibleOptions) this.hide();

            this.positionMenuMock();
        };
        selectElement.addEventListener("change", this.listeners.selectElementChangeListener);

        // When the user inputs a value to the autocomplete input, filter the option menu mock
        // to only show options that match (partially or fully) the typed value.
        const inputMockListener = (e) => {
            let matchingOptionIndex = -1;
            for (const option of this.selectElement.options) {
                // Compare text content instead of value because the two might differ and the user doesn't
                // see the value, only the text content of the option.
                if (option.textContent?.trim() === (<HTMLInputElement>e.target).value?.trim()) {
                    matchingOptionIndex = option.index;
                    break;
                }
            }

            this.updateSelectElement(matchingOptionIndex);

            this.updateInputMockTitle(this.selectElement.selectedOptions[0]?.title);

            this.filterMenuMock(this.inputMock.value);
            this.updateMenuMock(this.selectElement.selectedIndex);

            if (this.hidden) this.show();
            else if (!this.visibleOptions) this.hide();

            this.positionMenuMock();
        }
        this.inputMock.addEventListener("input", inputMockListener);
        this.inputMock.addEventListener("change", inputMockListener);

        // When the user clicks on an option in the menu mock, select the option in the select element
        // and set the input mock value to it.
        this.menuMock.addEventListener("click", e => {
            let target = (<HTMLElement>e.target).closest(".atmos-autocomplete-menu-item") as HTMLElement;
            if (!target) return;

            if (target.classList.contains("disabled")) return;

            let selectedIndex = [ ...this.menuMock.children ].indexOf(target);

            this.updateSelectElement(selectedIndex);

            this.updateInputMock(this.selectElement.selectedOptions[0]?.textContent?.trim());
            this.updateInputMockTitle(this.selectElement.selectedOptions[0]?.title);

            this.updateMenuMock(selectedIndex);

            this.selectElement.dispatchEvent(new CustomEvent("select.atmos-autocomplete", { bubbles: true }));
        });

        // When the user clicks somewhere else, close the menu mock.
        this.listeners.documentClickListener = (e) => {
            let target = e.target as HTMLElement;
            if (target.closest(".atmos-autocomplete-menu") === this.menuMock) {
                // Don't close the menu if the user clicks inside of it.
                // Disabled for now until multiselect is implemented.
                // return;
                if (target.closest(".atmos-autocomplete-menu-item.disabled")) {
                    // Don't close the menu if the user clicks on a disabled option.
                    return;
                }
            } else if (target.closest(".atmos-autocomplete-input") === this.inputMock) {
                // Don't close the menu if the user clicks on the input mock.
                return;
            } else if (this.showAllOptionsButton && target.closest(".atmos-autocomplete-menu-toggle") === this.showAllOptionsButton) {
                // Don't close the menu if the user clicks on the "Show all" button.
                return;
            }

            this.hide();
        }
        document.addEventListener("click", this.listeners.documentClickListener);

        // Reposition the menu mock when the user resizes the container in any way (for example Ctrl+Scroll).
        this.listeners.documentResizeListener = () => this.positionMenuMock();
        window.addEventListener("resize", this.listeners.documentResizeListener);

        // When the user clicks on the "Show all" button, clear the filter and show all entries.
        this.showAllOptionsButton?.addEventListener("click", () => {
            this.filterMenuMock("");

            if (this.hidden) this.show();
            this.positionMenuMock();

            this.selectedMenuItemMock?.scrollIntoView({ block: "nearest" });
        });

        // When the user clicks on any of the hidden select element's labels, focus the input mock instead.
        this.listeners.labelClickListener = (e) => {
            e.stopPropagation();
            this.inputMock.focus();
        }
        for (const label of selectElement.labels) {
            label?.addEventListener("click", this.listeners.labelClickListener);
        }

        // Watch the select element's options for additions or removals, mirroring the structure every time.
        this.selectElementOptionsChangeMutationObserver = new MutationObserver(() => {
            this.generateOptionMocks();
        });
        this.selectElementOptionsChangeMutationObserver.observe(selectElement, {
            childList: true
        });

        // Watch the select element's attributes for changes, mirroring their state in the input mock.
        this.selectElementAttributesChangeMutationObserver = new MutationObserver(() => {
            this.inputMock.disabled = selectElement.disabled;
            if (this.showAllOptionsButton) this.showAllOptionsButton.disabled = selectElement.disabled;
        });
        this.selectElementAttributesChangeMutationObserver.observe(selectElement, {
            attributes: true,
            attributeFilter: [ "disabled" ]
        });

        this.visibleOptions = selectElement.options.length;

        AtmosAutocomplete.autocompletes.set(selectElement, this);
    }

    static init() {
        let selectElements = document.querySelectorAll<HTMLSelectElement>("[data-toggle='autocomplete']");

        // Autodetect and create an autocomplete component for each select element found.
        for (const selectElement of selectElements) {
            new AtmosAutocomplete(selectElement);
        }

        // Place an observer to create an autocomplete whenever a select element with an autocomplete toggle gets added.
        new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const addedNode of mutation.addedNodes) {
                    if (!(addedNode instanceof HTMLSelectElement) || addedNode.dataset.toggle !== "autocomplete") continue;

                    // Skip initialization if component has already been initialized before detection.
                    if (!this.autocompletes.has(addedNode)) new AtmosAutocomplete(addedNode);
                }

                for (const removedNode of mutation.removedNodes) {
                    if (!(removedNode instanceof HTMLElement) || removedNode.dataset.toggle !== "autocomplete") continue;

                    AtmosAutocomplete.get(removedNode)?.destroy();
                }
            }
        }).observe(document, {
            childList: true,
            subtree: true
        });
    }

    static get(selectElement) {
        return this.autocompletes.get(selectElement);
    }

    hide() {
        this.menuMock.classList.add("hidden");

        this.menuMock.dispatchEvent(new CustomEvent("hide.atmos-autocomplete"));
    }

    show() {
        if (!this.visibleOptions) return;

        // First hide all other menu mocks, since only one needs to be shown at one time.
        for (const [ _, autocomplete ] of AtmosAutocomplete.autocompletes) {
            if (!autocomplete.hidden) autocomplete.hide();
        }

        this.menuMock.classList.remove("hidden");

        this.menuMock.dispatchEvent(new CustomEvent("show.atmos-autocomplete"));
    }

    toggle() {
        if (!this.visibleOptions && this.hidden) return;

        this.menuMock.classList.toggle("hidden");
        this.positionMenuMock();

        let customEvent = this.menuMock.classList.contains("hidden")
            ? new CustomEvent("hide.atmos-autocomplete")
            : new CustomEvent("show.atmos-autocomplete");
        this.menuMock.dispatchEvent(customEvent);
    }

    private updateSelectElement(selectedOptionIndex: number) {
        this.selectElement.selectedIndex = selectedOptionIndex;
    }

    private updateInputMock(value: string) {
        if (!value === null || value === undefined) value = "";

        this.inputMock.value = value?.toString();
    }

    private updateInputMockTitle(value: string) {
        if (!value === null || value === undefined) value = "";

        this.inputMock.title = value?.toString();
    }

    private updateMenuMock(selectedOptionIndex: number) {
        console.debug(`Update menu's options.`);

        if (selectedOptionIndex >= 0) {
            // Find the option mock that matches the select element's selected option.
            let newOption = (<HTMLLIElement>this.menuMock.children[selectedOptionIndex]);

            if (this.selectedMenuItemMock !== newOption) {
                // Remove the currently selected option mock.
                this.selectedMenuItemMock?.classList.remove("selected");
                newOption.classList.add("selected");

                // Scroll the dropdown mock to the selected option mock.
                newOption.scrollIntoView({ block: "nearest" });

                this.selectedMenuItemMock = newOption;
            }
        } else {
            this.selectedMenuItemMock?.classList.remove("selected");
            this.selectedMenuItemMock = null;
        }
    }

    private filterMenuMock(value: string) {
        console.debug(`Filtering menu.`);

        this.visibleOptions = 0;

        // If input mock value is empty, show all the options.
        if (!value) {
            for (const menuItemMock of this.menuMock.querySelectorAll(".hidden")) {
                menuItemMock.classList.remove("hidden");
            }

            this.visibleOptions = this.selectElement.options.length;
            return;
        }

        // Iterate the available options
        for (let i = 0; i < this.selectElement.options.length; i++) {
            const option = this.selectElement.options[i];

            // First normalize the values before comparing them.
            let normalizedOptionText = option.textContent.toLowerCase().trim();
            let normalizedText = value.toLowerCase().trim();
            if (option.textContent === value) {
                // Case in which we have a perfectly matching option.
                // Show the option mock.
                this.menuMock.children[i].classList.remove("hidden");
                this.visibleOptions++;
            } else if (normalizedOptionText.includes(normalizedText)) {
                // Case in which we have a partially matching option.
                this.menuMock.children[i].classList.remove("hidden");
                this.visibleOptions++;
            } else {
                // Case in which we have a non-matching option and must hide it.
                this.menuMock.children[i].classList.add("hidden");
            }
        }
    }

    private positionMenuMock() {
        this.menuMock.style.removeProperty("height");

        let inputRect = this.inputMock.getBoundingClientRect();
        let menuRect = this.menuMock.getBoundingClientRect();

        if (inputRect.bottom + menuRect.height + 4 > window.innerHeight && inputRect.top - 4 < menuRect.height) {
            // If the menu can't be positioned either on top or bottom of the input mock,
            // position it below the input and limit its height.
            this.menuMock.style.top = `${inputRect.bottom + window.scrollY}px`;
            this.menuMock.style.height = `${window.innerHeight - inputRect.bottom - 4}px`;
        } else if (inputRect.bottom + menuRect.height + 4 > window.innerHeight) {
            // If there isn't enough space to position the menu below the input mock, position it above it instead.
            this.menuMock.style.top = `${inputRect.top - menuRect.height - 8 + window.scrollY}px`;
        } else {
            // Else position the menu directly below the input element, with a little margin.
            this.menuMock.style.top = `${inputRect.bottom + window.scrollY}px`;
        }

        console.debug(`Positioning menu to ${inputRect.width}, ${inputRect.left}.`);
        // Set the option menu's width to the input's width.
        this.menuMock.style.minWidth = `${inputRect.width}px`;
        this.menuMock.style.left = `${inputRect.left}px`;
    }

    private generateMocks() {
        let mocksWrapper = Redom.el("div.atmos-autocomplete-wrapper");
        // Insert the autocomplete mock right after the select.
        this.selectElement.insertAdjacentElement("afterend", mocksWrapper);
        this.mocksWrapper = mocksWrapper;

        let buttonMock = Redom.el("input.atmos-autocomplete-input", {
            type: "text",
            disabled: this.selectElement.disabled,
            placeholder: this.selectElement.dataset.placeholder ?? ""
        }) as HTMLInputElement;
        Redom.mount(mocksWrapper, buttonMock);
        this.inputMock = buttonMock;
        if (this.selectElement.selectedIndex >= 0) {
            this.updateInputMock(this.selectElement.selectedOptions[0]?.textContent?.trim());
        }

        // Create the dropdown and insert it at the end of the body element,
        // since if placed in an overflowing container it might become partly hidden.
        let menuMock = Redom.el("ul.atmos-autocomplete-menu.hidden") as HTMLUListElement;
        Redom.mount(document.body, menuMock);
        this.menuMock = menuMock;

        // If a button source is provided, create an image for that button.
        if (this.selectElement.dataset.showAllButtonSrc) {
            // Create a button that shows all options when clicked, positioned middle right of the input mock.
            let showAllOptionsButton = Redom.el("button.atmos-autocomplete-menu-toggle", {
                tabIndex: -1,
                type: "button",
                disabled: this.selectElement.disabled,
                title: "Show all"
            }) as HTMLButtonElement;
            Redom.mount(mocksWrapper, showAllOptionsButton);
            this.showAllOptionsButton = showAllOptionsButton;

            let selectedTickImage = Redom.el("img.atmos-autocomplete-toggle-caret", {
                src: this.selectElement.dataset.showAllButtonSrc,
                alt: "Show all"
            })
            Redom.mount(showAllOptionsButton, selectedTickImage);
        }

        // Apply the custom classes provided by the select element's configuration.
        if (this.selectElement.dataset.wrapperClass)
            mocksWrapper.classList.add(this.selectElement.dataset.wrapperClass);
        if (this.selectElement.dataset.inputClass)
            buttonMock.classList.add(this.selectElement.dataset.inputClass);
        if (this.selectElement.dataset.menuClass)
            menuMock.classList.add(this.selectElement.dataset.menuClass);
        if (this.selectElement.dataset.showAllButtonClass)
            this.showAllOptionsButton.classList.add(this.selectElement.dataset.showAllButtonClass);

        // Generate the option elements in the dropdown
        this.generateOptionMocks();
    }

    private generateOptionMocks() {
        Redom.setChildren(this.menuMock, []);

        for (const option of this.selectElement.options) {
            // Create an option element with its tick box, which will remain hidden until the element is selected.
            let menuItemMock = Redom.el("li.atmos-autocomplete-menu-item",
                Redom.el("span.atmos-autocomplete-menu-item-text", option.textContent), {
                    title: option.title
                });
            Redom.mount(this.menuMock, menuItemMock);
            if (option.selected) {
                menuItemMock.classList.add("selected");
                this.selectedMenuItemMock = menuItemMock as HTMLLIElement;
            }

            if (option.disabled) {
                menuItemMock.classList.add("disabled");
            }

            let selectedTickImage = Redom.el("img.atmos-autocomplete-menu-item-tick", {
                alt: option.textContent || option.value ? "Selected" : "",
            }) as HTMLImageElement;
            // If a selected image source is provided, create an image for selected options.
            Redom.mount(menuItemMock, selectedTickImage);
            if (this.selectElement.dataset.selectedItemTickSrc) {
                selectedTickImage.src = this.selectElement.dataset.selectedItemTickSrc;
            }

            // Apply the custom class provided by the select element's configuration.
            if (this.selectElement.dataset.menuItemClass)
                menuItemMock.classList.add(this.selectElement.dataset.menuItemClass);
        }

        this.visibleOptions = this.selectElement.options.length;
    }

    destroy() {
        // First remove all associated event listeners on elements that will remain.
        // The rest of the listeners will be removed when we remove the mocks.
        this.selectElement.removeEventListener("focus", this.listeners.selectElementFocusListener);
        this.selectElement.removeEventListener("change", this.listeners.selectElementChangeListener);
        document.removeEventListener("click", this.listeners.documentClickListener);
        document.removeEventListener("resize", this.listeners.documentResizeListener);
        for (const label of this.selectElement.labels) {
            label.removeEventListener("click", this.listeners.labelClickListener);
        }

        // Disconnect all associated mutation observers.
        this.selectElementOptionsChangeMutationObserver.disconnect();
        this.selectElementAttributesChangeMutationObserver.disconnect();

        // Remove the mocks from the DOM tree and the autocomplete collection.
        this.mocksWrapper.remove();
        this.menuMock.remove();
        AtmosAutocomplete.autocompletes.delete(this.selectElement);

        // Show the original select element
        this.selectElement.style.removeProperty("display");

        this.selectElement = null;
        this.mocksWrapper = null;
        this.inputMock = null;
        this.menuMock = null;
        this.selectedMenuItemMock = null;
        this.showAllOptionsButton = null;
        this.selectElementOptionsChangeMutationObserver = null;
        this.selectElementAttributesChangeMutationObserver = null;
        this.listeners = null;
    }
}

window["AtmosAutocomplete"] = AtmosAutocomplete;
AtmosAutocomplete.init();