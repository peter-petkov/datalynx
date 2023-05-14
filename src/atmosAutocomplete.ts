import * as Redom from "redom";

export default class AtmosAutocomplete {
    private static autocompletes = new Map<HTMLElement, AtmosAutocomplete>();

    private inputElement: HTMLInputElement;
    private datalistElement: HTMLDataListElement;
    private mocksWrapper: HTMLElement;
    private menuMock: HTMLElement;
    private selectedMenuItemMock: HTMLLIElement;
    private showAllOptionsButton: HTMLButtonElement;
    private optionsChangeMutationObserver: MutationObserver;
    private inputElementAttributesChangeMutationObserver: MutationObserver;
    private listeners: any = {};
    private visibleOptions: number;

    constructor(inputElement: HTMLInputElement, datalistElement: HTMLDataListElement) {
        if (AtmosAutocomplete.autocompletes.has(inputElement)) return;
        this.inputElement = inputElement;
        this.datalistElement = datalistElement;

        // First, generate the extra elements.
        this.generateMocks();

        // When focusing the input, if at least 1 option matches the input filter, show the option menu.
        this.inputElement.addEventListener("focus", () => {
            if ([ ...this.menuMock.children ].some(c => !c.classList.contains("hidden"))) {
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
                if (!this.visibleOptions) return;

                // If the user pressed the down arrow, search the first visible option below the currently selected one
                // or cycle back to the first visible one.
                let nextOption = this.selectedMenuItemMock;
                do {
                    nextOption = nextOption?.nextElementSibling as HTMLLIElement ?? this.menuMock.firstElementChild as HTMLLIElement;
                } while (!nextOption || nextOption.classList.contains("hidden") || nextOption.classList.contains("disabled"))

                this.updateInputElement(nextOption.datalistOption.value);

                this.inputElement.dispatchEvent(new CustomEvent("change", {
                    bubbles: true,
                    detail: { filterMenu: false }
                }));
            } else if (e.code === "ArrowUp") {
                e.preventDefault();
                if (!this.visibleOptions) return;

                // If the user pressed the up arrow, search the first visible option above the currently selected one
                // or cycle back to the last visible one.
                let previousOption = this.selectedMenuItemMock;
                do {
                    previousOption = previousOption?.previousElementSibling as HTMLLIElement ?? this.menuMock.lastElementChild as HTMLLIElement;
                } while (!previousOption || previousOption.classList.contains("hidden") || previousOption.classList.contains("disabled"))

                this.updateInputElement(previousOption.datalistOption.value);

                this.inputElement.dispatchEvent(new CustomEvent("change", {
                    bubbles: true,
                    detail: { filterMenu: false }
                }));
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

        // When the user inputs a value to the autocomplete input, filter the menu mock
        // to only show options that match (partially or fully) the typed value.
        const inputListener = (e: CustomEvent) => {
            if (e.detail?.filterMenu !== false) {
                this.filterMenuMock(this.inputElement.value);
            }

            let selectedOptions = [ ...this.datalistElement.children ].filter(value => {
                return value.textContent.trim() === this.inputElement.value.trim()
            });
            this.updateMenuMock(selectedOptions as HTMLOptionElement[]);

            this.updateInputElementTitle(this.selectedMenuItemMock?.title);

            if (this.hidden) this.show();
            else if (!this.visibleOptions) this.hide();

            this.positionMenuMock();
        }
        this.inputElement.addEventListener("input", inputListener);
        this.inputElement.addEventListener("change", inputListener);

        // When the user clicks on an option in the menu mock, select the option in the select element
        // and set the input mock value to it.
        this.menuMock.addEventListener("click", e => {
            let target = (<HTMLElement>e.target).closest<HTMLLIElement>(".atmos-autocomplete-menu-item");
            if (!target) return;

            if (target.classList.contains("disabled")) return;

            this.updateInputElement(target.datalistOption.value);

            this.inputElement.dispatchEvent(new CustomEvent("change", {
                bubbles: true,
                detail: { filterMenu: false }
            }));
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
            } else if (target.closest(".atmos-autocomplete-input") === this.inputElement) {
                // Don't close the menu if the user clicks on the input.
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

        // Watch the select element's options for additions or removals, mirroring the structure every time.
        this.optionsChangeMutationObserver = new MutationObserver(() => {
            this.generateOptionMocks();
        });
        this.optionsChangeMutationObserver.observe(this.datalistElement, {
            childList: true
        });

        // Watch the select element's attributes for changes, mirroring their state in the input mock.
        this.inputElementAttributesChangeMutationObserver = new MutationObserver(() => {
            if (this.showAllOptionsButton) this.showAllOptionsButton.disabled = inputElement.disabled;
        });
        this.inputElementAttributesChangeMutationObserver.observe(inputElement, {
            attributes: true,
            attributeFilter: [ "disabled" ]
        });

        this.visibleOptions = this.datalistElement.childElementCount;

        AtmosAutocomplete.autocompletes.set(inputElement, this);
    }

    private get hidden() {
        return this.menuMock.classList.contains("hidden");
    }

    static init() {
        let inputElements = document.querySelectorAll<HTMLInputElement>("[data-toggle='autocomplete']");

        // Autodetect and create an autocomplete component for each select element found.
        for (const inputElement of inputElements) {
            const dataListElement = inputElement.list as HTMLDataListElement;
            if (!dataListElement) {
                console.debug("Autocomplete element doesn't have a datalist. Skipping initialization.", inputElement);
                continue;
            }

            new AtmosAutocomplete(inputElement, dataListElement);
        }

        // Place an observer to create an autocomplete whenever a select element with an autocomplete toggle gets added.
        new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const addedNode of mutation.addedNodes) {
                    if (!(addedNode instanceof HTMLElement)) continue;

                    let toggles = [];
                    if (addedNode.dataset?.toggles === "autocomplete") toggles.push(addedNode as HTMLInputElement);
                    toggles.push(...addedNode.querySelectorAll<HTMLInputElement>("[data-toggle=autocomplete]"));

                    for (const toggle of toggles) {
                        const dataListElement = toggle.list as HTMLDataListElement;
                        if (!dataListElement) {
                            console.debug("Autocomplete element doesn't have a datalist. Skipping initialization.", addedNode);
                            continue;
                        }

                        // Skip initialization if component has already been initialized before detection.
                        if (!this.autocompletes.has(addedNode)) new AtmosAutocomplete(toggle, dataListElement);
                    }
                }

                for (const removedNode of mutation.removedNodes) {
                    if (!(removedNode instanceof HTMLElement)) continue;

                    let toggles = [];
                    if (removedNode.dataset?.toggles === "autocomplete") toggles.push(removedNode as HTMLInputElement);
                    toggles.push(...removedNode.querySelectorAll<HTMLInputElement>("[data-toggle=autocomplete]"));

                    for (const toggle of toggles) {
                        AtmosAutocomplete.get(removedNode)?.destroy();
                    }
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

    destroy() {
        // First remove all associated event listeners on elements that will remain.
        // The rest of the listeners will be removed when we remove the mocks.
        document.removeEventListener("click", this.listeners.documentClickListener);
        document.removeEventListener("resize", this.listeners.documentResizeListener);

        // Disconnect all associated mutation observers.
        this.optionsChangeMutationObserver.disconnect();
        this.inputElementAttributesChangeMutationObserver.disconnect();

        // Remove the mocks from the DOM tree and the autocomplete collection.
        this.mocksWrapper.insertAdjacentElement("afterend", this.inputElement);
        this.menuMock.remove();
        AtmosAutocomplete.autocompletes.delete(this.inputElement);

        this.inputElement = null;
        this.mocksWrapper = null;
        this.menuMock = null;
        this.selectedMenuItemMock = null;
        this.showAllOptionsButton = null;
        this.optionsChangeMutationObserver = null;
        this.inputElementAttributesChangeMutationObserver = null;
        this.listeners = null;
    }

    private updateInputElement(value: string) {
        this.inputElement.value = value ?? "";
    }

    private updateInputElementTitle(value: string) {
        if (!value === null || value === undefined) value = "";

        this.inputElement.title = value?.toString();
    }

    private updateMenuMock(selectedOptions: HTMLOptionElement[]) {
        console.debug(`Update menu's options.`);

        for (const child of this.menuMock.children) {
            child?.classList.remove("selected");
        }

        this.selectedMenuItemMock = null;

        for (const selectedOption of selectedOptions) {
            selectedOption.autocompleteMenuOption.classList.add("selected");
            this.selectedMenuItemMock = selectedOption.autocompleteMenuOption;
        }
    }

    private filterMenuMock(value: string) {
        console.debug(`Filtering menu.`);

        this.visibleOptions = 0;

        // If input value is empty, show all the options.
        if (!value) {
            for (const menuItemMock of this.menuMock.querySelectorAll(".hidden")) {
                menuItemMock.classList.remove("hidden");
            }

            this.visibleOptions = this.datalistElement.children.length;
            return;
        }

        // Iterate the available options
        for (let i = 0; i < this.datalistElement.children.length; i++) {
            const option = this.datalistElement.children[i];

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

        let inputRect = this.inputElement.getBoundingClientRect();
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
        this.inputElement.insertAdjacentElement("afterend", mocksWrapper);
        this.mocksWrapper = mocksWrapper;

        this.inputElement.classList.add("atmos-autocomplete-input");
        this.inputElement.removeAttribute("list");
        mocksWrapper.appendChild(this.inputElement);

        // Create the dropdown and insert it at the end of the body element,
        // since if placed in an overflowing container it might become partly hidden.
        let menuMock = Redom.el("ul.atmos-autocomplete-menu.hidden") as HTMLUListElement;
        Redom.mount(document.body, menuMock);
        this.menuMock = menuMock;

        // If a button source is provided, create an image for that button.
        if (this.inputElement.dataset.showAllButtonSrc) {
            // Create a button that shows all options when clicked, positioned middle right of the input mock.
            let showAllOptionsButton = Redom.el("button.atmos-autocomplete-menu-toggle", {
                tabIndex: -1,
                type: "button",
                disabled: this.inputElement.disabled,
                title: "Show all"
            }) as HTMLButtonElement;
            Redom.mount(mocksWrapper, showAllOptionsButton);
            this.showAllOptionsButton = showAllOptionsButton;

            let selectedTickImage = Redom.el("img.atmos-autocomplete-toggle-caret", {
                src: this.inputElement.dataset.showAllButtonSrc,
                alt: "Show all"
            })
            Redom.mount(showAllOptionsButton, selectedTickImage);
        }

        // Apply the custom classes provided by the select element's configuration.
        if (this.inputElement.dataset.wrapperClass)
            mocksWrapper.classList.add(this.inputElement.dataset.wrapperClass);
        if (this.inputElement.dataset.menuClass)
            menuMock.classList.add(this.inputElement.dataset.menuClass);
        if (this.inputElement.dataset.showAllButtonClass)
            this.showAllOptionsButton.classList.add(this.inputElement.dataset.showAllButtonClass);

        // Generate the option elements in the dropdown
        this.generateOptionMocks();
    }

    private generateOptionMocks() {
        Redom.setChildren(this.menuMock, []);

        for (const child of this.datalistElement.children) {
            const option = (<HTMLOptionElement>child);
            // Create an option element with its tick box, which will remain hidden until the element is selected.
            let menuItemMock = Redom.el("li.atmos-autocomplete-menu-item",
                Redom.el("span.atmos-autocomplete-menu-item-text", option.textContent), {
                    title: option.title
                });
            Redom.mount(this.menuMock, menuItemMock);

            menuItemMock["datalistOption"] = option;
            option["autocompleteMenuOption"] = menuItemMock as HTMLLIElement;

            if (this.inputElement.value === option.value && !option.disabled) {
                menuItemMock.classList.add("selected");
                this.selectedMenuItemMock = menuItemMock as HTMLLIElement;
                this.updateInputElementTitle(this.selectedMenuItemMock.title);
            }

            if (option.disabled) {
                menuItemMock.classList.add("disabled");
            }

            let selectedTickImage = Redom.el("img.atmos-autocomplete-menu-item-tick", {
                alt: option.textContent || option.value ? "Selected" : "",
            }) as HTMLImageElement;
            // If a selected image source is provided, create an image for selected options.
            Redom.mount(menuItemMock, selectedTickImage);
            if (this.inputElement.dataset.selectedItemTickSrc) {
                selectedTickImage.src = this.inputElement.dataset.selectedItemTickSrc;
            }

            // Apply the custom class provided by the select element's configuration.
            if (this.inputElement.dataset.menuItemClass)
                menuItemMock.classList.add(this.inputElement.dataset.menuItemClass);
        }

        this.visibleOptions = this.datalistElement.childElementCount;
    }
}

window["AtmosAutocomplete"] = AtmosAutocomplete;
AtmosAutocomplete.init();