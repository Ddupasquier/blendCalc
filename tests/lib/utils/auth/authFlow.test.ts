import { describe, expect, it, vi } from "vitest";
import {
	clearAuthFlowContext,
	consumeAuthFlowContext,
	getAuthCallbackFailureUrl,
	getSafeAuthNextPath,
	storeAuthFlowContext,
} from "$lib/utils/auth/authFlow";

const createCookies = () => {
	const values = new Map<string, string>();
	return {
		get: vi.fn((name: string) => values.get(name)),
		set: vi.fn((name: string, value: string) => values.set(name, value)),
		delete: vi.fn((name: string) => values.delete(name)),
	};
};

describe("authentication flow", () => {
	it("stores and consumes the safe post-login destination", () => {
		const cookies = createCookies();
		storeAuthFlowContext(cookies as never, "/mix?loaded=true", new URL("https://example.com/auth"));

		expect(consumeAuthFlowContext(cookies as never)).toEqual({
			next: "/mix?loaded=true",
			origin: "https://example.com",
			flowId: expect.any(String),
		});
		expect(cookies.delete).toHaveBeenCalledWith("smoothie-auth-next", {
			path: "/",
		});
		expect(cookies.delete).toHaveBeenCalledWith("smoothie-auth-origin", {
			path: "/",
		});
		expect(cookies.delete).toHaveBeenCalledWith("smoothie-auth-flow-id", {
			path: "/",
		});
		expect(cookies.set).toHaveBeenCalledWith(
			"smoothie-auth-next",
			"/mix?loaded=true",
			expect.objectContaining({
				httpOnly: true,
				maxAge: 600,
				sameSite: "lax",
				secure: true,
			}),
		);
	});

	it("clears an abandoned authentication flow", () => {
		const cookies = createCookies();
		storeAuthFlowContext(cookies as never, "/fridge", new URL("http://localhost:5173/auth"));
		clearAuthFlowContext(cookies as never);

		expect(consumeAuthFlowContext(cookies as never)).toEqual({
			next: "/",
			origin: null,
			flowId: null,
		});
	});

	it("rejects external redirect destinations", () => {
		expect(getSafeAuthNextPath("https://attacker.example")).toBe("/");
		expect(getSafeAuthNextPath("//attacker.example")).toBe("/");
	});

	it("builds an encoded callback failure URL", () => {
		expect(getAuthCallbackFailureUrl("callback_exchange", "/fridge")).toBe(
			"/auth?error=callback_exchange&next=%2Ffridge",
		);
	});
});
