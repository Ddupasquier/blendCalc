import {
	readLimitedFormData,
	readLimitedJson,
	readRequestBytes,
} from "$lib/server/security/requestBody.server";
import { describe, expect, it } from "vitest";

describe("bounded request bodies", () => {
	it("rejects a declared body that is too large before reading it", async () => {
		const request = new Request("http://localhost/api", {
			method: "POST",
			headers: {
				"content-length": "100",
				"content-type": "application/json",
			},
			body: "{}",
		});

		await expect(readRequestBytes(request, 10)).rejects.toMatchObject({
			status: 413,
			body: { code: "REQUEST_TOO_LARGE" },
		});
	});

	it("rejects an undeclared body once streamed bytes exceed the limit", async () => {
		const request = new Request("http://localhost/api", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: new Uint8Array(20),
		});

		await expect(readRequestBytes(request, 10)).rejects.toMatchObject({
			status: 413,
			body: { code: "REQUEST_TOO_LARGE" },
		});
	});

	it("parses bounded JSON and rejects invalid content types", async () => {
		const request = new Request("http://localhost/api", {
			method: "POST",
			headers: { "content-type": "application/json; charset=utf-8" },
			body: JSON.stringify({ safe: true }),
		});
		await expect(readLimitedJson(request, 1024)).resolves.toEqual({
			safe: true,
		});

		const invalidType = new Request("http://localhost/api", {
			method: "POST",
			headers: { "content-type": "text/plain" },
			body: "{}",
		});
		await expect(readLimitedJson(invalidType, 1024)).rejects.toMatchObject({
			status: 400,
			body: { code: "INVALID_REQUEST" },
		});
	});

	it("parses bounded form data", async () => {
		const formData = new FormData();
		formData.set("name", "Spinach");
		const request = new Request("http://localhost/form", {
			method: "POST",
			body: formData,
		});

		const parsed = await readLimitedFormData(request, 1024 * 1024);
		expect(parsed.get("name")).toBe("Spinach");
	});
});
