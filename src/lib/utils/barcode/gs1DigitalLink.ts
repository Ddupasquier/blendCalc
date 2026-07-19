import { normalizeBarcode } from "$lib/utils/barcode/barcode";

export type Gs1DigitalLinkProduct = {
	canonicalValue: string;
	productReference: string;
};

const GS1_GTIN_APPLICATION_IDENTIFIER = "01";

const decodePathSegments = (pathname: string) => {
	try {
		return pathname
			.split("/")
			.filter(Boolean)
			.map((segment) => decodeURIComponent(segment));
	} catch {
		return [];
	}
};

export const parseGs1DigitalLink = (
	value: string,
): Gs1DigitalLinkProduct | null => {
	let url: URL;
	try {
		url = new URL(value.trim());
	} catch {
		return null;
	}

	if (url.protocol !== "https:" || url.username || url.password) return null;

	const segments = decodePathSegments(url.pathname);
	const identifierIndex = segments.findIndex(
		(segment, index) => {
			const candidate = segments[index + 1] ?? "";
			return (
				segment === GS1_GTIN_APPLICATION_IDENTIFIER &&
				/^\d{14}$/.test(candidate) &&
				normalizeBarcode(candidate) === candidate
			);
		},
	);
	if (identifierIndex < 0) return null;

	const gtin = segments[identifierIndex + 1];

	const productPath = segments
		.slice(0, identifierIndex + 2)
		.map((segment) => encodeURIComponent(segment))
		.join("/");

	return {
		canonicalValue: gtin,
		productReference: `${url.origin}/${productPath}`,
	};
};
