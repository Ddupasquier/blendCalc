import type { ActionResult, SubmitFunction } from "@sveltejs/kit";

export const createPendingSubmit = (
	setPending: (pending: boolean) => void,
	onComplete?: (result: ActionResult) => void | Promise<void>,
): SubmitFunction => {
	let pending = false;

	return ({ cancel }) => {
		if (pending) {
			cancel();
			return;
		}

		pending = true;
		setPending(true);

		return async ({ result, update }) => {
			try {
				await update({ reset: false });
				await onComplete?.(result);
			} finally {
				pending = false;
				setPending(false);
			}
		};
	};
};
