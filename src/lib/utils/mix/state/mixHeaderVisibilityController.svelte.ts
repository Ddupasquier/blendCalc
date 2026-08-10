import { createScrollDirectionTracker } from "$lib/utils/navigation/scrollDirection";

type MixHeaderVisibilityControllerOptions = {
	isEnabled: () => boolean;
};

export const createMixHeaderVisibilityController = ({
	isEnabled,
}: MixHeaderVisibilityControllerOptions) => {
	const state = $state({ hidden: false });
	const tracker = createScrollDirectionTracker();
	let resumeFrame: number | null = null;
	let settleFrame: number | null = null;
	let layoutSettling = false;

	const cancelResume = () => {
		if (resumeFrame !== null) cancelAnimationFrame(resumeFrame);
		if (settleFrame !== null) cancelAnimationFrame(settleFrame);
		resumeFrame = null;
		settleFrame = null;
	};

	const resumeAfterLayoutSettles = (element: HTMLElement) => {
		cancelResume();
		resumeFrame = requestAnimationFrame(() => {
			settleFrame = requestAnimationFrame(() => {
				tracker.resume(element.scrollTop);
				layoutSettling = false;
				resumeFrame = null;
				settleFrame = null;
			});
		});
	};

	const handleScroll = (event: Event) => {
		if (!isEnabled()) return;
		const element = event.currentTarget as HTMLElement;
		const direction = tracker.update(element.scrollTop);
		if (direction === "down") {
			layoutSettling = true;
			tracker.pause(element.scrollTop);
			resumeAfterLayoutSettles(element);
		}
		if (direction) state.hidden = direction === "down";
	};

	const observe = (element: HTMLElement | null) => {
		if (!element || typeof ResizeObserver === "undefined") return () => {};
		const observer = new ResizeObserver(() => {
			if (layoutSettling) {
				tracker.pause(element.scrollTop);
				resumeAfterLayoutSettles(element);
				return;
			}
			tracker.rebase(element.scrollTop);
		});
		observer.observe(element);
		return () => {
			observer.disconnect();
			cancelResume();
			layoutSettling = false;
		};
	};

	return { state, handleScroll, observe };
};

export type MixHeaderVisibilityController = ReturnType<
	typeof createMixHeaderVisibilityController
>;
