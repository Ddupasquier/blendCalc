import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	datasetImportEvidenceApplyFixture,
	datasetImportEvidencePreviewFixture,
	datasetImportEvidenceWorkspaceFixture,
} from "../../../fixtures/datasetImportEvidence";

const mocks = vi.hoisted(() => ({
	requireModeratorPermission: vi.fn(),
	readDatasetImportEvidenceWorkspace: vi.fn(),
	previewDatasetImportEvidence: vi.fn(),
	applyDatasetImportEvidence: vi.fn(),
}));

vi.mock("$lib/server/moderation/moderationAccess.server", () => ({
	requireModeratorPermission: mocks.requireModeratorPermission,
}));

vi.mock(
	"$lib/server/moderation/datasetImportEvidence.server",
	async (importOriginal) => {
		const original =
			await importOriginal<
				typeof import("$lib/server/moderation/datasetImportEvidence.server")
			>();
		return {
			...original,
			readDatasetImportEvidenceWorkspace:
				mocks.readDatasetImportEvidenceWorkspace,
			previewDatasetImportEvidence: mocks.previewDatasetImportEvidence,
			applyDatasetImportEvidence: mocks.applyDatasetImportEvidence,
		};
	},
);

import {
	applyDatasetImportEvidenceAction,
	loadDatasetImportEvidenceWorkspace,
	previewDatasetImportEvidenceAction,
} from "$lib/server/moderation/datasetImportEvidenceWorkspace.server";

const createFormRequest = (values: Record<string, string>) => {
	const formData = new FormData();
	for (const [key, value] of Object.entries(values)) formData.set(key, value);
	return new Request(
		"http://localhost/profile/privileged-tools/data-operations/datasets/cnf-2026",
		{ method: "POST", body: formData },
	);
};

describe("dataset import evidence workspace", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.requireModeratorPermission.mockResolvedValue({
			role: "admin",
			permissions: ["data_operations.catalog_health.repair"],
		});
		mocks.readDatasetImportEvidenceWorkspace.mockResolvedValue(
			datasetImportEvidenceWorkspaceFixture,
		);
	});

	it("loads the exact dataset after checking repair permission", async () => {
		const supabase = {};
		await expect(
			loadDatasetImportEvidenceWorkspace({
				locals: { supabase },
				params: { datasetKey: "cnf-2026" },
			} as never),
		).resolves.toEqual({
			viewerRole: "admin",
			workspace: datasetImportEvidenceWorkspaceFixture,
		});
		expect(mocks.requireModeratorPermission).toHaveBeenCalledWith(
			expect.anything(),
			"data_operations.catalog_health.repair",
			"/profile/privileged-tools/data-operations/datasets/cnf-2026",
		);
		expect(mocks.readDatasetImportEvidenceWorkspace).toHaveBeenCalledWith(
			supabase,
			"cnf-2026",
		);
	});

	it("normalizes UTC evidence and returns an exact preview", async () => {
		mocks.previewDatasetImportEvidence.mockResolvedValue(
			datasetImportEvidencePreviewFixture,
		);
		const supabase = {};
		await expect(
			previewDatasetImportEvidenceAction({
				locals: { supabase },
				params: { datasetKey: "cnf-2026" },
				request: createFormRequest({
					releaseVersion: "2026",
					importedAt: "2026-09-10T21:30",
					sourceFileSha256:
						"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
					evidenceReference: "https://example.test/cnf-import-log",
				}),
			} as never),
		).resolves.toMatchObject({
			datasetImportEvidencePreview: datasetImportEvidencePreviewFixture,
		});
		expect(mocks.previewDatasetImportEvidence).toHaveBeenCalledWith(supabase, {
			datasetKey: "cnf-2026",
			releaseVersion: "2026",
			importedAt: "2026-09-10T21:30:00.000Z",
			sourceFileSha256:
				"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			evidenceReference: "https://example.test/cnf-import-log",
		});
	});

	it("rejects malformed evidence before the database call", async () => {
		const result = await previewDatasetImportEvidenceAction({
			locals: { supabase: {} },
			params: { datasetKey: "cnf-2026" },
			request: createFormRequest({
				releaseVersion: "2026",
				importedAt: "not-a-date",
				sourceFileSha256: "short",
				evidenceReference: "http://not-secure.test/log",
			}),
		} as never);
		expect(result).toMatchObject({
			status: 400,
			data: {
				datasetImportEvidenceError: expect.stringContaining(
					"64-character SHA-256",
				),
			},
		});
		expect(mocks.previewDatasetImportEvidence).not.toHaveBeenCalled();
	});

	it("applies the current preview and returns to the refreshed queue", async () => {
		mocks.applyDatasetImportEvidence.mockResolvedValue(
			datasetImportEvidenceApplyFixture,
		);
		await expect(
			applyDatasetImportEvidenceAction({
				locals: { supabase: {} },
				params: { datasetKey: "cnf-2026" },
				request: createFormRequest({
					previewId: datasetImportEvidencePreviewFixture.previewId,
					reviewNote: "Verified against the retained import log.",
				}),
			} as never),
		).rejects.toMatchObject({
			status: 303,
			location:
				"/profile/privileged-tools/data-operations?datasetEvidence=recorded",
		});
	});

	it("keeps a failed health recheck on the review screen", async () => {
		mocks.applyDatasetImportEvidence.mockResolvedValue({
			...datasetImportEvidenceApplyFixture,
			findingCleared: false,
		});
		const result = await applyDatasetImportEvidenceAction({
			locals: { supabase: {} },
			params: { datasetKey: "cnf-2026" },
			request: createFormRequest({
				previewId: datasetImportEvidencePreviewFixture.previewId,
				reviewNote: "Verified against the retained import log.",
			}),
		} as never);
		expect(result).toMatchObject({
			status: 409,
			data: {
				datasetImportEvidenceError: expect.stringContaining("did not clear"),
			},
		});
	});
});
