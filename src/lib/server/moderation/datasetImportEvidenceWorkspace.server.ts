import { fail, redirect, type RequestEvent } from "@sveltejs/kit";
import { throwAppError } from "$lib/server/errors/appError.server";
import {
	applyDatasetImportEvidence,
	DatasetImportEvidenceError,
	previewDatasetImportEvidence,
	readDatasetImportEvidenceWorkspace,
} from "$lib/server/moderation/datasetImportEvidence.server";
import { requireModeratorPermission } from "$lib/server/moderation/moderationAccess.server";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";
import type { DatasetImportEvidenceActionData } from "$lib/utils/moderation/datasetImportEvidence";

const DATASET_EVIDENCE_ROUTE =
	"/profile/privileged-tools/data-operations/datasets";
const DATASET_EVIDENCE_FORM_MAX_BYTES = 16 * 1024;
const DATASET_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,99}$/u;
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

type DatasetEvidenceLoadEvent = Pick<RequestEvent, "locals" | "params">;
type DatasetEvidenceActionEvent = Pick<
	RequestEvent,
	"locals" | "params" | "request"
>;

const getRoute = (datasetKey: string) =>
	`${DATASET_EVIDENCE_ROUTE}/${encodeURIComponent(datasetKey)}`;

const getDatasetKey = (params: Record<string, string | undefined>) => {
	const datasetKey = params.datasetKey ?? "";
	if (!DATASET_KEY_PATTERN.test(datasetKey)) return null;
	return datasetKey;
};

const getErrorMessage = (error: unknown) => {
	if (!(error instanceof DatasetImportEvidenceError)) {
		return "Dataset import evidence could not be checked right now.";
	}
	switch (error.reason) {
		case "not_found":
			return "This dataset release could not be found.";
		case "not_authorized":
			return "Your current role or identity-verification level cannot change dataset evidence.";
		case "invalid_evidence":
			return "The evidence does not match this dataset release. Check the release, UTC completion time, SHA-256, and HTTPS reference.";
		case "no_change":
			return "This preview does not supply every missing artifact, so there is nothing complete to apply.";
		case "already_complete":
			return "This dataset evidence is already complete. Refresh the Data operations queue before continuing.";
		case "stale_preview":
			return "The dataset changed or this preview expired. Review the current evidence and create a new preview.";
		case "failed_recheck":
			return "The evidence did not clear the owning health check, so no changes were saved.";
		default:
			return "Dataset import evidence could not be checked right now.";
	}
};

const parseUtcDateTime = (value: string) => {
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(value)) return null;
	const parsed = new Date(`${value}:00.000Z`);
	return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export const loadDatasetImportEvidenceWorkspace = async ({
	locals,
	params,
}: DatasetEvidenceLoadEvent) => {
	const datasetKey = getDatasetKey(params);
	if (!datasetKey) {
		return throwAppError(404, "RESOURCE_NOT_FOUND");
	}
	const { role } = await requireModeratorPermission(
		locals,
		"data_operations.catalog_health.repair",
		getRoute(datasetKey),
	);
	return {
		viewerRole: role,
		workspace: await readDatasetImportEvidenceWorkspace(
			locals.supabase,
			datasetKey,
		),
	};
};

export const previewDatasetImportEvidenceAction = async ({
	locals,
	params,
	request,
}: DatasetEvidenceActionEvent): Promise<
	DatasetImportEvidenceActionData | ReturnType<typeof fail>
> => {
	const datasetKey = getDatasetKey(params);
	if (!datasetKey) {
		return fail(404, {
			datasetImportEvidenceError: "This dataset release could not be found.",
		});
	}
	await requireModeratorPermission(
		locals,
		"data_operations.catalog_health.repair",
		getRoute(datasetKey),
	);
	const formData = await readLimitedFormData(
		request,
		DATASET_EVIDENCE_FORM_MAX_BYTES,
	);
	const releaseVersion = String(formData.get("releaseVersion") ?? "").trim();
	const importedAtValue = String(formData.get("importedAt") ?? "").trim();
	const sourceFileSha256 = String(formData.get("sourceFileSha256") ?? "")
		.trim()
		.toLocaleLowerCase();
	const evidenceReference = String(
		formData.get("evidenceReference") ?? "",
	).trim();
	const values = {
		releaseVersion,
		importedAt: importedAtValue,
		sourceFileSha256,
		evidenceReference,
	};
	const importedAt = importedAtValue ? parseUtcDateTime(importedAtValue) : null;

	if (
		!releaseVersion ||
		releaseVersion.length > 100 ||
		(importedAtValue.length > 0 && importedAt === null) ||
		(sourceFileSha256.length > 0 && !SHA256_PATTERN.test(sourceFileSha256)) ||
		!evidenceReference.startsWith("https://") ||
		evidenceReference.length > 500
	) {
		return fail(400, {
			datasetImportEvidenceError:
				"Enter the exact release, a valid UTC completion time, a 64-character SHA-256, and an HTTPS evidence reference.",
			datasetImportEvidenceValues: values,
		});
	}

	try {
		const preview = await previewDatasetImportEvidence(locals.supabase, {
			datasetKey,
			releaseVersion,
			importedAt,
			sourceFileSha256: sourceFileSha256 || null,
			evidenceReference,
		});
		return {
			datasetImportEvidencePreview: preview,
			datasetImportEvidenceValues: values,
			...(preview.outcome === "no_change"
				? {
						datasetImportEvidenceError:
							"The preview is incomplete. Supply every artifact still marked Missing before applying.",
					}
				: preview.outcome === "already_complete"
					? {
							datasetImportEvidenceError:
								"The stored import time and checksum are already complete. Return to Data operations and refresh the queue.",
						}
					: {}),
		};
	} catch (error) {
		return fail(
			error instanceof DatasetImportEvidenceError &&
				(error.reason === "not_found" || error.reason === "already_complete")
				? 409
				: 400,
			{
				datasetImportEvidenceError: getErrorMessage(error),
				datasetImportEvidenceValues: values,
			},
		);
	}
};

export const applyDatasetImportEvidenceAction = async ({
	locals,
	params,
	request,
}: DatasetEvidenceActionEvent) => {
	const datasetKey = getDatasetKey(params);
	if (!datasetKey) {
		return fail(404, {
			datasetImportEvidenceError: "This dataset release could not be found.",
		});
	}
	await requireModeratorPermission(
		locals,
		"data_operations.catalog_health.repair",
		getRoute(datasetKey),
	);
	const formData = await readLimitedFormData(
		request,
		DATASET_EVIDENCE_FORM_MAX_BYTES,
	);
	const previewId = String(formData.get("previewId") ?? "").trim();
	const reviewNote = String(formData.get("reviewNote") ?? "").trim();
	if (
		!UUID_PATTERN.test(previewId) ||
		reviewNote.length < 10 ||
		reviewNote.length > 2000
	) {
		return fail(400, {
			datasetImportEvidenceError:
				"Add a private review note of at least 10 characters before applying this preview.",
		});
	}

	try {
		const result = await applyDatasetImportEvidence(
			locals.supabase,
			previewId,
			reviewNote,
		);
		if (result.datasetKey !== datasetKey || !result.findingCleared) {
			return fail(409, {
				datasetImportEvidenceError:
					"The evidence did not clear the owning health check, so the queue was not marked complete.",
			});
		}
	} catch (error) {
		return fail(
			error instanceof DatasetImportEvidenceError &&
				(error.reason === "stale_preview" ||
					error.reason === "already_complete")
				? 409
				: 400,
			{ datasetImportEvidenceError: getErrorMessage(error) },
		);
	}

	redirect(
		303,
		"/profile/privileged-tools/data-operations?datasetEvidence=recorded",
	);
};

export type DatasetImportEvidenceWorkspaceData = Awaited<
	ReturnType<typeof loadDatasetImportEvidenceWorkspace>
>;
