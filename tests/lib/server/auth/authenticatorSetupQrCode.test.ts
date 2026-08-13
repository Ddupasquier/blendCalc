import {
	BinaryBitmap,
	DecodeHintType,
	HybridBinarizer,
	QRCodeReader,
	RGBLuminanceSource,
} from "@zxing/library";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createAuthenticatorSetupQrCodeDataUrl } from "$lib/server/auth/authenticatorSetupQrCode.server";

const SECRET = "JBSWY3DPEHPK3PXP";
const AUTHENTICATOR_URI =
	"otpauth://totp/blendCalc%3Amoderator%40example.com" +
	`?secret=${SECRET}&issuer=blendCalc&algorithm=SHA1&digits=6&period=30`;

const decodeQrCodeDataUrl = async (
	qrCodeDataUrl: string,
	renderedWidthPixels?: number,
) => {
	const encodedSvg = qrCodeDataUrl.replace(
		"data:image/svg+xml;base64,",
		"",
	);
	const renderedQrCode = sharp(Buffer.from(encodedSvg, "base64"));
	if (renderedWidthPixels) {
		renderedQrCode.resize(renderedWidthPixels, renderedWidthPixels, {
			kernel: "nearest",
		});
	}
	const { data, info } = await renderedQrCode
		.greyscale()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const luminanceSource = new RGBLuminanceSource(
		new Uint8ClampedArray(data),
		info.width,
		info.height,
	);
	const bitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
	return new QRCodeReader()
		.decode(bitmap, new Map([[DecodeHintType.PURE_BARCODE, true]]))
		.getText();
};

describe("authenticator setup QR codes", () => {
	it("renders a high-contrast QR code that decodes to the exact TOTP URI", async () => {
		const qrCodeDataUrl = createAuthenticatorSetupQrCodeDataUrl({
			authenticatorUri: AUTHENTICATOR_URI,
			expectedSecret: SECRET,
		});

		expect(qrCodeDataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
		expect(await decodeQrCodeDataUrl(qrCodeDataUrl)).toBe(AUTHENTICATOR_URI);
		expect(await decodeQrCodeDataUrl(qrCodeDataUrl, 228)).toBe(
			AUTHENTICATOR_URI,
		);
		const decodedSvg = Buffer.from(
			qrCodeDataUrl.replace("data:image/svg+xml;base64,", ""),
			"base64",
		).toString("utf8");
		expect(decodedSvg).toContain('shape-rendering="crispEdges"');
		expect(decodedSvg).toContain('fill="#fff"');
		expect(decodedSvg).toContain('fill="#000"');
	});

	it.each([
		["a non-authenticator URL", "https://example.com", SECRET],
		[
			"a different secret than Supabase returned",
			AUTHENTICATOR_URI,
			"DIFFERENTSECRET",
		],
	])("rejects %s", (_description, authenticatorUri, expectedSecret) => {
		expect(() =>
			createAuthenticatorSetupQrCodeDataUrl({
				authenticatorUri,
				expectedSecret,
			}),
		).toThrow("Authenticator enrollment data is invalid.");
	});
});
