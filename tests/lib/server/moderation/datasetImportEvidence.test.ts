import { describe, expect, it, vi } from "vitest";
import {
	applyDatasetImportEvidence,
	previewDatasetImportEvidence,
	readDatasetImportEvidenceWorkspace,
} from "$lib/server/moderation/datasetImportEvidence.server";
import {
	datasetImportEvidenceApplyFixture,
	datasetImportEvidencePreviewFixture,
	datasetImportEvidenceWorkspaceFixture,
} from "../../../fixtures/datasetImportEvidence";

describe("dataset import evidence repository", () => {
	it("loads one guarded dataset evidence workspace", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: datasetImportEvidenceWorkspaceFixture,
			error: null,
		});
		await expect(
			readDatasetImportEvidenceWorkspace({ rpc } as never, "cnf-2026"),
		).resolves.toEqual(datasetImportEvidenceWorkspaceFixture);
		expect(rpc).toHaveBeenCalledWith("get_dataset_import_evidence_workspace", {
			p_dataset_key: "cnf-2026",
		});
	});

	it("previews bounded evidence without applying it", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: datasetImportEvidencePreviewFixture,
			error: null,
		});
		await expect(
			previewDatasetImportEvidence({ rpc } as never, {
				datasetKey: "cnf-2026",
				releaseVersion: "2026",
				importedAt: "2026-09-10T21:30:00.000Z",
				sourceFileSha256:
					"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				evidenceReference: "https://example.test/cnf-import-log",
			}),
		).resolves.toEqual(datasetImportEvidencePreviewFixture);
		expect(rpc).toHaveBeenCalledWith("preview_dataset_import_evidence", {
			p_dataset_key: "cnf-2026",
			p_release_version: "2026",
			p_imported_at: "2026-09-10T21:30:00.000Z",
			p_source_file_sha256:
				"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			p_evidence_reference: "https://example.test/cnf-import-log",
		});
	});

	it("applies only a validated preview with a private note", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: datasetImportEvidenceApplyFixture,
			error: null,
		});
		await expect(
			applyDatasetImportEvidence(
				{ rpc } as never,
				datasetImportEvidencePreviewFixture.previewId,
				"Verified against the retained import log.",
			),
		).resolves.toEqual(datasetImportEvidenceApplyFixture);
		expect(rpc).toHaveBeenCalledWith("apply_dataset_import_evidence", {
			p_preview_run_id: datasetImportEvidencePreviewFixture.previewId,
			p_review_note: "Verified against the retained import log.",
		});
	});

	it.each([
		[
			"stale preview",
			"The dataset changed after this preview. Preview the current evidence again.",
			"stale_preview",
		],
		[
			"already complete",
			"This evidence preview has already been applied.",
			"already_complete",
		],
		[
			"failed recheck",
			"The dataset evidence failed its health recheck; no changes were saved.",
			"failed_recheck",
		],
	])(
		"classifies %s without leaking database errors",
		async (_label, message, reason) => {
			await expect(
				applyDatasetImportEvidence(
					{
						rpc: vi.fn().mockResolvedValue({
							data: null,
							error: { message },
						}),
					} as never,
					datasetImportEvidencePreviewFixture.previewId,
					"Verified against the retained import log.",
				),
			).rejects.toMatchObject({ reason });
		},
	);
});
