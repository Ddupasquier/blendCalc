import { cleanup, render, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("$lib/utils/advertising/googleAdDelivery", () => ({
	requestGoogleDisplayAd: vi.fn(),
	loadGoogleAdvertising: vi.fn(),
}));
import AppAdvertising from "$lib/components/advertising/AppAdvertising/AppAdvertising.svelte";
import {
	ADVERTISING_SESSION_CONTEXT,
	createAdvertisingSession,
} from "$lib/utils/advertising/advertisingSession.svelte";
import { requestGoogleDisplayAd } from "$lib/utils/advertising/googleAdDelivery";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});
const mount = () => {
	const session = createAdvertisingSession();
	session.update({ mode: "google" }, "account-one", "supported", false);
	Object.assign(session.state, {
		visible: true,
		blocked: false,
		consent: true,
		networkReady: true,
	});
	session.ensureNetwork = vi.fn().mockResolvedValue(undefined);
	const result = render(AppAdvertising, {
		props: { pathname: "/saved", hasContent: true },
		context: new Map([[ADVERTISING_SESSION_CONTEXT, session]]),
	});
	return { session, result };
};
describe("placement request ownership", () => {
	it("keeps one live request and tears it down when a route becomes ineligible", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					new Response(JSON.stringify({ eligibility: "supported" })),
				),
		);
		const stop = vi.fn();
		vi.mocked(requestGoogleDisplayAd).mockReturnValue(stop);
		const { result } = mount();
		await waitFor(() => expect(requestGoogleDisplayAd).toHaveBeenCalledOnce());
		await result.rerender({ pathname: "/saved/sort", hasContent: true });
		await waitFor(() => expect(stop).toHaveBeenCalledOnce());
		expect(fetch).toHaveBeenCalledOnce();
	});
	it("does not deliver a late response into a different account", async () => {
		let complete!: (response: Response) => void;
		vi.stubGlobal(
			"fetch",
			vi.fn(
				() =>
					new Promise<Response>((resolve) => {
						complete = resolve;
					}),
			),
		);
		const { session } = mount();
		await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
		session.update({ mode: "google" }, "account-two", "ad-free", false);
		complete(new Response(JSON.stringify({ eligibility: "supported" })));
		await waitFor(() => expect(session.state.eligibility).toBe("ad-free"));
		expect(requestGoogleDisplayAd).not.toHaveBeenCalled();
	});
	it("suppresses a slot when the final server check changes to ad-free", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					new Response(JSON.stringify({ eligibility: "ad-free" })),
				),
		);
		const { session } = mount();
		await waitFor(() => expect(session.state.eligibility).toBe("ad-free"));
		expect(requestGoogleDisplayAd).not.toHaveBeenCalled();
	});
});
