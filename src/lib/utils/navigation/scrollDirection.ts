export type ScrollDirection = "up" | "down";

export type ScrollDirectionTrackerOptions = {
	hideDistance?: number;
	revealDistance?: number;
	topBoundary?: number;
};

const DEFAULT_HIDE_DISTANCE = 24;
const DEFAULT_REVEAL_DISTANCE = 12;
const DEFAULT_TOP_BOUNDARY = 4;

const normalizeScrollTop = (value: number) =>
	Number.isFinite(value) ? Math.max(0, value) : 0;

export const createScrollDirectionTracker = ({
	hideDistance = DEFAULT_HIDE_DISTANCE,
	revealDistance = DEFAULT_REVEAL_DISTANCE,
	topBoundary = DEFAULT_TOP_BOUNDARY,
}: ScrollDirectionTrackerOptions = {}) => {
	let previousScrollTop = 0;
	let directionAnchor = 0;
	let currentDirection: ScrollDirection | null = null;
	let reportedDirection: ScrollDirection = "up";

	const reset = (scrollTop = 0) => {
		const nextScrollTop = normalizeScrollTop(scrollTop);
		previousScrollTop = nextScrollTop;
		directionAnchor = nextScrollTop;
		currentDirection = null;
		reportedDirection = "up";
	};

	const update = (scrollTop: number): ScrollDirection | null => {
		const nextScrollTop = normalizeScrollTop(scrollTop);

		if (nextScrollTop <= topBoundary) {
			previousScrollTop = nextScrollTop;
			directionAnchor = nextScrollTop;
			currentDirection = null;
			if (reportedDirection === "up") return null;
			reportedDirection = "up";
			return "up";
		}

		if (nextScrollTop === previousScrollTop) return null;

		const nextDirection: ScrollDirection =
			nextScrollTop > previousScrollTop ? "down" : "up";

		if (nextDirection !== currentDirection) {
			currentDirection = nextDirection;
			directionAnchor = previousScrollTop;
		}

		previousScrollTop = nextScrollTop;
		const threshold =
			nextDirection === "down" ? hideDistance : revealDistance;

		if (
			Math.abs(nextScrollTop - directionAnchor) < threshold ||
			reportedDirection === nextDirection
		) {
			return null;
		}

		reportedDirection = nextDirection;
		directionAnchor = nextScrollTop;
		return nextDirection;
	};

	return { reset, update };
};
