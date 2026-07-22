export type LongPressOptions = {
	onLongPress: () => void;
	disabled?: boolean;
	durationMs?: number;
	movementTolerancePx?: number;
};

const DEFAULT_DURATION_MS = 500;
const DEFAULT_MOVEMENT_TOLERANCE_PX = 10;

export const longPress = (node: HTMLElement, initialOptions: LongPressOptions) => {
	let options = initialOptions;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let pointerId: number | null = null;
	let startX = 0;
	let startY = 0;
	let suppressClick = false;
	let suppressionTimer: ReturnType<typeof setTimeout> | null = null;

	const clearTimer = () => {
		if (timer === null) return;
		clearTimeout(timer);
		timer = null;
	};

	const clearSuppression = () => {
		if (suppressionTimer !== null) clearTimeout(suppressionTimer);
		suppressionTimer = null;
		suppressClick = false;
	};

	const cancelPendingPress = () => {
		clearTimer();
		pointerId = null;
	};

	const cancelPress = () => {
		cancelPendingPress();
		clearSuppression();
	};

	const handlePointerCancellation = () => {
		cancelPendingPress();
		if (!suppressClick) clearSuppression();
	};

	const handlePointerDown = (event: PointerEvent) => {
		if (
			options.disabled ||
			!event.isPrimary ||
			(event.pointerType === "mouse" && event.button !== 0)
		) {
			return;
		}

		cancelPress();
		pointerId = event.pointerId;
		startX = event.clientX;
		startY = event.clientY;
		timer = setTimeout(() => {
			timer = null;
			suppressClick = true;
			suppressionTimer = setTimeout(clearSuppression, 1000);
			options.onLongPress();
		}, options.durationMs ?? DEFAULT_DURATION_MS);
	};

	const handlePointerMove = (event: PointerEvent) => {
		if (event.pointerId !== pointerId || timer === null) return;
		const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
		if (distance > (options.movementTolerancePx ?? DEFAULT_MOVEMENT_TOLERANCE_PX)) {
			cancelPress();
		}
	};

	const handlePointerUp = (event: PointerEvent) => {
		if (event.pointerId !== pointerId) return;
		cancelPendingPress();
	};

	const handleClick = (event: MouseEvent) => {
		if (!suppressClick) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		clearSuppression();
	};

	const handleContextMenu = (event: MouseEvent) => {
		if (suppressClick) event.preventDefault();
	};

	node.addEventListener("pointerdown", handlePointerDown);
	node.addEventListener("pointermove", handlePointerMove);
	node.addEventListener("pointerup", handlePointerUp);
	node.addEventListener("pointercancel", handlePointerCancellation);
	node.addEventListener("pointerleave", handlePointerCancellation);
	node.addEventListener("click", handleClick, true);
	node.addEventListener("contextmenu", handleContextMenu);

	return {
		update(nextOptions: LongPressOptions) {
			options = nextOptions;
			if (options.disabled) cancelPendingPress();
		},
		destroy() {
			cancelPress();
			node.removeEventListener("pointerdown", handlePointerDown);
			node.removeEventListener("pointermove", handlePointerMove);
			node.removeEventListener("pointerup", handlePointerUp);
			node.removeEventListener("pointercancel", handlePointerCancellation);
			node.removeEventListener("pointerleave", handlePointerCancellation);
			node.removeEventListener("click", handleClick, true);
			node.removeEventListener("contextmenu", handleContextMenu);
		},
	};
};
