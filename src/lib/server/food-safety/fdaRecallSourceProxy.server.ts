import { createHash, timingSafeEqual } from "node:crypto";

const FDA_ORIGIN = "https://www.fda.gov";
const FDA_RECALL_INDEX_PATH =
	"/datatables-json/recalls-market-withdrawals.json?_format=json";
const FDA_RECALL_DETAIL_PATH_PREFIX =
	"/safety/recalls-market-withdrawals-safety-alerts/";
const MAXIMUM_FDA_RESPONSE_BYTES = 3 * 1024 * 1024;

const secretsMatch = (provided: string, expected: string) => {
	const providedHash = createHash("sha256").update(provided).digest();
	const expectedHash = createHash("sha256").update(expected).digest();
	return timingSafeEqual(providedHash, expectedHash);
};

export const isAuthorizedFdaRecallSourceRequest = (
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

const readBoundedResponse = async (response: Response) => {
	const declaredLength = Number(response.headers.get("content-length"));
	if (
		Number.isFinite(declaredLength) &&
		declaredLength > MAXIMUM_FDA_RESPONSE_BYTES
	) {
		throw new Error("FDA recall source response exceeded the size limit");
	}
	const body = new Uint8Array(await response.arrayBuffer());
	if (body.byteLength > MAXIMUM_FDA_RESPONSE_BYTES) {
		throw new Error("FDA recall source response exceeded the size limit");
	}
	return body;
};

export const fetchFdaRecallSource = async ({
	sourcePath,
	ifNoneMatch,
	ifModifiedSince,
}: {
	sourcePath: string | null;
	ifNoneMatch: string | null;
	ifModifiedSince: string | null;
}) => {
	const sourceUrl = resolveFdaSourceUrl(sourcePath);
	if (!sourceUrl) return { status: "invalid_path" as const };

	const headers = new Headers({
		accept: sourcePath ? "text/html" : "application/json",
		"user-agent": "blendCalc FDA recall monitor relay",
	});
	if (ifNoneMatch) headers.set("if-none-match", ifNoneMatch);
	if (ifModifiedSince) headers.set("if-modified-since", ifModifiedSince);

	const upstreamResponse = await fetch(sourceUrl, {
		headers,
		signal: AbortSignal.timeout(45_000),
	});
	if (upstreamResponse.status === 304) {
		return {
			status: "not_modified" as const,
			etag: upstreamResponse.headers.get("etag"),
			lastModified: upstreamResponse.headers.get("last-modified"),
		};
	}
	if (!upstreamResponse.ok) {
		throw new Error(`FDA recall source returned ${upstreamResponse.status}`);
	}

	const body = await readBoundedResponse(upstreamResponse);
	if (!sourcePath) {
		const parsedBody = JSON.parse(new TextDecoder().decode(body));
		if (!Array.isArray(parsedBody)) {
			throw new Error("FDA recall source returned an invalid index");
		}
	}

	return {
		status: "ok" as const,
		body,
		contentType:
			upstreamResponse.headers.get("content-type") ??
			(sourcePath
				? "text/html; charset=utf-8"
				: "application/json; charset=utf-8"),
		etag: upstreamResponse.headers.get("etag"),
		lastModified: upstreamResponse.headers.get("last-modified"),
	};
};
