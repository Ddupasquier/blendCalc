export const normalizeCustomFoodName = (name: string) => {
	return name.trim().replace(/\s+/g, " ").toLowerCase();
};
