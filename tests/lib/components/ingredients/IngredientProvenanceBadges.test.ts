import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import IngredientProvenanceBadges from "$lib/components/ingredients/provenance/IngredientProvenanceBadges/IngredientProvenanceBadges.svelte";
import { ingredientProvenanceOptionsFixture } from "../../../fixtures/referenceCatalogs";

describe("IngredientProvenanceBadges", () => {
	it("shows evidence-backed verification without exposing provider hierarchy", () => {
		render(IngredientProvenanceBadges, {
			props: {
				food: {
					fdcId: 1,
					description: "Test food",
					dataType: "Foundation",
					foodNutrients: [],
					sourceKey: "usda",
					trustStatus: "source-verified",
				},
				provenanceOptions: ingredientProvenanceOptionsFixture,
			},
		});

		expect(screen.queryByLabelText("Source: USDA")).not.toBeInTheDocument();
		const verified = screen.getByRole("img", {
			name: "Verification status: Verified",
		});
		expect(verified).toHaveClass("verified-status-badge");
		expect(verified).toHaveClass("status-icon-badge");
		expect(verified.querySelector("svg")).toBeInTheDocument();
		expect(verified).not.toHaveTextContent("Verified");
	});

	it("hides private and unverified metadata from compact cards", () => {
		render(IngredientProvenanceBadges, {
			props: {
				food: {
					fdcId: 2,
					description: "Private food",
					foodNutrients: [],
					sourceKey: "custom",
					trustStatus: "user-private",
				},
				provenanceOptions: ingredientProvenanceOptionsFixture,
			},
		});

		expect(screen.queryByLabelText("Verification status: Private"))
			.not.toBeInTheDocument();
		expect(screen.queryByLabelText("Verification status: Verified"))
			.not.toBeInTheDocument();
	});

	it("shows pending review as an actionable status", () => {
		render(IngredientProvenanceBadges, {
			props: {
				food: {
					fdcId: 3,
					description: "Pending food",
					foodNutrients: [],
					trustStatus: "pending-review",
				},
				provenanceOptions: ingredientProvenanceOptionsFixture,
			},
		});

		expect(screen.getByLabelText("Verification status: Pending"))
			.toHaveTextContent("Pending");
	});

	it("hides resolved verification in compact cards", () => {
		render(IngredientProvenanceBadges, {
			props: {
				food: {
					fdcId: 4,
					description: "Verified compact food",
					foodNutrients: [],
					trustStatus: "source-verified",
				},
				provenanceOptions: ingredientProvenanceOptionsFixture,
				variant: "saved-card",
			},
		});

		expect(screen.queryByLabelText("Verification status: Verified"))
			.not.toBeInTheDocument();
	});

	it("keeps unresolved statuses visible in compact cards", () => {
		render(IngredientProvenanceBadges, {
			props: {
				food: {
					fdcId: 5,
					description: "Pending compact food",
					foodNutrients: [],
					trustStatus: "pending-review",
				},
				provenanceOptions: ingredientProvenanceOptionsFixture,
				variant: "saved-card",
			},
		});

		expect(screen.getByLabelText("Verification status: Pending"))
			.toBeInTheDocument();
	});

	it("shows resolved verification in search results", () => {
		render(IngredientProvenanceBadges, {
			props: {
				food: {
					fdcId: 6,
					description: "Verified search food",
					foodNutrients: [],
					trustStatus: "source-verified",
				},
				provenanceOptions: ingredientProvenanceOptionsFixture,
				variant: "search-card",
			},
		});

		expect(screen.getByLabelText("Verification status: Verified"))
			.toBeInTheDocument();
	});
});
