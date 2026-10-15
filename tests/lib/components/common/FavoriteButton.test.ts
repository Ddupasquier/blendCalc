import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import FavoriteButton from "$lib/components/common/actions/FavoriteButton/FavoriteButton.svelte";
import {
	FAVORITES_CHANGED_EVENT,
	type FavoriteChange,
} from "$lib/utils/favorites/types";

const deferredResponse = () => {
	let resolve!: (response: Response) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<Response>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
};

const firstTarget = {
	kind: "food" as const,
	targetId: "101",
	name: "First food",
	initialState: { favorite: false },
};

// These are isolated asynchronous callback failures, not routed browser coverage.
describe("FavoriteButton pending request ownership", () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it("keeps late successful persistence attributed to its original target", async () => {
		const pending = deferredResponse();
		const fetchMock = vi.fn().mockReturnValue(pending.promise);
		vi.stubGlobal("fetch", fetchMock);
		const events: FavoriteChange[] = [];
		const changed = (event: Event) =>
			events.push((event as CustomEvent<FavoriteChange>).detail);
		window.addEventListener(FAVORITES_CHANGED_EVENT, changed);
		try {
			const { rerender } = render(FavoriteButton, { props: firstTarget });
			await fireEvent.click(
				screen.getByRole("button", { name: "Favorite: First food" }),
			);
			expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
				kind: "food",
				targetId: "101",
				favorite: true,
			});
			await rerender({
				...firstTarget,
				targetId: "202",
				name: "Second food",
				initialState: { favorite: false },
			});
			await act(async () => {
				// Deliberately ignore abort: completion can already be queued.
				pending.resolve(Response.json({ favorite: true }));
				await pending.promise;
				await Promise.resolve();
			});
			expect(
				screen.getByRole("button", { name: "Favorite: Second food" }),
			).toHaveAttribute("aria-pressed", "false");
			for (const event of events)
				expect(event).toEqual({
					kind: "food",
					targetId: "101",
					favorite: true,
				});
			expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		} finally {
			window.removeEventListener(FAVORITES_CHANGED_EVENT, changed);
		}
	});

	it("does not roll a replacement target back when the previous request fails", async () => {
		const pending = deferredResponse();
		vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending.promise));
		const { rerender } = render(FavoriteButton, { props: firstTarget });
		await fireEvent.click(
			screen.getByRole("button", { name: "Favorite: First food" }),
		);
		await rerender({
			...firstTarget,
			targetId: "202",
			name: "Second food",
			initialState: { favorite: true },
		});
		await act(async () => {
			pending.reject(new Error("synthetic persistence failure"));
			await pending.promise.catch(() => undefined);
		});
		expect(
			screen.getByRole("button", { name: "Remove favorite: Second food" }),
		).toHaveAttribute("aria-pressed", "true");
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("excludes duplicate pending updates and rolls back a refused write", async () => {
		const pending = deferredResponse();
		const fetchMock = vi.fn().mockReturnValue(pending.promise);
		vi.stubGlobal("fetch", fetchMock);
		render(FavoriteButton, { props: firstTarget });
		const button = screen.getByRole("button", { name: "Favorite: First food" });
		await fireEvent.click(button);
		await fireEvent.click(button);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(button).toBeDisabled();
		await act(async () => {
			pending.resolve(new Response(null, { status: 503 }));
			await pending.promise;
		});
		expect(button).toBeEnabled();
		expect(button).toHaveAttribute("aria-pressed", "false");
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Favorite could not be saved. Try again.",
		);
	});

	it("aborts the owned request when its component is disposed", async () => {
		const pending = deferredResponse();
		const fetchMock = vi.fn().mockReturnValue(pending.promise);
		vi.stubGlobal("fetch", fetchMock);
		const { unmount } = render(FavoriteButton, { props: firstTarget });
		await fireEvent.click(
			screen.getByRole("button", { name: "Favorite: First food" }),
		);
		const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
		await unmount();
		expect(signal.aborted).toBe(true);
		await act(async () => {
			pending.reject(new Error("synthetic aborted request"));
			await pending.promise.catch(() => undefined);
		});
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});
});
