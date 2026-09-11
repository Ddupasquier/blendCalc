import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import DatasetImportEvidenceReview from "$lib/components/moderation/DatasetImportEvidenceReview/DatasetImportEvidenceReview.svelte";
import {
	datasetImportEvidencePreviewFixture,
	datasetImportEvidenceWorkspaceFixture,
} from "../../../fixtures/datasetImportEvidence";

describe("DatasetImportEvidenceReview", () => {
	it("names every missing artifact and keeps preview disabled until complete", async () => {
		render(DatasetImportEvidenceReview, {
			props: { workspace: datasetImportEvidenceWorkspaceFixture },
		});

		expect(screen.getByText("Canadian Nutrient File 2026")).toBeVisible();
		expect(screen.getByText("Evidence missing")).toBeVisible();
		expect(screen.getByText("Import completed")).toBeVisible();
		expect(screen.getByText("SHA-256")).toBeVisible();
		expect(
			screen.getByText(/does not approve a license, activate the dataset/u),
		).toBeVisible();
		const previewButton = screen.getByRole("button", {
			name: "Preview evidence",
		});
		expect(previewButton).toBeDisabled();

		await fireEvent.input(
			screen.getByLabelText("2. When did the import finish? (UTC)"),
			{ target: { value: "2026-09-10T21:30" } },
		);
		await fireEvent.input(
			screen.getByLabelText("3. What is the source file SHA-256?"),
			{
				target: {
					value:
						"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				},
			},
		);
		expect(previewButton).toBeEnabled();
	});

	it("shows the exact preview before enabling apply", async () => {
		render(DatasetImportEvidenceReview, {
			props: {
				workspace: datasetImportEvidenceWorkspaceFixture,
				form: {
					datasetImportEvidencePreview: datasetImportEvidencePreviewFixture,
					datasetImportEvidenceValues: {
						releaseVersion: "2026",
						importedAt: "2026-09-10T21:30",
						sourceFileSha256:
							"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
						evidenceReference: "https://example.test/cnf-import-log",
					},
				},
			},
		});

		expect(screen.getByText("Validated preview")).toBeVisible();
		expect(
			screen.getByText("This will complete the dataset evidence"),
		).toBeVisible();
		expect(
			screen.getByText(/will not change the release, license status/u),
		).toBeVisible();
		expect(
			screen.getByRole("link", { name: "Cancel preview and edit" }),
		).toHaveAttribute(
			"href",
			"/profile/privileged-tools/data-operations/datasets/cnf-2026",
		);

		const applyButton = screen.getByRole("button", {
			name: "Apply evidence and finish",
		});
		expect(applyButton).toBeDisabled();
		await fireEvent.input(
			screen.getByLabelText("Why is this evidence trustworthy?"),
			{ target: { value: "Verified against the retained import log." } },
		);
		expect(applyButton).toBeEnabled();
	});

	it("renders an already-complete receipt without another form", () => {
		render(DatasetImportEvidenceReview, {
			props: {
				workspace: {
					...datasetImportEvidenceWorkspaceFixture,
					actionRequired: false,
					missingEvidence: [],
					dataset: {
						...datasetImportEvidenceWorkspaceFixture.dataset,
						importedAt: "2026-09-10T21:30:00.000Z",
						sourceFileSha256:
							"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
					},
				},
			},
		});

		expect(screen.getByText("No action needed")).toBeVisible();
		expect(screen.getByText("Complete")).toBeVisible();
		expect(
			screen.queryByRole("button", { name: "Preview evidence" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Return to Data operations" }),
		).toBeVisible();
	});
});
