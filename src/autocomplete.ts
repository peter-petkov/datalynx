import * as Redom from "redom";

class Autocomplete {
    private static autocompletes = new Map<HTMLElement, Autocomplete>();
    private readonly selectElement: HTMLSelectElement;
    private autocompleteInputMock: HTMLInputElement;
    private autocompleteMenuMock: HTMLElement;

    private selectedMenuOption: HTMLLIElement;
    private showAllOptionsButton: HTMLButtonElement;
    private autocompleteWrapper: HTMLElement;

    constructor(selectElement: HTMLSelectElement) {
        this.selectElement = selectElement;

        // First, generate the extra elements.
        this.generateAutocompleteMock();

        // Autocompletes must start out empty and then get selected via the UI.
        selectElement.selectedIndex = -1;
        this.updateAutocompleteMenu();

        // If the hidden select element somehow gets focus, move that focus to the input mock
        // and open the dropdown mock, filtering the options if the input has any value.
        selectElement.addEventListener("focus", () => {
            if (!selectElement.disabled) {
                this.autocompleteInputMock.focus();
                this.filterAutocompleteMenu(this.autocompleteInputMock.value);
            }
        });

        this.autocompleteInputMock.addEventListener("focus", () => {
            if ([ ...this.autocompleteMenuMock.children ].some(c => !c.classList.contains("hidden"))) {
                this.show();
            }
        });

        this.autocompleteWrapper.addEventListener("keydown", (e) => {
            // if (this.autocompleteMenuMock.classList.contains("hidden")) return;

            if (e.code === "ArrowDown") {
                e.preventDefault();

                do {
                    selectElement.selectedIndex++;
                    if (selectElement.selectedIndex === -1) selectElement.selectedIndex++;
                } while (selectElement.selectedIndex >= 0 && this.autocompleteMenuMock.children[selectElement.selectedIndex].classList.contains("hidden"))

                if (selectElement.selectedIndex < 0) {
                    selectElement.selectedIndex = 0;
                }

                selectElement.dispatchEvent(new Event("change"));
            } else if (e.code === "ArrowUp") {
                e.preventDefault();

                do {
                    selectElement.selectedIndex -= 1;
                } while (selectElement.selectedIndex >= 0 && this.autocompleteMenuMock.children[selectElement.selectedIndex].classList.contains("hidden"))

                if (selectElement.selectedIndex < 0) {
                    selectElement.selectedIndex = selectElement.options.length - 1;
                }

                selectElement.dispatchEvent(new Event("change"));
            } else if (e.code === "Escape") {
                e.preventDefault();
                this.hide();
            } else if (e.code === "Enter") {
                e.preventDefault();
                this.toggle();
            }
        });

        selectElement.addEventListener("change", () => this.updateAutocompleteMenu());

        this.autocompleteInputMock.addEventListener("input", () => {
            this.filterAutocompleteMenu(this.autocompleteInputMock.value);
            this.positionMenu();
        });

        this.autocompleteMenuMock.addEventListener("click", e => {
            let target = (<HTMLElement>e.target).closest(".autocomplete-menu-item") as HTMLElement;
            if (!target) return;

            selectElement.selectedIndex = [ ...this.autocompleteMenuMock.children ].indexOf(target);
            selectElement.dispatchEvent(new Event("change"));

            this.updateAutocompleteMenu();
        });

        document.addEventListener("click", (e) => {
            let target = e.target as HTMLElement;
            if (target.closest(".autocomplete-menu") === this.autocompleteMenuMock) {
                // return;
            } else if (target.closest(".autocomplete-input") === this.autocompleteInputMock) {
                return;
            } else if (target.closest(".autocomplete-menu-toggle") === this.showAllOptionsButton) {
                return;
            }

            this.hide();
        });

        this.showAllOptionsButton.addEventListener("click", () => {
            this.filterAutocompleteMenu("", false);
            this.positionMenu();
        });

        new MutationObserver(() => {
            this.generateAutocompleteMenuChildren();
        }).observe(selectElement, {
            childList: true
        });

        new MutationObserver(() => {
            this.autocompleteInputMock.disabled = selectElement.disabled;
        }).observe(selectElement, {
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

        // Place an observer to create an autocomplete
        // whenever a user adds a select element with an autocomplete toggle in the DOM
        new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const addedNode of mutation.addedNodes) {
                    if (!(addedNode instanceof HTMLSelectElement)) continue;

                    let toggles = addedNode.dataset.toggle === "autocomplete" ? [ addedNode ] : [];
                    // Check the element's children for nested autocompletes
                    toggles.push(...addedNode.querySelectorAll<HTMLSelectElement>("[data-toggle=autocomplete]"));

                    for (const toggle of toggles) {
                        new Autocomplete((<HTMLSelectElement>toggle));
                    }
                }

                for (const removedNode of mutation.removedNodes) {
                    if (!(removedNode instanceof HTMLElement)) continue;

                    let toggles = removedNode.dataset.toggle === "autocomplete" ? [ removedNode ] : [];
                    // Check the element's children for nested autocompletes
                    toggles.push(...removedNode.querySelectorAll<HTMLElement>("[data-toggle=autocomplete]"));

                    for (const toggle of toggles) {
                        this.autocompletes.delete(toggle);
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
        this.autocompleteMenuMock.classList.add("hidden");

        this.autocompleteMenuMock.dispatchEvent(new CustomEvent("hide.autocomplete"));
    }

    show() {
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

    private updateAutocompleteMenu() {
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
    }

    private filterAutocompleteMenu(value: string, deselectIfEmpty: boolean = true) {
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
                this.selectElement.dispatchEvent(new Event("change"));

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
            disabled: this.selectElement.disabled
        }) as HTMLInputElement;
        Redom.mount(autocompleteWrapper, autocompleteInputMock);
        this.autocompleteInputMock = autocompleteInputMock;

        // Create the dropdown and insert it at the end of the body element,
        // since if placed in an overflowing container it might become partly hidden.
        let autocompleteMenuMock = Redom.el("ul.autocomplete-menu.hidden") as HTMLUListElement;
        Redom.mount(document.body, autocompleteMenuMock);
        this.autocompleteMenuMock = autocompleteMenuMock;

        let showAllOptionsButton = Redom.el("button.autocomplete-menu-toggle",
            Redom.el("img.autocomplete-toggle-caret", {
                src: "/src/caret-down.png"
            }), {
                style: {
                    position: "absolute",
                    right: "0.5rem",
                    top: "27%"
                },
                type: "button"
            }) as HTMLButtonElement;
        Redom.mount(autocompleteWrapper, showAllOptionsButton);
        this.showAllOptionsButton = showAllOptionsButton;

        // Generate the option elements in the dropdown
        this.generateAutocompleteMenuChildren();

        // Return both the input and dropdown mocks for event listeners to be attached.
        return { autocompleteInputMock, autocompleteMenuMock };
    }

    private generateAutocompleteMenuChildren() {
        Redom.setChildren(this.autocompleteMenuMock, []);

        for (const option of this.selectElement.options) {
            if (!option.textContent || !option.value) continue;

            // Create an option element with its tick box, which will remain hidden until the element is selected.
            let autocompleteMenuItemMock = Redom.el("li.autocomplete-menu-item", [
                Redom.el("span.autocomplete-menu-item-text", option.textContent),
                Redom.el("img.autocomplete-menu-item-tick", {
                    src: "/src/check.png",
                    alt: "Selected",
                })
            ], {
                title: option.title
            });
            Redom.mount(this.autocompleteMenuMock, autocompleteMenuItemMock);
        }
    }

    private positionMenu() {
        let inputRect = this.autocompleteInputMock.getBoundingClientRect();
        let menuRect = this.autocompleteMenuMock.getBoundingClientRect();
        if (inputRect.top + inputRect.height + menuRect.height + 4 > window.innerHeight) {
            this.autocompleteMenuMock.style.top = `${inputRect.top - menuRect.height - 10 + window.scrollY}px`;
        } else {
            this.autocompleteMenuMock.style.top = `${inputRect.top + inputRect.height + window.scrollY}px`;
        }

        this.autocompleteMenuMock.style.width = `${inputRect.width}px`;
        this.autocompleteMenuMock.style.left = `${inputRect.left}px`;

        this.autocompleteMenuMock.classList.remove("hidden");
    }
}

Autocomplete.init();