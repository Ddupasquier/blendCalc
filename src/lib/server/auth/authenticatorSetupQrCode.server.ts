import {
	BarcodeFormat,
	EncodeHintType,
	QRCodeWriter,
} from "@zxing/library";

const AUTHENTICATOR_QR_ERROR_CORRECTION_LEVEL = "M";
const AUTHENTICATOR_QR_QUIET_ZONE_MODULES = 4;
const AUTHENTICATOR_QR_RENDERED_PIXELS_PER_MODULE = 6;

type AuthenticatorSetupQrCodeParameters = {
	authenticatorUri: string;
	expectedSecret: string;
};

const readValidatedAuthenticatorUri = (
	authenticatorUri: string,
	expectedSecret: string,
) => {
	let parsedAuthenticatorUri: URL;
	try {
		parsedAuthenticatorUri = new URL(authenticatorUri);
	} catch {
		throw new Error("Authenticator enrollment data is invalid.");
	}

	const uriSecret = parsedAuthenticatorUri.searchParams.get("secret");
	const issuer = parsedAuthenticatorUri.searchParams.get("issuer");
	if (
		parsedAuthenticatorUri.protocol !== "otpauth:" ||
		parsedAuthenticatorUri.hostname !== "totp" ||
		!parsedAuthenticatorUri.pathname.slice(1) ||
		!issuer ||
		!uriSecret ||
		uriSecret !== expectedSecret
	) {
		throw new Error("Authenticator enrollment data is invalid.");
	}

	return authenticatorUri;
};

const createQrCodePath = (
	qrCodeMatrix: ReturnType<QRCodeWriter["encode"]>,
) => {
	const pathSegments: string[] = [];
	for (let row = 0; row < qrCodeMatrix.getHeight(); row += 1) {
		let column = 0;
		while (column < qrCodeMatrix.getWidth()) {
			if (!qrCodeMatrix.get(column, row)) {
				column += 1;
				continue;
			}

			const runStart = column;
			while (
				column < qrCodeMatrix.getWidth() &&
				qrCodeMatrix.get(column, row)
			) {
				column += 1;
			}
			const runLength = column - runStart;
			pathSegments.push(
				`M${runStart} ${row}h${runLength}v1h-${runLength}z`,
			);
		}
	}

	return pathSegments.join("");
};

export const createAuthenticatorSetupQrCodeDataUrl = ({
	authenticatorUri,
	expectedSecret,
}: AuthenticatorSetupQrCodeParameters) => {
	const validatedAuthenticatorUri = readValidatedAuthenticatorUri(
		authenticatorUri,
		expectedSecret,
	);
	const encodingHints = new Map<EncodeHintType, string | number>([
		[
			EncodeHintType.ERROR_CORRECTION,
			AUTHENTICATOR_QR_ERROR_CORRECTION_LEVEL,
		],
		[EncodeHintType.MARGIN, AUTHENTICATOR_QR_QUIET_ZONE_MODULES],
	]);
	const qrCodeMatrix = new QRCodeWriter().encode(
		validatedAuthenticatorUri,
		BarcodeFormat.QR_CODE,
		0,
		0,
		encodingHints,
	);
	const moduleCount = qrCodeMatrix.getWidth();
	const renderedSizePixels =
		moduleCount * AUTHENTICATOR_QR_RENDERED_PIXELS_PER_MODULE;
	const svg = [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${renderedSizePixels}" height="${renderedSizePixels}" viewBox="0 0 ${moduleCount} ${moduleCount}" shape-rendering="crispEdges">`,
		`<rect width="${moduleCount}" height="${moduleCount}" fill="#fff"/>`,
		`<path d="${createQrCodePath(qrCodeMatrix)}" fill="#000"/>`,
		"</svg>",
	].join("");

	return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};
