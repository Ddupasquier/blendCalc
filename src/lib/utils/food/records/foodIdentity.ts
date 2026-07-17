import { cleanBarcode, normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { FdcFood } from "$lib/utils/food/types";

export const getFoodIdentityKey = (food: FdcFood) => {
	const barcode = food.barcode ?? food.gtinUpc;
	if (barcode) {
		const digits = cleanBarcode(barcode);
		if (digits) {
			return `barcode:${normalizeBarcode(digits) ?? digits.padStart(14, "0")}`;
		}
	}

	return `fdc:${food.fdcId}`;
};

export const uniqueFoodsByIdentity = (foods: FdcFood[]) => {
	const seen = new Set<string>();
	return foods.filter((food) => {
		const identityKey = getFoodIdentityKey(food);
		if (seen.has(identityKey)) return false;
		seen.add(identityKey);
		return true;
	});
};
