import type { SubmitFunction } from "@sveltejs/kit";

export const createPendingSubmit = (
	setPending: (pending: boolean) => void,
): SubmitFunction => {
	let pending = false;

	return ({ cancel }) => {
		if (pending) {
			cancel();
			return;
		}

		pending = true;
		setPending(true);

		return async ({ update }) => {
			try {
				await update();
			} finally {
				pending = false;
				setPending(false);
			}
		};
	};
};
