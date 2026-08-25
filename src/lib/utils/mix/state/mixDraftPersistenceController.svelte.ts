type MixDraftPersistenceControllerOptions<Draft> = {
	persistDraft: (draft: Draft) => Promise<boolean>;
};

export const createMixDraftPersistenceController = <Draft>({
	persistDraft,
}: MixDraftPersistenceControllerOptions<Draft>) => {
	const state = $state({
		busy: false,
		error: "",
	});
	let queuedSave: Promise<boolean> = Promise.resolve(true);
	let pendingSaveCount = 0;
	let latestRequestId = 0;

	const save = (draft: Draft) => {
		const requestId = ++latestRequestId;
		pendingSaveCount += 1;
		state.busy = true;
		state.error = "";

		const saveRequest = queuedSave.then(() => persistDraft(draft));
		queuedSave = saveRequest.catch(() => false);

		const completedRequest = saveRequest
			.then((saved) => {
				if (requestId === latestRequestId) {
					state.error = saved
						? ""
						: "Your latest Mix changes could not be saved. Check your connection and try again.";
				}
				return saved;
			})
			.catch(() => {
				if (requestId === latestRequestId) {
					state.error =
						"Your latest Mix changes could not be saved. Check your connection and try again.";
				}
				return false;
			})
			.finally(() => {
				pendingSaveCount -= 1;
				state.busy = pendingSaveCount > 0;
			});

		return completedRequest;
	};

	return { state, save };
};

export type MixDraftPersistenceController<Draft> = ReturnType<
	typeof createMixDraftPersistenceController<Draft>
>;
