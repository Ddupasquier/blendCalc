const BACKDROP_TAP_MOVEMENT_TOLERANCE = 8;

type BackdropPointerStart = {
	pointerId: number;
	clientX: number;
	clientY: number;
};

export const createBackdropDismissal = ({
	canDismiss,
	onDismiss,
}: {
	canDismiss: () => boolean;
	onDismiss: () => void;
}) => {
	let pointerStart: BackdropPointerStart | null = null;
	let ignoreNextBackdropPress = false;

	const resetPointer = () => {
		pointerStart = null;
	};

	const handleWindowBlur = () => {
		ignoreNextBackdropPress = true;
		resetPointer();
	};

	const handleSheetPointerDown = () => {
		ignoreNextBackdropPress = false;
		resetPointer();
	};

	const handleBackdropPointerDown = (event: PointerEvent) => {
		resetPointer();

		if (ignoreNextBackdropPress) {
			ignoreNextBackdropPress = false;
			return;
		}

		if (
			!canDismiss() ||
			event.button !== 0 ||
			event.isPrimary === false ||
			event.target !== event.currentTarget
		) {
			return;
		}

		pointerStart = {
			pointerId: event.pointerId,
			clientX: event.clientX,
			clientY: event.clientY,
		};
	};

	const handleBackdropPointerUp = (event: PointerEvent) => {
		const start = pointerStart;
		resetPointer();

		if (
			!start ||
			!canDismiss() ||
			event.pointerId !== start.pointerId ||
			event.target !== event.currentTarget
		) {
			return;
		}

		const horizontalMovement = Math.abs(event.clientX - start.clientX);
		const verticalMovement = Math.abs(event.clientY - start.clientY);
		if (
			horizontalMovement > BACKDROP_TAP_MOVEMENT_TOLERANCE ||
			verticalMovement > BACKDROP_TAP_MOVEMENT_TOLERANCE
		) {
			return;
		}

		onDismiss();
	};

	return {
		handleBackdropPointerCancel: resetPointer,
		handleBackdropPointerDown,
		handleBackdropPointerUp,
		handleSheetPointerDown,
		handleWindowBlur,
	};
};
