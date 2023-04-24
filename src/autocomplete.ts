import * as Redom from "redom";

class Autocomplete {
    private static autocompletes = new Map<HTMLElement, Autocomplete>();

    private selectElement: HTMLSelectElement;
    private autocompleteWrapper: HTMLElement;
    private autocompleteInputMock: HTMLInputElement;
    private autocompleteMenuMock: HTMLElement;
    private selectedMenuOption: HTMLLIElement;
    private showAllOptionsButton: HTMLButtonElement;
    private selectElementOptionsChangeMutationObserver: MutationObserver;
    private selectElementAttributesChangeMutationObserver: MutationObserver;
    private listeners: any = {};

    constructor(selectElement: HTMLSelectElement) {
        if (Autocomplete.autocompletes.has(selectElement)) return;

        this.selectElement = selectElement;

        // First, generate the extra elements.
        this.generateAutocompleteMock();

        this.selectElement["autocompleteInput"] = this.autocompleteInputMock as HTMLInputElement;

        // Autocompletes must start out empty and then get selected via the UI.
        selectElement.selectedIndex = -1;
        this.updateAutocompleteMenu();

        // If the hidden select element somehow gets focus, move that focus to the input mock
        // and open the dropdown mock, filtering the options if the input has any value.
        this.listeners.selectElementFocusListener = () => {
            if (!selectElement.disabled) {
                this.autocompleteInputMock.focus();
                this.filterAutocompleteMenu(this.autocompleteInputMock.value);
            }
        }
        selectElement.addEventListener("focus", this.listeners.selectElementFocusListener);

        // When focusing the input mock, if at least 1 option matches the input filter, show the option menu.
        this.autocompleteInputMock.addEventListener("focus", () => {
            if ([ ...this.autocompleteMenuMock.children ].some(c => !c.classList.contains("hidden"))) {
                // If the user manually focuses the input mock, we want to show all the options available,
                // since showing only 1 option might not be so useful. Manually typing should still filter the options.
                this.filterAutocompleteMenu("", false);
                this.show();
                this.selectedMenuOption?.scrollIntoView({ block: "nearest" });
            }
        });

        // Keyboard navigation to match the native select element's feature
        this.autocompleteWrapper.addEventListener("keydown", (e) => {
            // if (this.autocompleteMenuMock.classList.contains("hidden")) return;

            if (e.code === "ArrowDown") {
                e.preventDefault();

                // If the user pressed the down arrow, search the first visible option below the currently selected one
                // or cycle back to the first visible one.
                do {
                    selectElement.selectedIndex++;
                    if (selectElement.selectedIndex === -1) selectElement.selectedIndex++;
                } while (selectElement.selectedIndex >= 0 && this.autocompleteMenuMock.children[selectElement.selectedIndex].classList.contains("hidden"))

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
                } while (selectElement.selectedIndex >= 0 && this.autocompleteMenuMock.children[selectElement.selectedIndex].classList.contains("hidden"))

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
            }
        });

        // When the select element gets its selected option changed for whatever reason,
        // also update the selected value in the autocomplete menu.
        this.listeners.selectElementChangeListener = () => this.updateAutocompleteMenu();
        selectElement.addEventListener("change", this.listeners.selectElementChangeListener);

        // When the user inputs a value to the autocomplete input, filter the option menu mock
        // to only show options that match (partially or fully) the typed value.
        this.autocompleteInputMock.addEventListener("input", () => {
            this.filterAutocompleteMenu(this.autocompleteInputMock.value);
            this.positionMenu();
        });

        // When the user clicks on an option in the autocomplete menu mock, select the option in the select element
        // and set the input mock value to it.
        this.autocompleteMenuMock.addEventListener("click", e => {
            let target = (<HTMLElement>e.target).closest(".autocomplete-menu-item") as HTMLElement;
            if (!target) return;

            // Also filter the options to the new value.
            let selectedOption = this.selectElement.options[[ ...this.autocompleteMenuMock.children ].indexOf(target)];
            this.filterAutocompleteMenu(selectedOption.textContent);
        });

        // When the user clicks somewhere else, close the option menu mock.
        this.listeners.documentClickListener = (e) => {
            let target = e.target as HTMLElement;
            if (target.closest(".autocomplete-menu") === this.autocompleteMenuMock) {
                // Don't close the menu if the user clicks inside of it.
                // Disabled for now until multiselect is implemented.
                // return;
            } else if (target.closest(".autocomplete-input") === this.autocompleteInputMock) {
                // Don't close the menu if the user clicks on the input mock.
                return;
            } else if (target.closest(".autocomplete-menu-toggle") === this.showAllOptionsButton) {
                // Don't close the menu if the user clicks on the "Show all" button.
                return;
            }

            this.hide();
        }
        document.addEventListener("click", this.listeners.documentClickListener);

        // Reposition the option menu mock when the user resizes the container in any way (for example Ctrl+Scroll).
        this.listeners.documentResizeListener = () => this.positionMenu();
        window.addEventListener("resize", this.listeners.documentResizeListener);

        // When the user clicks on the "Show all" button, clear the filter and show all entries.
        this.showAllOptionsButton.addEventListener("click", () => {
            this.filterAutocompleteMenu("", false);
            this.positionMenu();
        });

        // When the user clicks on any of the hidden select element's labels, focus the input mock instead.
        this.listeners.labelClickListener = (e) => {
            e.stopPropagation();
            this.autocompleteInputMock.focus();
        }
        for (const label of selectElement.labels) {
            label?.addEventListener("click", this.listeners.labelClickListener);
        }

        // Watch the select element's options for additions or removals, mirroring the structure every time.
        this.selectElementOptionsChangeMutationObserver = new MutationObserver(() => {
            this.generateAutocompleteMenuChildren();
        });
        this.selectElementOptionsChangeMutationObserver.observe(selectElement, {
            childList: true
        });

        // Watch the select element's attributes for changes, mirroring their state in the input mock.
        this.selectElementAttributesChangeMutationObserver = new MutationObserver(() => {
            this.autocompleteInputMock.disabled = selectElement.disabled;
        });
        this.selectElementAttributesChangeMutationObserver.observe(selectElement, {
            attributes: true,
            attributeFilter: [ "disabled" ]
        });

        selectElement.style.display = "none";

        Autocomplete.autocompletes.set(selectElement, this);
    }

    static init() {
        let selectElements = document.querySelectorAll<HTMLSelectElement>("[data-toggle='autocomplete']");

        // Autodetect and create an autocomplete component for each select element found.
        for (const selectElement of selectElements) {
            new Autocomplete(selectElement);
        }

        // Place an observer to create an autocomplete whenever a select element with an autocomplete toggle gets added.
        new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const addedNode of mutation.addedNodes) {
                    if (!(addedNode instanceof HTMLSelectElement) || addedNode.dataset.toggle !== "autocomplete") continue;

                    // Skip initialization if component has already been initialized before detection.
                    if (!this.autocompletes.has(addedNode)) new Autocomplete(addedNode);
                }

                for (const removedNode of mutation.removedNodes) {
                    if (!(removedNode instanceof HTMLElement) || removedNode.dataset.toggle !== "autocomplete") continue;

                    Autocomplete.get(removedNode)?.destroy();
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
        this.autocompleteMenuMock.classList.add("hidden");

        this.autocompleteMenuMock.dispatchEvent(new CustomEvent("hide.autocomplete"));
    }

    show() {
        // First hide all other menu mocks, since only one needs to be shown at one time.
        for (const [ _, autocomplete ] of Autocomplete.autocompletes) {
            autocomplete.hide();
        }

        this.autocompleteMenuMock.classList.remove("hidden");
        this.positionMenu();

        this.autocompleteMenuMock.dispatchEvent(new CustomEvent("show.autocomplete"));
    }

    toggle() {
        this.autocompleteMenuMock.classList.toggle("hidden");
        this.positionMenu();

        let customEvent = this.autocompleteMenuMock.classList.contains("hidden")
            ? new CustomEvent("hide.autocomplete")
            : new CustomEvent("show.autocomplete");
        this.autocompleteMenuMock.dispatchEvent(customEvent);
    }

    input(value: string = "") {
        this.filterAutocompleteMenu(value);
        this.positionMenu();
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
        this.autocompleteWrapper.remove();
        this.autocompleteMenuMock.remove();
        Autocomplete.autocompletes.delete(this.selectElement);

        // Show the original select element
        this.selectElement.style.removeProperty("display");

        this.selectElement = null;
        this.autocompleteWrapper = null;
        this.autocompleteInputMock = null;
        this.autocompleteMenuMock = null;
        this.selectedMenuOption = null;
        this.showAllOptionsButton = null;
        this.selectElementOptionsChangeMutationObserver = null;
        this.selectElementAttributesChangeMutationObserver = null;
        this.listeners = null;
    }

    private updateAutocompleteMenu() {
        console.debug(`Update menu's options.`);

        // Remove the currently selected option mock.
        this.selectedMenuOption?.classList.remove("selected");

        if (this.selectElement.selectedIndex >= 0) {
            // Find the option mock that matches the select element's selected option.
            this.selectedMenuOption = (<HTMLLIElement>this.autocompleteMenuMock.children[this.selectElement.selectedIndex]);
            this.selectedMenuOption.classList.add("selected");
            // Scroll the dropdown mock to the selected option mock.
            this.selectedMenuOption.scrollIntoView({ block: "nearest" });
            // Set the input's value to the currently selected option.
            this.autocompleteInputMock.value = this.selectedMenuOption.textContent;
            this.autocompleteInputMock.title = this.selectedMenuOption.title;
        } else {
            this.autocompleteInputMock.value = "";
            this.autocompleteInputMock.title = "";
            this.selectedMenuOption = null;
        }

        this.autocompleteInputMock.dispatchEvent(new Event("change"));
    }

    private filterAutocompleteMenu(value: string, deselectIfEmpty: boolean = true) {
        console.debug(`Filtering menu.`);

        // If input mock value is empty, show all the options.
        if (!value) {
            for (const menuItemMock of this.autocompleteMenuMock.querySelectorAll(".hidden")) {
                menuItemMock.classList.remove("hidden");
            }

            if (deselectIfEmpty) {
                // Input value is empty, so the select shouldn't have any option selected either.
                this.selectElement.selectedIndex = -1;
                // Unselect the previously selected option (if present).
                this.selectedMenuOption?.classList.remove("selected");
                this.selectedMenuOption = null;
            }

            this.autocompleteMenuMock.classList.remove("hidden");

            return;
        }

        let hasAtLeastOneVisibleOption = false;
        let isMatchingOption = false;
        // Iterate the available options
        for (let i = 0; i < this.selectElement.options.length; i++) {
            const option = this.selectElement.options[i];

            // First normalize the values before comparing them.
            let normalizedOptionText = option.textContent.toLowerCase().trim();
            let normalizedText = value.toLowerCase().trim();
            if (option.textContent === value) {
                // Case in which we have a perfectly matching option.
                option.selected = true;

                // Fire a change event manually because simply selecting the option doesn't fire one.
                this.selectElement.dispatchEvent(new Event("change", { bubbles: true }));

                // Show the option mock.
                this.autocompleteMenuMock.children[i].classList.remove("hidden");

                hasAtLeastOneVisibleOption = true;
                isMatchingOption = true;
            } else if (normalizedOptionText.includes(normalizedText)) {
                // Case in which we have a partially matching option.
                this.autocompleteMenuMock.children[i].classList.remove("hidden");
                hasAtLeastOneVisibleOption = true;
            } else {
                // Case in which we have a non-matching option and must hide it.
                this.autocompleteMenuMock.children[i].classList.add("hidden");
            }
        }

        if (hasAtLeastOneVisibleOption) {
            this.autocompleteMenuMock.classList.remove("hidden");
        } else {
            this.autocompleteMenuMock.classList.add("hidden");
        }

        // If no options match, remove the selection.
        if (!isMatchingOption) {
            this.selectElement.selectedIndex = -1;
            this.selectedMenuOption?.classList.remove("selected");
        }
    }

    private generateAutocompleteMock() {
        let autocompleteWrapper = Redom.el("div.autocomplete-wrapper", {
            style: {
                position: "relative"
            }
        });
        // Insert the autocomplete mock right after the select.
        this.selectElement.insertAdjacentElement("afterend", autocompleteWrapper);
        this.autocompleteWrapper = autocompleteWrapper;

        let autocompleteInputMock = Redom.el("input.autocomplete-input", {
            type: "text",
            disabled: this.selectElement.disabled,
            placeholder: this.selectElement.dataset.autocompletePlaceholder
        }) as HTMLInputElement;
        Redom.mount(autocompleteWrapper, autocompleteInputMock);
        this.autocompleteInputMock = autocompleteInputMock;

        // Create the dropdown and insert it at the end of the body element,
        // since if placed in an overflowing container it might become partly hidden.
        let autocompleteMenuMock = Redom.el("ul.autocomplete-menu.hidden") as HTMLUListElement;
        Redom.mount(document.body, autocompleteMenuMock);
        this.autocompleteMenuMock = autocompleteMenuMock;

        // Create a button that shows all options when clicked, positioned middle right of the input mock.
        let showAllOptionsButton = Redom.el("button.autocomplete-menu-toggle", {
            style: {
                position: "absolute"
            },
            tabIndex: -1,
            type: "button",
            title: "Show all"
        }) as HTMLButtonElement;
        Redom.mount(autocompleteWrapper, showAllOptionsButton);
        this.showAllOptionsButton = showAllOptionsButton;

        // If a button source is provided, create an image for that button.
        if (this.selectElement.dataset.showAllButtonSrc) {
            let selectedTickImage = Redom.el("img.autocomplete-toggle-caret", {
                src: this.selectElement.dataset.showAllButtonSrc,
                alt: "Show all"
            })
            Redom.mount(showAllOptionsButton, selectedTickImage);
        }

        // Apply the custom classes provided by the select element's configuration.
        if (this.selectElement.dataset.autocompleteWrapperClass)
            autocompleteWrapper.classList.add(this.selectElement.dataset.autocompleteWrapperClass);
        if (this.selectElement.dataset.autocompleteInputClass)
            autocompleteInputMock.classList.add(this.selectElement.dataset.autocompleteInputClass);
        if (this.selectElement.dataset.autocompleteMenuClass)
            autocompleteMenuMock.classList.add(this.selectElement.dataset.autocompleteMenuClass);
        if (this.selectElement.dataset.autocompleteShowAllButtonClass)
            showAllOptionsButton.classList.add(this.selectElement.dataset.autocompleteShowAllButtonClass);
        if (this.selectElement.dataset.autocompleteShowAllButtonClass)
            showAllOptionsButton.classList.add(this.selectElement.dataset.autocompleteShowAllButtonClass);

        // Generate the option elements in the dropdown
        this.generateAutocompleteMenuChildren();
    }

    private generateAutocompleteMenuChildren() {
        Redom.setChildren(this.autocompleteMenuMock, []);

        for (const option of this.selectElement.options) {
            if (!option.textContent || !option.value) continue;

            // Create an option element with its tick box, which will remain hidden until the element is selected.
            let autocompleteMenuItemMock = Redom.el("li.autocomplete-menu-item",
                Redom.el("span.autocomplete-menu-item-text", option.textContent), {
                    title: option.title
                });
            Redom.mount(this.autocompleteMenuMock, autocompleteMenuItemMock);

            // If a selected image source is provided, create an image for selected options.
            if (this.selectElement.dataset.selectedItemTickSrc) {
                let selectedTickImage = Redom.el("img.autocomplete-menu-item-tick", {
                    src: this.selectElement.dataset.selectedItemTickSrc,
                    alt: "Selected",
                });
                Redom.mount(autocompleteMenuItemMock, selectedTickImage);
            }

            // Apply the custom class provided by the select element's configuration.
            if (this.selectElement.dataset.autocompleteOptionClass)
                autocompleteMenuItemMock.classList.add(this.selectElement.dataset.autocompleteOptionClass);
        }
    }

    private positionMenu() {
        let inputRect = this.autocompleteInputMock.getBoundingClientRect();
        let menuRect = this.autocompleteMenuMock.getBoundingClientRect();

        if (inputRect.top + inputRect.height + menuRect.height + 4 > window.innerHeight) {
            // If there isn't enough space to position the menu below the input mock, position it above it instead.
            this.autocompleteMenuMock.style.top = `${inputRect.top - menuRect.height - 10 + window.scrollY}px`;
        } else {
            // Else position the menu directly below the input element, with a little margin.
            this.autocompleteMenuMock.style.top = `${inputRect.top + inputRect.height + window.scrollY}px`;
        }

        console.debug(`Positioning menu to ${inputRect.width}, ${inputRect.left}.`);
        this.autocompleteMenuMock.style.width = `${inputRect.width}px`;
        // Set the option menu's width to the input's width.
        this.autocompleteMenuMock.style.left = `${inputRect.left}px`;
    }
}

window["Autocomplete"] = Autocomplete;
Autocomplete.init();