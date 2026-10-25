import { describe, expect, it } from "vitest";
import { params } from "../../src/params";
import { variables } from "../../src/env";

describe("framework route parameter boundaries", () => {
	it.each(["0", "-1", "42", "9007199254740991"])(
		"preserves signed integer %s",
		(value) => {
			expect(params.signedInteger["~standard"].validate(value)).toEqual({
				value,
			});
		},
	);
	it.each(["", "1.5", "1x", "9007199254740992", " 1"])(
		"rejects invalid integer %s",
		(value) => {
			expect(params.signedInteger["~standard"].validate(value)).toHaveProperty(
				"issues",
			);
		},
	);
	it("preserves UUID syntax and rejects invalid versions and variants", () => {
		const uuid = "11111111-2222-4333-8444-555555555555";
		expect(params.uuid["~standard"].validate(uuid)).toEqual({ value: uuid });
		for (const invalid of [
			uuid.replace("4333", "9333"),
			uuid.replace("8444", "1444"),
			"not-a-uuid",
		]) {
			expect(params.uuid["~standard"].validate(invalid)).toHaveProperty(
				"issues",
			);
		}
	});
});

describe("explicit framework environment declarations", () => {
	it("exposes only the existing browser-safe keys", () => {
		const publicKeys = Object.entries(variables)
			.filter(([, entry]) => "public" in entry && entry.public)
			.map(([name]) => name)
			.sort();
		expect(publicKeys).toEqual([
			"PUBLIC_SITE_URL",
			"PUBLIC_SUPABASE_PUBLISHABLE_KEY",
			"PUBLIC_SUPABASE_URL",
			"PUBLIC_TURNSTILE_SITE_KEY",
		]);
		expect(variables.PUBLIC_SUPABASE_URL.static).toBe(true);
		expect(variables.PUBLIC_SUPABASE_PUBLISHABLE_KEY.static).toBe(true);
	});
});
