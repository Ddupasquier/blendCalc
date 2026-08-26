import { afterEach, describe, expect, it } from "vitest";
import {
	manageDialogFocus,
	trapDialogFocus,
} from "$lib/utils/accessibility/dialogFocus";

afterEach(() => {
	document.body.replaceChildren();
});

describe("dialog focus management", () => {
	it("moves focus into a dialog and returns it after the dialog leaves the document", async () => {
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
		expect(firstButton).toHaveFocus();
		dialog.remove();
		await Promise.resolve();
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => resolve()),
		);
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

	it("restores a trigger captured before the dialog enters the document", async () => {
		const trigger = document.createElement("button");
		const dialog = document.createElement("div");
		const firstButton = document.createElement("button");
		dialog.append(firstButton);
		document.body.append(trigger);
		trigger.focus();

		const capturedTrigger = document.activeElement as HTMLElement;
		document.body.append(dialog);
		document.body.focus();
		const cleanup = manageDialogFocus(dialog, capturedTrigger);
		await Promise.resolve();
		expect(firstButton).toHaveFocus();

		cleanup();
		dialog.remove();
		await Promise.resolve();
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => resolve()),
		);
		expect(trigger).toHaveFocus();
	});

	it("restores an explicit trigger after a parent dialog temporarily takes focus", async () => {
		const trigger = document.createElement("button");
		const parentDialogButton = document.createElement("button");
		const dialog = document.createElement("div");
		const firstButton = document.createElement("button");
		dialog.append(firstButton);
		document.body.append(trigger, parentDialogButton, dialog);

		const cleanup = manageDialogFocus(dialog, trigger);
		await Promise.resolve();
		expect(firstButton).toHaveFocus();

		cleanup();
		dialog.remove();
		parentDialogButton.focus();
		await Promise.resolve();
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => resolve()),
		);
		expect(trigger).toHaveFocus();
	});

	it("restores a replacement trigger resolved after route-backed content rerenders", async () => {
		let currentTrigger = document.createElement("button");
		const dialog = document.createElement("div");
		const firstButton = document.createElement("button");
		dialog.append(firstButton);
		document.body.append(currentTrigger, dialog);

		const cleanup = manageDialogFocus(dialog, () => currentTrigger);
		await Promise.resolve();
		expect(firstButton).toHaveFocus();

		const replacementTrigger = document.createElement("button");
		currentTrigger.replaceWith(replacementTrigger);
		currentTrigger = replacementTrigger;
		cleanup();
		dialog.remove();
		await Promise.resolve();
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => resolve()),
		);
		expect(replacementTrigger).toHaveFocus();
	});
});
