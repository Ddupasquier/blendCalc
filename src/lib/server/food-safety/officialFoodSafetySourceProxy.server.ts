import { createHash, timingSafeEqual } from "node:crypto";
import { fetchWithExternalRequestPolicy } from "$lib/server/http/externalRequest.server";

const FDA_ORIGIN = "https://www.fda.gov";
const FDA_RECALL_INDEX_PATH =
	"/datatables-json/recalls-market-withdrawals.json?_format=json";
const FDA_RECALL_DETAIL_PATH_PREFIX =
	"/safety/recalls-market-withdrawals-safety-alerts/";
const FSIS_RECALL_URL = "https://www.fsis.usda.gov/fsis/api/recall/v/1";
const MAXIMUM_FDA_RESPONSE_BYTES = 3 * 1024 * 1024;
const MAXIMUM_FSIS_RESPONSE_BYTES = 16 * 1024 * 1024;

export type OfficialFoodSafetySource = "fda" | "fsis";

const secretsMatch = (provided: string, expected: string) => {
	const providedHash = createHash("sha256").update(provided).digest();
	const expectedHash = createHash("sha256").update(expected).digest();
	return timingSafeEqual(providedHash, expectedHash);
};

export const isAuthorizedOfficialFoodSafetySourceRequest = (
	providedSecret: string | null,
	expectedSecret: string | undefined,
) =>
	Boolean(
		providedSecret &&
		expectedSecret &&
		secretsMatch(providedSecret, expectedSecret),
	);

const resolveFdaSourceUrl = (sourcePath: string | null) => {
	if (!sourcePath) return new URL(FDA_RECALL_INDEX_PATH, FDA_ORIGIN);
	if (
		!sourcePath.startsWith(FDA_RECALL_DETAIL_PATH_PREFIX) ||
		sourcePath.includes("?") ||
		sourcePath.includes("#")
	) {
		return null;
	}
	const sourceUrl = new URL(sourcePath, FDA_ORIGIN);
	return sourceUrl.pathname.startsWith(FDA_RECALL_DETAIL_PATH_PREFIX)
		? sourceUrl
		: null;
};

const readBoundedResponse = async (
	response: Response,
	maximumResponseBytes: number,
) => {
	const declaredLength = Number(response.headers.get("content-length"));
	if (
		Number.isFinite(declaredLength) &&
		declaredLength > maximumResponseBytes
	) {
		throw new Error("Official food safety response exceeded the size limit");
	}
	const body = new Uint8Array(await response.arrayBuffer());
	if (body.byteLength > maximumResponseBytes) {
		throw new Error("Official food safety response exceeded the size limit");
	}
	return body;
};

export const fetchOfficialFoodSafetySource = async ({
	source,
	sourcePath,
	ifNoneMatch,
	ifModifiedSince,
}: {
	source: OfficialFoodSafetySource;
	sourcePath: string | null;
	ifNoneMatch: string | null;
	ifModifiedSince: string | null;
}) => {
	const sourceUrl =
		source === "fsis"
			? sourcePath
				? null
				: new URL(FSIS_RECALL_URL)
			: resolveFdaSourceUrl(sourcePath);
	if (!sourceUrl) return { status: "invalid_path" as const };

	const headers = new Headers({
		accept: source === "fda" && sourcePath ? "text/html" : "application/json",
		"user-agent": "blendCalc official food safety monitor relay",
	});
	if (ifNoneMatch) headers.set("if-none-match", ifNoneMatch);
	if (ifModifiedSince) headers.set("if-modified-since", ifModifiedSince);

	const upstreamResponse = await fetchWithExternalRequestPolicy(sourceUrl, {
		headers,
		timeoutMilliseconds: 45_000,
		acceptedStatusCodes: [304],
	});
	if (upstreamResponse.status === 304) {
		return {
			status: "not_modified" as const,
			etag: upstreamResponse.headers.get("etag"),
			lastModified: upstreamResponse.headers.get("last-modified"),
		};
	}
	if (!upstreamResponse.ok) {
		throw new Error(
			`Official food safety source returned ${upstreamResponse.status}`,
		);
	}

	const body = await readBoundedResponse(
		upstreamResponse,
		source === "fsis"
			? MAXIMUM_FSIS_RESPONSE_BYTES
			: MAXIMUM_FDA_RESPONSE_BYTES,
	);
	if (source === "fsis" || !sourcePath) {
		const parsedBody = JSON.parse(new TextDecoder().decode(body));
		if (!Array.isArray(parsedBody)) {
			throw new Error("Official food safety source returned invalid data");
		}
	}

	return {
		status: "ok" as const,
		body,
		contentType:
			upstreamResponse.headers.get("content-type") ??
			(source === "fda" && sourcePath
				? "text/html; charset=utf-8"
				: "application/json; charset=utf-8"),
		etag: upstreamResponse.headers.get("etag"),
		lastModified: upstreamResponse.headers.get("last-modified"),
	};
};
