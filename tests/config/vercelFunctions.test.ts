import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type VercelFunctionConfiguration = {
	experimentalTriggers?: Array<{ topic?: string; type?: string }>;
};

const vercelConfiguration = JSON.parse(readFileSync("vercel.json", "utf8")) as {
	functions?: Record<string, VercelFunctionConfiguration>;
};

describe("Vercel functions", () => {
	it("maps every configured function to a provider entrypoint that exists", () => {
		for (const functionPath of Object.keys(
			vercelConfiguration.functions ?? {},
		)) {
			expect(functionPath).toMatch(/^api\//u);
			expect(existsSync(functionPath), functionPath).toBe(true);
		}
	});

	it("delivers nutrition-label OCR jobs to its Vercel queue consumer", () => {
		const queueFunction =
			vercelConfiguration.functions?.["api/nutrition-label-ocr-queue.ts"];
		expect(queueFunction?.experimentalTriggers).toContainEqual({
			type: "queue/v2beta",
			topic: "nutrition-label-ocr",
			retryAfterSeconds: 10,
			initialDelaySeconds: 0,
		});
	});
});
