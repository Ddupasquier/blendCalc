import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260815100000_cheeky_delight_message_preferences.sql",
	"utf8",
);
const layoutServer = readFileSync("src/routes/+layout.server.ts", "utf8");
const resolver = readFileSync(
	"src/lib/utils/delight/delightMessages.ts",
	"utf8",
);

describe("cheeky delight message preferences migration", () => {
	it("adds a default-off account preference and a constrained DB-owned tone", () => {
		expect(migration).toContain(
			"add column cheeky_messages_enabled boolean not null default false",
		);
		expect(migration).toContain("tone in ('standard', 'cheeky')");
		expect(migration).toContain("app_delight_messages_cheeky_context_check");
	});

	it("stores the approved copy in the database rather than the client", () => {
		for (const message of [
			"Nice buns. Nutritionally speaking.",
			"Things are getting spicy.",
			"Those macros are flirting with perfection.",
			"Saved. You two clearly have chemistry.",
		]) {
			expect(migration).toContain(message);
			expect(resolver).not.toContain(message);
		}
	});

	it("filters server-delivered reference data for accounts that did not opt in", () => {
		expect(layoutServer).toContain("profile?.cheeky_messages_enabled ?? false");
		expect(layoutServer).toContain('message.tone === "standard"');
		expect(resolver).toContain("CHEEKY_MESSAGE_TRIGGER_KEYS");
	});
});
