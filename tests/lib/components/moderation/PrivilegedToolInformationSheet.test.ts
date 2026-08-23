import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import PrivilegedToolInformationSheet from "$lib/components/moderation/PrivilegedToolInformationSheet/PrivilegedToolInformationSheet.svelte";

describe("PrivilegedToolInformationSheet", () => {
	it.each([
		["product-submissions", "About product submissions"],
		["food-warning-reports", "About food warning reports"],
		["profile-images", "About profile image reports"],
		["account-access", "About account access"],
		["catalog-data-health", "About catalog data health"],
	] as const)("explains the %s workflow", (action, title) => {
		render(PrivilegedToolInformationSheet, {
			props: {
				open: true,
				action,
				onClose: vi.fn(),
			},
		});

		expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Review flow" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "What your decision changes" }))
			.toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Important safeguard" }))
			.toBeInTheDocument();
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
