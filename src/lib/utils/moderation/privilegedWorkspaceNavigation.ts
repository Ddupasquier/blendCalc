import { replaceShallowRouteHash } from "$lib/utils/navigation/shallowRouteNavigation";

export const focusPrivilegedWorkspaceTarget = (
	event: MouseEvent,
	targetId: string,
) => {
	if (
		event.defaultPrevented ||
		event.button !== 0 ||
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.altKey
	) {
		return;
	}

	const target = document.getElementById(targetId);
	if (!target) return;

	event.preventDefault();
	replaceShallowRouteHash(`#${targetId}`);
	const scrollRegion = target.closest<HTMLElement>(".view-body--scroll");
	if (scrollRegion) {
		const targetBounds = target.getBoundingClientRect();
		const scrollRegionBounds = scrollRegion.getBoundingClientRect();
		const scrollPaddingTop = Number.parseFloat(
			window.getComputedStyle(scrollRegion).scrollPaddingTop,
		);
		scrollRegion.scrollTo({
			top: Math.max(
				0,
				scrollRegion.scrollTop +
					targetBounds.top -
					scrollRegionBounds.top -
					(Number.isFinite(scrollPaddingTop) ? scrollPaddingTop : 0),
			),
		});
	} else {
		target.scrollIntoView({ block: "start" });
	}
	target.focus({ preventScroll: true });
};
