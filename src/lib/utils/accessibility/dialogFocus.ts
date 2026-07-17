const FOCUSABLE_SELECTOR = [
	"a[href]",
	"button:not([disabled])",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	"[tabindex]:not([tabindex='-1'])",
].join(",");

const getFocusableElements = (container: HTMLElement) =>
	Array.from(
		container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
	).filter(
		(element) =>
			!element.closest("[hidden], [aria-hidden='true']") &&
			element.getAttribute("aria-disabled") !== "true",
	);

export const manageDialogFocus = (dialog: HTMLElement) => {
	const returnTarget =
		document.activeElement instanceof HTMLElement
			? document.activeElement
			: null;
	let cancelled = false;

	queueMicrotask(() => {
		if (cancelled || !dialog.isConnected) return;
		const [firstFocusableElement] = getFocusableElements(dialog);
		(firstFocusableElement ?? dialog).focus({ preventScroll: true });
	});

	return () => {
		cancelled = true;
		if (returnTarget?.isConnected) {
			returnTarget.focus({ preventScroll: true });
		}
	};
};

export const trapDialogFocus = (
	event: KeyboardEvent,
	dialog: HTMLElement,
) => {
	if (event.key !== "Tab" || event.defaultPrevented) return;

	const focusableElements = getFocusableElements(dialog);
	if (focusableElements.length === 0) {
		event.preventDefault();
		dialog.focus({ preventScroll: true });
		return;
	}

	const firstFocusableElement = focusableElements[0];
	const lastFocusableElement = focusableElements.at(-1) ?? firstFocusableElement;
	const activeElement = document.activeElement;
	const focusIsInsideDialog =
		activeElement instanceof Node && dialog.contains(activeElement);

	if (event.shiftKey && (!focusIsInsideDialog || activeElement === firstFocusableElement)) {
		event.preventDefault();
		lastFocusableElement.focus({ preventScroll: true });
		return;
	}

	if (!event.shiftKey && (!focusIsInsideDialog || activeElement === lastFocusableElement)) {
		event.preventDefault();
		firstFocusableElement.focus({ preventScroll: true });
	}
};
