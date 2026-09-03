import { createHash } from "node:crypto";

export const getProductApiCacheKey = (
	requestKind: string,
	cacheValue: unknown,
) =>
	createHash("sha256")
		.update(JSON.stringify({ kind: requestKind, value: cacheValue }))
		.digest("hex");
