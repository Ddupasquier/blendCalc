import { UserFacingError } from "$lib/utils/errors/userFacingErrors";

export type SmartImagePlacementFailurePhase =
	| "image-load"
	| "image-prepare"
	| "worker-load"
	| "worker-configure"
	| "recognition";

export type SmartImagePlacementFailureReasonCode =
	| "photo-unavailable"
	| "photo-unreadable"
	| "canvas-unavailable"
	| "ocr-unavailable"
	| "ocr-configuration-failed"
	| "ocr-recognition-failed";

export type SmartImagePlacementDiagnostic = {
	phase: SmartImagePlacementFailurePhase | "unknown";
	reasonCode: SmartImagePlacementFailureReasonCode | "unexpected-failure";
};

export class SmartImagePlacementError extends UserFacingError {
	readonly phase: SmartImagePlacementFailurePhase;
	readonly reasonCode: SmartImagePlacementFailureReasonCode;

	constructor({
		message,
		phase,
		reasonCode,
		cause,
	}: {
		message: string;
		phase: SmartImagePlacementFailurePhase;
		reasonCode: SmartImagePlacementFailureReasonCode;
		cause?: unknown;
	}) {
		super(message, cause);
		this.name = "SmartImagePlacementError";
		this.phase = phase;
		this.reasonCode = reasonCode;
	}
}

export const readSmartImagePlacementDiagnostic = (
	error: unknown,
): SmartImagePlacementDiagnostic =>
	error instanceof SmartImagePlacementError
		? { phase: error.phase, reasonCode: error.reasonCode }
		: { phase: "unknown", reasonCode: "unexpected-failure" };
