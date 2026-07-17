export const ACCELERATING_STEP_REPEAT_MS = 250;
export const ACCELERATING_STEP_HOLD_DELAY_MS = 1000;

const HOLD_STEP_THRESHOLDS = [
	{ elapsedMs: 4000, step: 50 },
	{ elapsedMs: 3000, step: 10 },
	{ elapsedMs: 2000, step: 5 },
	{ elapsedMs: 1000, step: 2 },
] as const;

export const getAcceleratingStep = (elapsedMs: number): number =>
	HOLD_STEP_THRESHOLDS.find(({ elapsedMs: threshold }) => elapsedMs >= threshold)
		?.step ?? 1;
