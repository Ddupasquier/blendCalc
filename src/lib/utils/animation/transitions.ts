import { cubicOut } from "svelte/easing";
import { getMotionSafeDuration, MOTION_DURATION_MS } from "./motion";

export const MOTION_EASING_FUNCTION = Object.freeze({
	spatial: cubicOut,
});

export const getFeedbackFlyTransition = (offset = 8) => ({
	y: offset,
	duration: getMotionSafeDuration(MOTION_DURATION_MS.feedback),
	easing: MOTION_EASING_FUNCTION.spatial,
});
