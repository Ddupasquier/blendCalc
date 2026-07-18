import { getRequestEvent } from "$app/server";

export type ServerWaitUntil = (promise: Promise<unknown>) => void;

const getPlatformWaitUntil = (): ServerWaitUntil | null => {
	try {
		const context = getRequestEvent().platform?.context;
		return context?.waitUntil?.bind(context) ?? null;
	} catch {
		return null;
	}
};

export const completeServerBackgroundTask = async (
	task: Promise<unknown>,
	waitUntil: ServerWaitUntil | null = getPlatformWaitUntil(),
) => {
	if (waitUntil) {
		waitUntil(task);
		return;
	}

	await task;
};
