import {
	recordProductSourceCacheHit,
	type ProductSourceRequestTrace,
} from "$lib/server/products/sourceMetrics.server";

const inFlightRequests = new Map<string, Promise<unknown>>();

export const coalesceProductApiRequest = async <T>(
	requestKey: string,
	request: () => Promise<T>,
	trace?: ProductSourceRequestTrace,
): Promise<T> => {
	const existingRequest = inFlightRequests.get(requestKey) as Promise<T> | undefined;
	if (existingRequest) {
		recordProductSourceCacheHit(trace);
		return existingRequest;
	}

	const pendingRequest = request();
	inFlightRequests.set(requestKey, pendingRequest);

	try {
		return await pendingRequest;
	} finally {
		if (inFlightRequests.get(requestKey) === pendingRequest) {
			inFlightRequests.delete(requestKey);
		}
	}
};
