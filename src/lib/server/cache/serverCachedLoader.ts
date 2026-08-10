type ServerCachedLoaderOptions<Value> = {
	load: () => Promise<Value>;
	ttlMilliseconds?: number;
	now?: () => number;
};

export const createServerCachedLoader = <Value>({
	load,
	ttlMilliseconds = Number.POSITIVE_INFINITY,
	now = Date.now,
}: ServerCachedLoaderOptions<Value>) => {
	let cachedValue: Value;
	let hasCachedValue = false;
	let cacheExpiresAt = 0;
	let pendingValue: Promise<Value> | null = null;

	return async () => {
		if (hasCachedValue && cacheExpiresAt > now()) return cachedValue;
		if (pendingValue) return pendingValue;

		pendingValue = load()
			.then((value) => {
				cachedValue = value;
				hasCachedValue = true;
				cacheExpiresAt = now() + ttlMilliseconds;
				return value;
			})
			.finally(() => {
				pendingValue = null;
			});

		return pendingValue;
	};
};
