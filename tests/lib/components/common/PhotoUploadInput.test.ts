import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import PhotoUploadInput from "$lib/components/common/forms/PhotoUploadInput/PhotoUploadInput.svelte";

const baseProps = {
	id: "nutrition-photo",
	name: "nutritionPhoto",
	prompt: "Nutrition facts photo",
	description: "Show the complete nutrition label.",
};

describe("PhotoUploadInput", () => {
	it("handles a single required photo with a clear accessible prompt", async () => {
		const onFilesChange = vi.fn();
		render(PhotoUploadInput, {
			props: {
				...baseProps,
				required: true,
				onFilesChange,
			},
		});
		const input = screen.getByLabelText("Nutrition facts photo");
		const photo = new File(["label"], "nutrition-label.jpg", {
			type: "image/jpeg",
		});

		expect(input).toBeRequired();
		expect(input).not.toHaveAttribute("multiple");
		expect(screen.getByText("required · 1 photo")).toBeInTheDocument();
		await fireEvent.change(input, { target: { files: [photo] } });

		expect(onFilesChange).toHaveBeenLastCalledWith([photo]);
		expect(screen.getByText("nutrition-label.jpg")).toBeInTheDocument();
		expect(screen.getByText("Replace photo")).toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole("button", {
				name: "Clear nutrition facts photo selection",
			}),
		);
		expect(onFilesChange).toHaveBeenLastCalledWith([]);
		expect(screen.getByText("No photo selected")).toBeInTheDocument();
	});

	it("supports multiple photos through the photoCount prop", async () => {
		const onFilesChange = vi.fn();
		render(PhotoUploadInput, {
			props: {
				...baseProps,
				photoCount: 3,
				onFilesChange,
			},
		});
		const input = screen.getByLabelText("Nutrition facts photo");
		const photos = [
			new File(["front"], "front.jpg", { type: "image/jpeg" }),
			new File(["back"], "back.jpg", { type: "image/jpeg" }),
		];

		expect(input).toHaveAttribute("multiple");
		expect(screen.getByText("optional · Up to 3 photos")).toBeInTheDocument();
		await fireEvent.change(input, { target: { files: photos } });

		expect(onFilesChange).toHaveBeenLastCalledWith(photos);
		expect(screen.getByText("2 of 3 photos selected")).toBeInTheDocument();
		expect(screen.getByText("front.jpg")).toBeInTheDocument();
		expect(screen.getByText("back.jpg")).toBeInTheDocument();
	});

	it("rejects selections above the configured photo count", async () => {
		const onFilesChange = vi.fn();
		render(PhotoUploadInput, {
			props: {
				...baseProps,
				photoCount: 2,
				onFilesChange,
			},
		});
		const input = screen.getByLabelText("Nutrition facts photo");
		const photos = [
			new File(["1"], "one.jpg", { type: "image/jpeg" }),
			new File(["2"], "two.jpg", { type: "image/jpeg" }),
			new File(["3"], "three.jpg", { type: "image/jpeg" }),
		];

		await fireEvent.change(input, { target: { files: photos } });

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Choose no more than 2 photos.",
		);
		expect(onFilesChange).toHaveBeenLastCalledWith([]);
	});
});
