import { describe, expect, it } from "vitest";
import {
	getCatalogFieldReviewState,
	getCatalogFieldVerificationMethod,
} from "$lib/utils/products/catalogFieldProvenance";

describe("catalog field provenance vocabulary", () => {
	it("maps stored methods to a small user-safe vocabulary", () => {
		expect(
			getCatalogFieldVerificationMethod("exact-barcode", "imported"),
		).toBe("exact-barcode");
		expect(
			getCatalogFieldVerificationMethod("label-review", "user-reported"),
		).toBe("package-label");
		expect(
			getCatalogFieldVerificationMethod("cross-source", "corroborated"),
		).toBe("corroborated-sources");
	});

	it("uses moderator wording only for explicitly moderator-reviewed evidence", () => {
		expect(
			getCatalogFieldVerificationMethod(
				"label-review",
				"moderator-reviewed",
			),
		).toBe("moderator-reviewed");
		expect(getCatalogFieldReviewState("moderator-reviewed")).toBe(
			"moderator-reviewed",
		);
		expect(getCatalogFieldReviewState("source-verified")).toBe("accepted");
	});

	it("keeps unknown methods unknown", () => {
		expect(
			getCatalogFieldVerificationMethod("future-unreviewed-method", "unknown"),
		).toBeNull();
	});
});
