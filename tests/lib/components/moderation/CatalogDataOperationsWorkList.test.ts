import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import CatalogDataOperationsWorkList from "$lib/components/moderation/CatalogDataOperationsWorkList/CatalogDataOperationsWorkList.svelte";

describe("CatalogDataOperationsWorkList", () => {
	it("shows only deduplicated operator work and its next action", () => {
		render(CatalogDataOperationsWorkList, {
			props: {
				actionCount: 1,
				actionSubjectsTruncated: false,
				actionSubjects: [
					{
						subjectType: "shared_product",
						subjectKey: "product-id",
						displayName: "Evidence-light cereal",
						context: "Example Foods",
						issueCount: 2,
						severity: "blocking",
						summary: "A required nutrient is missing.",
						resolutionAction: "submit_catalog_correction",
						destination:
							"/profile/privileged-tools/data-operations/products/product-id",
						missingPrerequisite: null,
						issues: [
							{
								code: "CATALOG_REQUIRED_NUTRIENT_MISSING",
								summary: "A required nutrient is missing: Potassium, K",
								resolutionAction: "submit_catalog_correction",
								severity: "blocking",
								parameters: { nutrientId: 1008 },
							},
							{
								code: "CATALOG_FIELD_PROVENANCE_MISSING",
								summary: "Product information lacks source evidence.",
								resolutionAction: "repair_catalog_field_provenance",
								severity: "blocking",
								parameters: { fieldKey: "ingredients" },
							},
						],
					},
				],
			},
		});

		expect(
			screen.getByRole("heading", { name: "Required work" }),
		).toBeVisible();
		expect(screen.getByText("Evidence-light cereal")).toBeVisible();
		expect(screen.getByText("2 findings")).toBeVisible();
		expect(
			screen.getByRole("link", { name: "Open product readiness" }),
		).toHaveAttribute(
			"href",
			"/profile/privileged-tools/data-operations/products/product-id",
		);
		expect(screen.queryByText("Diagnostic checks")).not.toBeInTheDocument();
	});
});
