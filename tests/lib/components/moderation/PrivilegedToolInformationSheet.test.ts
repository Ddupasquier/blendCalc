import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import PrivilegedToolInformationSheet from "$lib/components/moderation/PrivilegedToolInformationSheet/PrivilegedToolInformationSheet.svelte";

describe("PrivilegedToolInformationSheet", () => {
	it.each([
		["product-submissions", "About product submissions"],
		["food-warning-reports", "About food warning reports"],
		["profile-images", "About profile image reports"],
		["account-access", "About account access"],
		["catalog-review-work", "About catalog review work"],
		["data-operations", "About data operations"],
	] as const)("explains the %s workflow", (action, title) => {
		render(PrivilegedToolInformationSheet, {
			props: {
				open: true,
				action,
				onClose: vi.fn(),
			},
		});

		expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "When to use this" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Start here" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Done when" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "What each action changes" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Safety boundary" }),
		).toBeInTheDocument();
	});

	it("states both outcomes for consequential review tools", () => {
		render(PrivilegedToolInformationSheet, {
			props: {
				open: true,
				action: "food-warning-reports",
				onClose: vi.fn(),
			},
		});

		expect(screen.getByText(/^Confirm the report:/)).toBeVisible();
		expect(screen.getByText(/^Dismiss the report:/)).toBeVisible();
	});

	it("closes from the clear acknowledgement action", async () => {
		const onClose = vi.fn();
		render(PrivilegedToolInformationSheet, {
			props: {
				open: true,
				action: "account-access",
				onClose,
			},
		});

		await fireEvent.click(screen.getByRole("button", { name: "Got it" }));
		expect(onClose).toHaveBeenCalledOnce();
	});
});
