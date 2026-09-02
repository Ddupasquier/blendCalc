const serverTimingNamePattern = /^[a-z][a-z0-9_-]{0,31}$/;

export const recordServerTiming = (
	locals: App.Locals,
	name: string,
	durationMilliseconds: number,
) => {
	if (!serverTimingNamePattern.test(name)) {
		throw new Error(`Invalid server timing name: ${JSON.stringify(name)}.`);
	}
	locals.serverTimings ??= {};
	locals.serverTimings[name] = Math.max(0, durationMilliseconds);
};

export const measureServerTiming = async <Result>(
	locals: App.Locals,
	name: string,
	operation: () => Promise<Result>,
): Promise<Result> => {
	const startedAt = performance.now();
	try {
		return await operation();
	} finally {
		recordServerTiming(locals, name, performance.now() - startedAt);
	}
};

export const serializeServerTimings = (
	timings: Readonly<Record<string, number>>,
) =>
	Object.entries(timings)
		.filter(
			([name, duration]) =>
				serverTimingNamePattern.test(name) && Number.isFinite(duration),
		)
		.map(
			([name, duration]) => `${name};dur=${Math.max(0, duration).toFixed(1)}`,
		)
		.join(", ");

export const appendServerTimingHeader = (
	response: Response,
	timings: Readonly<Record<string, number>>,
) => {
	const value = serializeServerTimings(timings);
	if (value) response.headers.set("server-timing", value);
	return response;
};
