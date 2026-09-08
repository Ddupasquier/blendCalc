import { render, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import TurnstileChallenge from "$lib/components/auth/TurnstileChallenge/TurnstileChallenge.svelte";
import type { TurnstileRenderOptions } from "$lib/utils/auth/turnstileClient";

const mocks = vi.hoisted(() => ({
	options: null as TurnstileRenderOptions | null,
	render: vi.fn((_container: HTMLElement, options: TurnstileRenderOptions) => {
		mocks.options = options;
		return "widget-id";
	}),
	remove: vi.fn(),
	reset: vi.fn(),
}));

vi.mock("$lib/utils/auth/turnstileClient", () => ({
	loadTurnstileClient: vi.fn().mockResolvedValue({
		render: mocks.render,
		remove: mocks.remove,
		reset: mocks.reset,
	}),
}));

describe("TurnstileChallenge", () => {
	it("renders the visible challenge without redundant security copy", async () => {
		const { container } = render(TurnstileChallenge, {
			props: { siteKey: "test-site-key" },
		});

		await waitFor(() => expect(mocks.render).toHaveBeenCalledOnce());
		expect(mocks.options?.appearance).toBe("always");
		expect(container).not.toHaveTextContent(
			"Protected against automated sign-ins.",
		);
	});

	it("replaces a completed provider frame with a compact app confirmation", async () => {
		const { container, getByRole } = render(TurnstileChallenge, {
			props: { siteKey: "test-site-key" },
		});

		await waitFor(() => expect(mocks.render).toHaveBeenCalled());
		mocks.options?.callback("verified-token");

		await waitFor(() =>
			expect(getByRole("status")).toHaveTextContent("Security check complete"),
		);
		expect(container.querySelector(".turnstile-challenge__widget")).toHaveClass(
			"turnstile-challenge__widget--hidden",
		);
		expect(container.querySelector('input[name="captchaToken"]')).toHaveValue(
			"verified-token",
		);
	});
});
