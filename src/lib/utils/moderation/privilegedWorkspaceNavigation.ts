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
	window.history.replaceState(window.history.state, "", `#${targetId}`);
	target.scrollIntoView({ block: "start" });
	target.focus({ preventScroll: true });
};
