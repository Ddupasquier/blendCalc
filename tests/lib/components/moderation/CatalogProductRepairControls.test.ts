import { render, screen, within } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import CatalogProductRepairControls from "$lib/components/moderation/CatalogProductRepairControls/CatalogProductRepairControls.svelte";
import { catalogHealthRepairDryRunFixture } from "../../../fixtures/catalogHealthRepair";
import { catalogProductReadinessPassportFixture } from "../../../fixtures/catalogProductReadinessPassport";

describe("CatalogProductRepairControls", () => {
	it("offers a safety check without presenting automatic work as human review", () => {
		render(CatalogProductRepairControls, {
			props: { issues: catalogProductReadinessPassportFixture.issues },
		});

		expect(screen.getByText("Safe catalog repairs")).toBeInTheDocument();
		expect(
			screen.getByText(
				/never guess, invent changes, or replace current product values/u,
			),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Check repair" }),
		).toBeInTheDocument();
		expect(
			screen.getByText(/preview changes no stored data/u),
		).toBeInTheDocument();
		expect(screen.getByText("What this check examines:")).toBeInTheDocument();
		expect(
			screen.getByText(/same product, canonical nutrient/u),
		).toBeInTheDocument();
		expect(screen.queryByText(/reviewed dry run/u)).not.toBeInTheDocument();
	});

	it("explains a dry run and carries its identifier into the apply action", () => {
		render(CatalogProductRepairControls, {
			props: {
				issues: catalogProductReadinessPassportFixture.issues,
				form: {
					catalogRepairOccurrenceKey:
						catalogProductReadinessPassportFixture.issues[0].occurrenceKey,
					catalogRepairResult: catalogHealthRepairDryRunFixture,
				},
			},
		});

		expect(screen.getByText("Exact evidence found")).toBeInTheDocument();
		expect(screen.getAllByText("Nutrition value")).toHaveLength(2);
		expect(
			screen.getByText(/still need stronger evidence/u),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Unresolved items stay unchanged/u),
		).toBeInTheDocument();
		const applyButton = screen.getByRole("button", {
			name: "Apply safe repair",
		});
		const applyForm = applyButton.closest("form");
		expect(applyForm).not.toBeNull();
		expect(
			within(applyForm as HTMLFormElement).getByDisplayValue(
				catalogHealthRepairDryRunFixture.runId,
			),
		).toHaveAttribute("name", "dryRunId");
	});

	it("ends a zero-result check instead of sending the operator through a retry loop", () => {
		const issue = catalogProductReadinessPassportFixture.issues[0];
		render(CatalogProductRepairControls, {
			props: {
				issues: [issue],
				form: {
					catalogRepairOccurrenceKey: issue.occurrenceKey,
					catalogRepairResult: {
						...catalogHealthRepairDryRunFixture,
						candidateCount: 0,
						unresolvedCount: 1,
						items: [
							{
								itemKey: "sourceMetadata",
								result: "unresolved",
								reasonCode: "canonical_value_missing",
							},
						],
					},
				},
			},
		});

		expect(screen.getByText("No safe changes found")).toBeInTheDocument();
		expect(
			screen.getByText("You are done with this repair check."),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Check again" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Go to final review" }),
		).toHaveAttribute("href", "#finish-publication-review");
	});

	it("routes an inconclusive history check to the nonpublication evidence outcome", () => {
		const issue = {
			...catalogProductReadinessPassportFixture.issues[0],
			issueCode: "CATALOG_REVISION_EXPLANATION_MISSING",
			automatedRepairKey: "restore_revision_changes_from_summary",
			parameters: { revisionNumber: 4 },
			workCategory: "catalog_diagnostic" as const,
			impact: "does_not_block_publication" as const,
		};
		render(CatalogProductRepairControls, {
			props: {
				issues: [issue],
				form: {
					catalogRepairOccurrenceKey: issue.occurrenceKey,
					catalogRepairResult: {
						...catalogHealthRepairDryRunFixture,
						candidateCount: 0,
						unresolvedCount: 1,
					},
				},
			},
		});

		expect(
			screen.getByText("Revision 4 needs change evidence"),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Revision 4's stored change summary/u),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Go to final review" }),
		).toHaveAttribute("href", "#finish-evidence-review");
		expect(
			screen.getByText(/current API status unchanged/u),
		).toBeInTheDocument();
	});
});
