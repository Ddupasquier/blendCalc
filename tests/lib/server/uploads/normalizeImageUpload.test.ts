import { normalizeImageUpload } from "$lib/server/uploads/normalizeImageUpload.server";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

describe("image upload normalization", () => {
	it("decodes, resizes, and re-encodes an uploaded image", async () => {
		const source = await sharp({
			create: {
				width: 400,
				height: 200,
				channels: 3,
				background: "#56ad7a",
			},
		})
			.png()
			.toBuffer();

		const normalized = await normalizeImageUpload({
			bytes: source,
			maximumOutputBytes: 1024 * 1024,
			maximumWidth: 100,
			maximumHeight: 100,
		});
		const metadata = await sharp(normalized.bytes).metadata();

		expect(normalized.contentType).toBe("image/webp");
		expect(normalized.extension).toBe("webp");
		expect(metadata.format).toBe("webp");
		expect(metadata.width).toBe(100);
		expect(metadata.height).toBe(50);
	});

	it("rejects bytes that are not a decodable image", async () => {
		await expect(
			normalizeImageUpload({
				bytes: new TextEncoder().encode("<html>not an image</html>"),
				maximumOutputBytes: 1024 * 1024,
				maximumWidth: 100,
				maximumHeight: 100,
			}),
		).rejects.toThrow();
	});

	it("rejects a normalized file that exceeds its storage boundary", async () => {
		const source = await sharp({
			create: {
				width: 20,
				height: 20,
				channels: 3,
				background: "#56ad7a",
			},
		})
			.png()
			.toBuffer();

		await expect(
			normalizeImageUpload({
				bytes: source,
				maximumOutputBytes: 1,
				maximumWidth: 20,
				maximumHeight: 20,
			}),
		).rejects.toThrow("The normalized image is too large.");
	});
});
