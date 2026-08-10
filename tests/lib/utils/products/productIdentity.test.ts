import { describe, expect, it } from "vitest";
import {
	productNamesAreUnrelated,
	productNamesDiffer,
} from "$lib/utils/products/productIdentity";

describe("product identity", () => {
	it("accepts formatting-only name differences", () => {
		expect(
			productNamesDiffer("Strawberry Jelly, Strawberry", "strawberry jelly strawberry"),
		).toBe(false);
	});

	it("treats a related product-name edit as reviewable", () => {
		expect(
			productNamesAreUnrelated(
				"Strawberry Jelly, Strawberry updated",
				"Strawberry Jelly, Strawberry",
			),
		).toBe(false);
	});

	it("blocks an unrelated name for the same barcode", () => {
		expect(
			productNamesAreUnrelated("Motor oil", "Strawberry Jelly, Strawberry"),
		).toBe(true);
	});
});
