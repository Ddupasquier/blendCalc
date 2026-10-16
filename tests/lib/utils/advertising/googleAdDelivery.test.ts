// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	loadGoogleAdvertising,
	requestGoogleDisplayAd,
	type GoogleAdWindow,
} from "$lib/utils/advertising/googleAdDelivery";

afterEach(() => {
	document.head.replaceChildren();
	document.body.replaceChildren();
	vi.useRealTimers();
});
describe("Google display delivery lifecycle", () => {
	it("loads one nonce-bearing SDK for concurrent consumers", async () => {
		const bootstrap = document.createElement("script");
		bootstrap.nonce = "test-nonce";
		document.head.append(bootstrap);
		const first = loadGoogleAdvertising(document);
		const second = loadGoogleAdvertising(document);
		const scripts = document.querySelectorAll<HTMLScriptElement>("script[src]");
		expect(scripts).toHaveLength(1);
		expect(scripts[0].nonce).toBe("test-nonce");
		expect(scripts[0].hasAttribute("onload")).toBe(false);
		expect(scripts[0].hasAttribute("onerror")).toBe(false);
		scripts[0].dispatchEvent(new Event("load"));
		await Promise.all([first, second]);
		await expect(loadGoogleAdvertising(document)).resolves.toBeUndefined();
	});
	it("fails closed on SDK failure without an automatic retry", async () => {
		const pending = loadGoogleAdvertising(document);
		const assertion = expect(pending).rejects.toThrow("unavailable");
		document.querySelector("script")!.dispatchEvent(new Event("error"));
		await assertion;
		await expect(loadGoogleAdvertising(document)).rejects.toThrow(
			"unavailable",
		);
		expect(document.querySelectorAll("script")).toHaveLength(1);
	});
	it("queues one display request per connected slot and removes delivery observers", async () => {
		vi.useFakeTimers();
		const node = document.createElement("ins");
		document.body.append(node);
		const target = { adsbygoogle: [] } as unknown as GoogleAdWindow;
		const unavailable = vi.fn();
		const cleanup = requestGoogleDisplayAd(
			node,
			target,
			() => true,
			unavailable,
		);
		requestGoogleDisplayAd(node, target, () => true, unavailable);
		expect(target.adsbygoogle).toHaveLength(1);
		expect(node.dataset.adSlot).toBe("1144802452");
		node.dataset.adStatus = "filled";
		await Promise.resolve();
		vi.advanceTimersByTime(12_000);
		expect(unavailable).not.toHaveBeenCalled();
		cleanup();
		node.dataset.adStatus = "unfilled";
		await Promise.resolve();
		expect(unavailable).not.toHaveBeenCalled();
	});
	it("never requests ads while refused or detached", () => {
		const node = document.createElement("ins");
		const target = { adsbygoogle: [] } as unknown as GoogleAdWindow;
		requestGoogleDisplayAd(node, target, () => true, vi.fn());
		document.body.append(node);
		requestGoogleDisplayAd(node, target, () => false, vi.fn());
		expect(target.adsbygoogle).toHaveLength(0);
	});
	it("clears unfilled inventory without claiming an impression", async () => {
		const node = document.createElement("ins");
		document.body.append(node);
		const unavailable = vi.fn();
		const stop = requestGoogleDisplayAd(
			node,
			{ adsbygoogle: [] } as unknown as GoogleAdWindow,
			() => true,
			unavailable,
		);
		node.dataset.adStatus = "unfilled";
		await Promise.resolve();
		expect(unavailable).toHaveBeenCalledOnce();
		stop();
	});
});
