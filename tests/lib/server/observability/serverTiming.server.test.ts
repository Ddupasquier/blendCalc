import { afterEach, describe, expect, it, vi } from "vitest";
import {
	appendServerTimingHeader,
	measureServerTiming,
	recordServerTiming,
	serializeServerTimings,
} from "$lib/server/observability/serverTiming.server";

describe("server timing", () => {
	afterEach(() => vi.restoreAllMocks());

	it("records bounded privacy-safe duration fields", async () => {
		const locals = {} as App.Locals;
		vi.spyOn(performance, "now")
			.mockReturnValueOnce(100)
			.mockReturnValueOnce(125.67);
		await expect(
			measureServerTiming(locals, "ingredients", async () => "loaded"),
		).resolves.toBe("loaded");
		expect(locals.serverTimings).toEqual({ ingredients: 25.67 });
		expect(serializeServerTimings(locals.serverTimings ?? {})).toBe(
			"ingredients;dur=25.7",
		);
	});

	it("rejects unbounded names and appends one response header", () => {
		const locals = {} as App.Locals;
		expect(() => recordServerTiming(locals, "user@example.com", 10)).toThrow(
			"Invalid server timing name",
		);
		const response = new Response(null);
		appendServerTimingHeader(response, { auth: 12.34, total: 45.67 });
		expect(response.headers.get("server-timing")).toBe(
			"auth;dur=12.3, total;dur=45.7",
		);
	});
});
