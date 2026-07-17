import { afterEach, describe, expect, it } from "vitest";
import {
	manageDialogFocus,
	trapDialogFocus,
} from "$lib/utils/accessibility/dialogFocus";

afterEach(() => {
	document.body.replaceChildren();
});

describe("dialog focus management", () => {
	it("moves focus into a dialog and returns it when the dialog closes", async () => {
		const trigger = document.createElement("button");
		const dialog = document.createElement("div");
		const firstButton = document.createElement("button");
		trigger.textContent = "Open";
		firstButton.textContent = "Close";
		dialog.tabIndex = -1;
		dialog.append(firstButton);
		document.body.append(trigger, dialog);
		trigger.focus();

		const cleanup = manageDialogFocus(dialog);
		await Promise.resolve();
		expect(firstButton).toHaveFocus();

		cleanup();
		expect(trigger).toHaveFocus();
	});

	it("keeps Tab and Shift+Tab inside a modal dialog", () => {
		const dialog = document.createElement("div");
		const firstButton = document.createElement("button");
		const lastButton = document.createElement("button");
		dialog.append(firstButton, lastButton);
		document.body.append(dialog);

		lastButton.focus();
		const tabEvent = new KeyboardEvent("keydown", {
			key: "Tab",
			bubbles: true,
			cancelable: true,
		});
		trapDialogFocus(tabEvent, dialog);
		expect(tabEvent.defaultPrevented).toBe(true);
		expect(firstButton).toHaveFocus();

		const reverseTabEvent = new KeyboardEvent("keydown", {
			key: "Tab",
			shiftKey: true,
			bubbles: true,
			cancelable: true,
		});
		trapDialogFocus(reverseTabEvent, dialog);
		expect(reverseTabEvent.defaultPrevented).toBe(true);
		expect(lastButton).toHaveFocus();
	});
});
