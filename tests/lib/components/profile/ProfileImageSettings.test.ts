import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ProfileImageSettings from "$lib/components/profile/ProfileImageSettings/ProfileImageSettings.svelte";

const commonProps = {
	currentImageUrl: "https://example.com/profile.webp",
	currentAltText: "Dylan smiling",
	hasCurrentImage: true,
	moderationStatus: "self_attested",
	policyItems: ["No explicit content"],
	requireHumanFace: false,
};

describe("ProfileImageSettings", () => {
	it("shows the current image, status, and independently editable description", () => {
		render(ProfileImageSettings, { props: commonProps });

		expect(screen.getByAltText("Dylan smiling")).toBeVisible();
		expect(screen.getByText("Ready to use")).toBeVisible();
		expect(
			screen.getByRole("textbox", { name: "Image description" }),
		).toHaveValue("Dylan smiling");
		expect(
			screen.getByRole("button", { name: "Save description" }),
		).toBeVisible();
	});

	it("requires an explicit second action before removing the image", async () => {
		const requestSubmit = vi
			.spyOn(HTMLFormElement.prototype, "requestSubmit")
			.mockImplementation(() => undefined);
		render(ProfileImageSettings, { props: commonProps });

		await fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
		expect(requestSubmit).not.toHaveBeenCalled();
		expect(
			screen.getByRole("button", { name: "Confirm removal" }),
		).toBeVisible();
		expect(
			screen.getByText(/Select remove again to permanently remove/i),
		).toBeVisible();

		await fireEvent.click(
			screen.getByRole("button", { name: "Confirm removal" }),
		);
		expect(requestSubmit).toHaveBeenCalledTimes(1);
		requestSubmit.mockRestore();
	});

	it("uses an upload-first presentation when no image exists", () => {
		render(ProfileImageSettings, {
			props: {
				...commonProps,
				currentImageUrl: null,
				currentAltText: null,
				hasCurrentImage: false,
				moderationStatus: "none",
			},
		});

		expect(screen.queryByText("Current image")).not.toBeInTheDocument();
		expect(screen.getByText("Profile photo")).toBeVisible();
		expect(screen.getByRole("button", { name: "Upload image" })).toBeVisible();
	});
});
