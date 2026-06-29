import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const componentPath = resolve(
	process.cwd(),
	"src/lib/components/common/BottomSheet.svelte",
);

describe("BottomSheet shared chrome", () => {
	it("keeps the drag handle horizontally centered", () => {
		const source = readFileSync(componentPath, "utf8");
		const handleRule = source.match(/\.bottom-sheet__handle\s*{(?<body>[^}]*)}/s);

		expect(handleRule?.groups?.body).toContain("justify-self: center;");
		expect(handleRule?.groups?.body).toContain("place-items: center;");
	});
});
