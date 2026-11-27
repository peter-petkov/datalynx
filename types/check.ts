// Uses every public member the way the README does, so that npm run check:types fails when the definitions drift
// from it. Lines marked @ts-expect-error must stay errors. Nothing here runs.
import DataLynx, { type Classes, type PartName, type Texts } from "datalynx";
import { classes } from "datalynx/src/classes.js";
import { languages } from "datalynx/src/languages.js";
import de from "datalynx/src/languages/de.js";

// The element, found and created by its tag.
const lynx: DataLynx = document.querySelector("data-lynx")!;
const created: DataLynx = document.createElement("data-lynx");

// Properties.
lynx.batchSize = 100;
const batchSize: number = lynx.batchSize;
lynx.strict = true;
const strict: boolean = lynx.strict;
// @ts-expect-error strict is a boolean
lynx.strict = "strict";
lynx.ghost = true;
const ghost: boolean = lynx.ghost;
const datalist: HTMLDataListElement | null = lynx.datalist;
// @ts-expect-error datalist is read-only
lynx.datalist = null;

// Statics.
const found: DataLynx | undefined = DataLynx.get(document.querySelector("input")!);
DataLynx.defaultBatchSize = 100;
DataLynx.classes.menu = "dropdown-menu";
const plugs: Classes = DataLynx.classes;
const observed: string[] = DataLynx.observedAttributes;

// Class plugs.
Object.assign(classes, { item: "rounded-md px-3 py-1.5", itemActive: "bg-gray-100" });
const part: PartName = "itemActive";
const ghostPart: PartName = "ghostText";
// @ts-expect-error not a part
classes.nope = "x";

// Texts.
DataLynx.languageMap.matchesLabel = { one: "{count} suggestion", other: "{count} suggestions" };
DataLynx.languageMap.matchesLabel = count => `${count}`;
DataLynx.languageMap.invalidValue = "Pick one from the list.";
DataLynx.languages.de = { invalidValue: "Bitte einen Wert aus der Liste." };
DataLynx.languages.de = { matchesLabel: "{count} Vorschläge" };
languages.de = de;
const texts: Texts = de;
// @ts-expect-error plural forms need other
DataLynx.languageMap.matchesLabel = { one: "{count} hit" };
// @ts-expect-error not a text
DataLynx.languages.de = { nope: "x" };

export {};