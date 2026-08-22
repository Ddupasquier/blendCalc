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

describe("original playful message preference migration", () => {
	it("records the original rollout default and constrained DB-owned tone", () => {
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

	it("filters server-delivered reference data for accounts that turn messages off", () => {
		expect(layoutServer).toContain("profile?.cheeky_messages_enabled ?? true");
		expect(layoutServer).toContain('message.tone === "standard"');
		expect(resolver).toContain("PLAYFUL_MESSAGE_TRIGGER_KEYS");
	});
});
