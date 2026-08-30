type AbortableDatabaseQuery<Query> = {
	abortSignal: (signal: AbortSignal) => Query;
};

export const applyDatabaseQueryAbortSignal = <
	Query extends AbortableDatabaseQuery<Query>,
>(
	query: Query,
	signal?: AbortSignal,
): Query => (signal ? query.abortSignal(signal) : query);
