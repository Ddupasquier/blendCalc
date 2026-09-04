import { render, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import ImagePlacementViewport from "$lib/components/common/images/ImagePlacementViewport/ImagePlacementViewport.svelte";
import { createFullImagePlacement } from "$lib/utils/food/images/imagePlacement";

describe("ImagePlacementViewport sizing", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("uses observer dimensions without forcing synchronous frame layout", async () => {
		let resizeCallback: ResizeObserverCallback = () => undefined;
		class ResizeObserverMock {
			constructor(callback: ResizeObserverCallback) {
				resizeCallback = callback;
			}

			observe() {}
			disconnect() {}
			unobserve() {}
		}
		vi.stubGlobal("ResizeObserver", ResizeObserverMock);
		const measure = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
		const onGeometryChange = vi.fn();
		const { container } = render(ImagePlacementViewport, {
			props: {
				imageUrl: "blob:package-photo",
				alt: "Package photo",
				value: createFullImagePlacement(),
				onGeometryChange,
			},
		});
		const frame = container.querySelector<HTMLElement>(
			".image-placement-viewport",
		);
		expect(frame).not.toBeNull();

		resizeCallback(
			[
				{
					target: frame,
					contentRect: { width: 320, height: 180 },
				} as unknown as ResizeObserverEntry,
			],
			{} as ResizeObserver,
		);

		await waitFor(() =>
			expect(onGeometryChange).toHaveBeenCalledWith(
				expect.objectContaining({ frameWidth: 320, frameHeight: 180 }),
			),
		);
		expect(measure).not.toHaveBeenCalled();
	});
});
