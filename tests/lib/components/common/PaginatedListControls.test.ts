import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import PaginatedListControls from "$lib/components/common/navigation/PaginatedListControls.svelte";

describe("PaginatedListControls", () => {
	it("shows explicit load and return controls for an overflowing partial list", async () => {
		const scrollContainer = document.createElement("div");
		const scrollTo = vi.fn();
		const onLoadMore = vi.fn();

		Object.defineProperties(scrollContainer, {
			scrollHeight: { configurable: true, value: 500 },
			clientHeight: { configurable: true, value: 100 },
			scrollTo: { configurable: true, value: scrollTo },
		});

		render(PaginatedListControls, {
			props: {
				scrollContainer,
				hasMoreItems: true,
				containerElement: "div",
				onLoadMore,
			},
		});

		await fireEvent(window, new Event("resize"));
		await fireEvent.click(screen.getByRole("button", { name: "Load more" }));
		await fireEvent.click(
			screen.getByRole("button", { name: "Return to top" }),
		);

		expect(onLoadMore).toHaveBeenCalledOnce();
		expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
	});

	it("renders no controls when all content fits", async () => {
		const scrollContainer = document.createElement("div");
		Object.defineProperties(scrollContainer, {
			scrollHeight: { configurable: true, value: 100 },
			clientHeight: { configurable: true, value: 100 },
		});

		render(PaginatedListControls, {
			props: {
				scrollContainer,
				containerElement: "div",
			},
		});

		await fireEvent(window, new Event("resize"));

		expect(screen.queryByRole("button")).not.toBeInTheDocument();
	});
});
