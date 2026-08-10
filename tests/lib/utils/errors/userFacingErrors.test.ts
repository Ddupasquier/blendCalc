import { describe, expect, it } from "vitest";
import {
	getUserFacingErrorMessage,
	UserFacingError,
} from "$lib/utils/errors/userFacingErrors";

const messages = {
	fallback: "Please try again.",
	network: "Check your connection and try again.",
	timeout: "That took too long. Try again.",
};

describe("getUserFacingErrorMessage", () => {
	it("never exposes raw browser network errors", () => {
		expect(
			getUserFacingErrorMessage(new TypeError("Failed to fetch"), messages),
		).toBe(messages.network);
	});

	it("uses a useful timeout message for slow requests", () => {
		expect(
			getUserFacingErrorMessage(new DOMException("Timed out", "TimeoutError"), messages),
		).toBe(messages.timeout);
	});

	it("preserves deliberately authored user-facing guidance", () => {
		const guidance =
			"We couldn't open this photo. Try another image or adjust it by hand.";
		expect(
			getUserFacingErrorMessage(new UserFacingError(guidance), messages),
		).toBe(guidance);
	});

	it("hides unknown technical details behind the contextual fallback", () => {
		expect(
			getUserFacingErrorMessage(
				new Error("relation food_image_assets does not exist"),
				messages,
			),
		).toBe(messages.fallback);
	});
});
