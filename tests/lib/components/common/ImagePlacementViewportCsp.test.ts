// @vitest-environment node

import { readFile } from "node:fs/promises";
import { compile, preprocess } from "svelte/compiler";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { describe, expect, it } from "vitest";

const imageComponents = [
	"src/lib/components/common/images/ImagePlacementViewport/ImagePlacementViewport.svelte",
	"src/lib/components/common/images/ProductImageFrame/ProductImageFrame.svelte",
];

const compileServerComponent = async (filename: string) => {
	const source = await readFile(filename, "utf8");
	const processed = await preprocess(source, vitePreprocess(), { filename });
	return compile(processed.code, {
		filename,
		generate: "server",
		runes: true,
	}).js.code;
};

describe("image component CSP", () => {
	it.each(imageComponents)(
		"does not emit inline image event handlers from %s",
		async (filename) => {
			const serverCode = await compileServerComponent(filename);

			expect(serverCode).not.toMatch(/on(?:load|error)=/);
			expect(serverCode).not.toContain("this.__e=event");
		},
		15_000,
	);
});
