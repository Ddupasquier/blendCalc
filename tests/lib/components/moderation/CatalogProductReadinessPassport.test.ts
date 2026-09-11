import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import CatalogProductReadinessPassport from "$lib/components/moderation/CatalogProductReadinessPassport/CatalogProductReadinessPassport.svelte";
import { catalogProductReadinessPassportFixture } from "../../../fixtures/catalogProductReadinessPassport";

describe("CatalogProductReadinessPassport", () => {
	it("separates app availability from blendCalcAPI publication and keeps supporting evidence collapsed", async () => {
		render(CatalogProductReadinessPassport, {
			props: {
				passport: catalogProductReadinessPassportFixture,
				canRunRepairs: true,
			},
		});

		expect(
			screen.getByText("Roasted Onion & Garlic Pasta Sauce"),
		).toBeInTheDocument();
		expect(screen.getAllByText("Available")).toHaveLength(2);
		expect(screen.getAllByText("Withheld").length).toBeGreaterThan(0);
		expect(
			screen.getByText("What needs attention").closest("details"),
		).toHaveAttribute("open");
		expect(
			screen.getByText("Nutrition is missing source evidence"),
		).toBeInTheDocument();
		expect(
			screen.queryByText("CATALOG_NUTRIENT_PROVENANCE_MISSING"),
		).not.toBeInTheDocument();
		expect(screen.getByText("Do this now")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Go to safe repair check" }),
		).toHaveAttribute(
			"href",
			"#safe-repair-product-id-CATALOG_NUTRIENT_PROVENANCE_MISSING-nutrients",
		);
		expect(
			screen.getByText(/deliberately accepted as not publishable/u),
		).toBeInTheDocument();

		const evidenceSummary = screen
			.getByText("Evidence coverage")
			.closest("summary");
		expect(evidenceSummary?.closest("details")).not.toHaveAttribute("open");
		await fireEvent.click(evidenceSummary as HTMLElement);
		expect(
			screen.getByText("Existing nutrient records with source evidence"),
		).toBeInTheDocument();
		expect(screen.getByText("13 of 14")).toBeInTheDocument();
		expect(screen.getByText(/open-food-facts, usda-fdc/u)).toBeInTheDocument();
	});

	it("plainly identifies work that cannot be completed from the passport", () => {
		render(CatalogProductReadinessPassport, {
			props: {
				passport: {
					...catalogProductReadinessPassportFixture,
					issues: [
						{
							...catalogProductReadinessPassportFixture.issues[0],
							automatedRepairAllowed: false,
							automatedRepairKey: null,
							responsibleGroup: "catalog_review",
							resolutionAction: "create_catalog_correction",
						},
					],
				},
			},
		});

		expect(
			screen.getByText("Submit an evidence-backed catalog correction"),
		).toBeInTheDocument();
		expect(
			screen.getByText(/No in-app control exists for this action yet/u),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				/Data operations must record the final public-API outcome/u,
			),
		).toBeInTheDocument();
	});

	it("points correction findings to the available in-app workflow without contradictory copy", () => {
		render(CatalogProductReadinessPassport, {
			props: {
				passport: {
					...catalogProductReadinessPassportFixture,
					issues: [
						{
							...catalogProductReadinessPassportFixture.issues[0],
							automatedRepairAllowed: false,
							automatedRepairKey: null,
							responsibleGroup: "catalog_review",
							resolutionAction: "create_catalog_correction",
						},
					],
				},
				correctionWorkflowAvailable: true,
			},
		});

		expect(
			screen.getByText("Use the Correction workflow below."),
		).toBeVisible();
		expect(
			screen.queryByText(/No in-app control exists for this action yet/u),
		).not.toBeInTheDocument();
		expect(screen.getByText("Continue below")).toBeVisible();
	});

	it("routes catalog conflicts into the same correction workflow", () => {
		render(CatalogProductReadinessPassport, {
			props: {
				passport: {
					...catalogProductReadinessPassportFixture,
					issues: [
						{
							...catalogProductReadinessPassportFixture.issues[0],
							automatedRepairAllowed: false,
							automatedRepairKey: null,
							resolutionAction: "review_catalog_conflict",
						},
					],
				},
				correctionWorkflowAvailable: true,
			},
		});

		expect(
			screen.getByText("Use the Correction workflow below."),
		).toBeVisible();
		expect(screen.getByText("Continue below")).toBeVisible();
	});

	it("names the actual missing required nutrient", () => {
		render(CatalogProductReadinessPassport, {
			props: {
				passport: {
					...catalogProductReadinessPassportFixture,
					issues: [
						{
							...catalogProductReadinessPassportFixture.issues[0],
							issueCode: "CATALOG_NUTRITION_INCOMPLETE",
							sourceReason: "missing_required_nutrient:1092",
							parameters: { key: "1092", displayName: "Potassium, K" },
							automatedRepairAllowed: false,
							automatedRepairKey: null,
						},
					],
				},
			},
		});

		expect(
			screen.getByText("A required nutrient is missing: Potassium, K"),
		).toBeInTheDocument();
		expect(
			screen.queryByText("A required nutrient is missing: Product information"),
		).not.toBeInTheDocument();
	});

	it("explains a completed accepted-withheld review", () => {
		render(CatalogProductReadinessPassport, {
			props: {
				passport: {
					...catalogProductReadinessPassportFixture,
					issues: [],
					reviewDisposition: {
						outcome: "accepted_withheld",
						reviewNote: "The current package does not report potassium.",
						issueCount: 2,
						reviewedAt: "2026-09-10T18:00:00.000Z",
					},
				},
			},
		});

		expect(screen.getByText("Current review is complete.")).toBeInTheDocument();
		expect(
			screen.getByText(/Changed evidence automatically creates new work/u),
		).toBeInTheDocument();
		expect(
			screen.queryByText(/No current catalog-health issues/u),
		).not.toBeInTheDocument();
	});
});
