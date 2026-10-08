import { normalizeImageUpload } from "$lib/server/uploads/normalizeImageUpload.server";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

describe("image upload normalization", () => {
	it.each(["png", "jpeg", "webp"] as const)(
		"normalizes %s without enlarging a smaller upload",
		async (format) => {
			const source = await sharp({
				create: {
					width: 24,
					height: 12,
					channels: 3,
					background: "#56ad7a",
				},
			})
				.toFormat(format)
				.toBuffer();
			const normalized = await normalizeImageUpload({
				bytes: source,
				maximumOutputBytes: 1024 * 1024,
				maximumWidth: 100,
				maximumHeight: 100,
			});
			const metadata = await sharp(normalized.bytes).metadata();
			expect(metadata.format).toBe("webp");
			expect([metadata.width, metadata.height]).toEqual([24, 12]);
		},
	);

	it("refuses empty input before decoding", async () => {
		await expect(
			normalizeImageUpload({
				bytes: new Uint8Array(),
				maximumOutputBytes: 1024 * 1024,
				maximumWidth: 100,
				maximumHeight: 100,
			}),
		).rejects.toThrow("The image is empty.");
	});

	it("refuses an image above the input pixel boundary", async () => {
		const source = await sharp({
			create: {
				width: 6400,
				height: 6300,
				channels: 3,
				background: "#56ad7a",
			},
		})
			.png()
			.toBuffer();
		await expect(
			normalizeImageUpload({
				bytes: source,
				maximumOutputBytes: 1024 * 1024,
				maximumWidth: 100,
				maximumHeight: 100,
			}),
		).rejects.toThrow(/pixel limit|dimensions/iu);
	});

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
