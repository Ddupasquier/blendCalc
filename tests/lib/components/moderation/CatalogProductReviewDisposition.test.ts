import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import CatalogProductReviewDisposition from "$lib/components/moderation/CatalogProductReviewDisposition/CatalogProductReviewDisposition.svelte";
import { catalogProductReadinessPassportFixture } from "../../../fixtures/catalogProductReadinessPassport";

describe("CatalogProductReviewDisposition", () => {
	it("states every consequence before enabling the terminal action", async () => {
		render(CatalogProductReviewDisposition, {
			props: {
				passport: catalogProductReadinessPassportFixture,
				canFinishReview: true,
			},
		});

		expect(screen.getByText("Finish this product review")).toBeInTheDocument();
		expect(
			screen.getByText("The product stays available in blendCalc."),
		).toBeInTheDocument();
		expect(
			screen.getByText("It stays withheld from public blendCalcAPI v1."),
		).toBeInTheDocument();
		expect(
			screen.getByText("These current readiness items leave the work queue."),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"New or changed evidence automatically reopens the review.",
			),
		).toBeInTheDocument();
		expect(screen.getByText("1 check remains")).toBeInTheDocument();

		const button = screen.getByRole("button", {
			name: "Finish review — keep out of public API",
		});
		expect(button).toBeDisabled();

		await fireEvent.input(
			screen.getByLabelText("Why can this product not be published yet?"),
			{ target: { value: "No approved source contains the missing value." } },
		);
		expect(button).toBeDisabled();
	});

	it("unlocks after all safe checks are inconclusive and keeps a note required", async () => {
		render(CatalogProductReviewDisposition, {
			props: {
				passport: {
					...catalogProductReadinessPassportFixture,
					reviewCompletion: {
						requiredSafeRepairCheckCount: 1,
						completedSafeRepairCheckCount: 1,
						canFinish: true,
					},
				},
				canFinishReview: true,
			},
		});

		const button = screen.getByRole("button", {
			name: "Finish review — keep out of public API",
		});
		expect(button).toBeDisabled();
		await fireEvent.input(
			screen.getByLabelText("Why can this product not be published yet?"),
			{ target: { value: "No approved source contains the missing value." } },
		);
		expect(button).toBeEnabled();
	});

	it("shows the durable completed outcome instead of another action", () => {
		render(CatalogProductReviewDisposition, {
			props: {
				passport: {
					...catalogProductReadinessPassportFixture,
					issues: [],
					reviewDisposition: {
						outcome: "accepted_withheld",
						reviewNote: "The current label does not report potassium.",
						issueCount: 3,
						reviewedAt: "2026-09-10T18:00:00.000Z",
					},
				},
				canFinishReview: true,
			},
		});

		expect(
			screen.getByText("Review finished — kept out of the public API"),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", {
				name: "Finish review — keep out of public API",
			}),
		).not.toBeInTheDocument();
	});
});
