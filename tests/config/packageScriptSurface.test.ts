import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readText = (filePath: string) => readFileSync(filePath, "utf8");
const packageConfiguration = JSON.parse(readText("package.json"));
const scripts = packageConfiguration.scripts as Record<string, string>;

const removedNarrowAliases = [
	"audit:blendCalcAPI-catalog",
	"audit:blendCalcAPI-load",
	"audit:blendCalcAPI-payloads",
	"audit:blendCalcAPI-performance",
	"blendCalcAPI:db:start",
	"catalog:qa-seed",
	"db:local:start",
	"db:rehearsal:start",
	"db:test:start",
	"lint:code",
	"lint:styles",
	"mobile:open:ios",
	"qa:deterministic",
	"rehearsal:sanitization:generate",
	"test:e2e:chromium",
];

describe("root npm script surface", () => {
	it("keeps the supported command surface intentionally bounded", () => {
		expect(Object.keys(scripts).length).toBeLessThanOrEqual(80);
		for (const alias of removedNarrowAliases) {
			expect(scripts).not.toHaveProperty(alias);
		}
	});

	it("keeps every composed npm command resolvable", () => {
		for (const [owner, command] of Object.entries(scripts)) {
			for (const match of command.matchAll(/npm run ([A-Za-z0-9:_-]+)/g)) {
				expect(
					scripts,
					`${owner} calls missing npm script ${match[1]}`,
				).toHaveProperty(match[1]);
			}
		}
	});

	it("uses argument-based managers for multi-action tool families", () => {
		for (const command of [
			"blendCalcAPI:db",
			"db:local",
			"db:test",
			"rehearsal",
		]) {
			expect(scripts).toHaveProperty(command);
		}
	});
});
