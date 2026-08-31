import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = readFileSync(
	"infrastructure/blendCalcAPI/supabase/config.toml",
	"utf8",
);

describe("isolated blendCalcAPI database config", () => {
	it("appends the publication schema to the hosted Data API defaults", () => {
		expect(config).toContain(
			'schemas = ["public", "graphql_public", "blendcalc_api"]',
		);
		expect(config).toContain(
			'extra_search_path = ["public", "extensions", "blendcalc_api"]',
		);
	});
});
