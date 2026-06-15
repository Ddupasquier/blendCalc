import { describe, expect, it } from "vitest";
import { applySecurityHeaders } from "$lib/utils/http/securityHeaders";

describe("security response headers", () => {
	it("prevents authenticated responses from being cached", () => {
		const response = new Response();
		applySecurityHeaders(response, new URL("https://example.com/mix"), true);

		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(response.headers.get("strict-transport-security")).toContain(
			"max-age=31536000",
		);
		expect(response.headers.get("x-frame-options")).toBe("DENY");
	});

	it("allows first-party camera use while blocking unrelated sensitive capabilities", () => {
		const response = new Response();
		applySecurityHeaders(response, new URL("http://localhost:5173/"), false);

		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("permissions-policy")).toContain("camera=(self)");
		expect(response.headers.get("permissions-policy")).toContain("microphone=()");
		expect(response.headers.has("strict-transport-security")).toBe(false);
	});

	it("does not cache authentication pages", () => {
		const response = new Response();
		applySecurityHeaders(response, new URL("https://example.com/auth"), false);

		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});
});
