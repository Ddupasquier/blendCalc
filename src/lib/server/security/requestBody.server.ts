import { throwAppError } from "$lib/server/errors/appError.server";

const parseContentLength = (request: Request) => {
	const value = request.headers.get("content-length")?.trim();
	if (!value) return null;
	const length = Number(value);
	return Number.isSafeInteger(length) && length >= 0 ? length : null;
};

const assertRequestEncoding = (request: Request) => {
	const encoding = request.headers.get("content-encoding")?.trim().toLowerCase();
	if (encoding && encoding !== "identity") {
		throwAppError(400, "INVALID_REQUEST");
	}
};

export const readRequestBytes = async (
	request: Request,
	maximumBytes: number,
) => {
	assertRequestEncoding(request);
	const contentLength = parseContentLength(request);
	if (contentLength !== null && contentLength > maximumBytes) {
		throwAppError(413, "REQUEST_TOO_LARGE");
	}
	if (!request.body) return new Uint8Array();

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			totalBytes += value.byteLength;
			if (totalBytes > maximumBytes) {
				await reader.cancel();
				throwAppError(413, "REQUEST_TOO_LARGE");
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	const body = new Uint8Array(totalBytes);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return body;
};

export const readLimitedJson = async (
	request: Request,
	maximumBytes: number,
): Promise<unknown> => {
	const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
	if (!contentType.startsWith("application/json")) {
		throwAppError(400, "INVALID_REQUEST");
	}
	const bytes = await readRequestBytes(request, maximumBytes);
	if (bytes.byteLength === 0) throwAppError(400, "INVALID_REQUEST");
	try {
		return JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		throwAppError(400, "INVALID_REQUEST");
	}
};

export const readLimitedFormData = async (
	request: Request,
	maximumBytes: number,
): Promise<FormData> => {
	const contentType = request.headers.get("content-type")?.trim();
	if (!contentType) {
		return throwAppError(400, "INVALID_REQUEST");
	}
	const normalizedContentType = contentType.toLowerCase();
	if (
		!normalizedContentType.startsWith("multipart/form-data") &&
		!normalizedContentType.startsWith("application/x-www-form-urlencoded")
	) {
		return throwAppError(400, "INVALID_REQUEST");
	}

	const bytes = await readRequestBytes(request, maximumBytes);
	const boundedRequest = new Request("http://localhost/internal-form", {
		method: "POST",
		headers: { "content-type": contentType },
		body: bytes,
	});
	try {
		return await boundedRequest.formData();
	} catch {
		return throwAppError(400, "INVALID_REQUEST");
	}
};
