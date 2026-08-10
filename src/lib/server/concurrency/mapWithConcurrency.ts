export const mapWithConcurrency = async <Input, Output>(
	values: Input[],
	concurrency: number,
	mapper: (value: Input, index: number) => Promise<Output>,
) => {
	if (values.length === 0) return [];

	const results = new Array<Output>(values.length);
	let nextIndex = 0;
	const workerCount = Math.min(
		values.length,
		Math.max(1, Math.floor(concurrency)),
	);
	const workers = Array.from({ length: workerCount }, async () => {
		while (nextIndex < values.length) {
			const index = nextIndex;
			nextIndex += 1;
			results[index] = await mapper(values[index], index);
		}
	});

	await Promise.all(workers);
	return results;
};
