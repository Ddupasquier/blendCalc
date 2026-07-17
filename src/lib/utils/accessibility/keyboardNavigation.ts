const FORWARD_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const BACKWARD_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

export const getLinearNavigationIndex = (
	key: string,
	currentIndex: number,
	itemCount: number,
) => {
	if (itemCount <= 0) return null;
	if (key === "Home") return 0;
	if (key === "End") return itemCount - 1;
	if (FORWARD_KEYS.has(key)) return (currentIndex + 1) % itemCount;
	if (BACKWARD_KEYS.has(key)) {
		return (currentIndex - 1 + itemCount) % itemCount;
	}
	return null;
};
