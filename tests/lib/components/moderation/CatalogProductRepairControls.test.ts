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
});
