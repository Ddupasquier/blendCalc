import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import {
	parseDatasetImportEvidenceApplyResult,
	parseDatasetImportEvidencePreview,
	parseDatasetImportEvidenceWorkspace,
	type DatasetImportEvidenceApplyResult,
	type DatasetImportEvidencePreview,
	type DatasetImportEvidenceWorkspace,
} from "$lib/utils/moderation/datasetImportEvidence";

export type DatasetImportEvidenceFailureReason =
	| "not_found"
	| "not_authorized"
	| "invalid_evidence"
	| "no_change"
	| "already_complete"
	| "stale_preview"
	| "failed_recheck"
	| "service_unavailable";

export class DatasetImportEvidenceError extends Error {
	constructor(readonly reason: DatasetImportEvidenceFailureReason) {
		super(reason);
		this.name = "DatasetImportEvidenceError";
	}
}

const classifyFailure = (error: {
	code?: string;
	message?: string;
}): DatasetImportEvidenceFailureReason => {
	if (error.code === "P0002") return "not_found";
	if (error.code === "42501") return "not_authorized";
	const message = error.message?.toLocaleLowerCase() ?? "";
	if (
		message.includes("already complete") ||
		message.includes("already been applied")
	) {
		return "already_complete";
	}
	if (
		message.includes("changed after this preview") ||
		message.includes("preview has expired")
	) {
		return "stale_preview";
	}
	if (message.includes("failed its health recheck")) return "failed_recheck";
	if (message.includes("does not contain a complete evidence change")) {
		return "no_change";
	}
	if (
		message.includes("invalid") ||
		message.includes("required") ||
		message.includes("cannot be replaced") ||
		message.includes("does not match") ||
		message.includes("outside the accepted range") ||
		message.includes("not enabled") ||
		message.includes("license review")
	) {
		return "invalid_evidence";
	}
	return "service_unavailable";
};

export const readDatasetImportEvidenceWorkspace = async (
	supabase: SupabaseClient<Database>,
	datasetKey: string,
): Promise<DatasetImportEvidenceWorkspace> => {
	const { data, error } = await supabase.rpc(
		"get_dataset_import_evidence_workspace",
		{ p_dataset_key: datasetKey },
	);
	if (error || data === null) {
		throw new DatasetImportEvidenceError(
			error ? classifyFailure(error) : "service_unavailable",
		);
	}
	try {
		return parseDatasetImportEvidenceWorkspace(data);
	} catch {
		throw new DatasetImportEvidenceError("service_unavailable");
	}
};

export const previewDatasetImportEvidence = async (
	supabase: SupabaseClient<Database>,
	request: {
		datasetKey: string;
		releaseVersion: string;
		importedAt: string | null;
		sourceFileSha256: string | null;
		evidenceReference: string;
	},
): Promise<DatasetImportEvidencePreview> => {
	const { data, error } = await supabase.rpc(
		"preview_dataset_import_evidence",
		{
			p_dataset_key: request.datasetKey,
			p_release_version: request.releaseVersion,
			// Postgres accepts null for these optional inputs. The generated RPC
			// signature cannot express nullable function arguments.
			p_imported_at: request.importedAt as string,
			p_source_file_sha256: request.sourceFileSha256 as string,
			p_evidence_reference: request.evidenceReference,
		},
	);
	if (error || data === null) {
		throw new DatasetImportEvidenceError(
			error ? classifyFailure(error) : "service_unavailable",
		);
	}
	try {
		return parseDatasetImportEvidencePreview(data);
	} catch {
		throw new DatasetImportEvidenceError("service_unavailable");
	}
};

export const applyDatasetImportEvidence = async (
	supabase: SupabaseClient<Database>,
	previewId: string,
	reviewNote: string,
): Promise<DatasetImportEvidenceApplyResult> => {
	const { data, error } = await supabase.rpc("apply_dataset_import_evidence", {
		p_preview_run_id: previewId,
		p_review_note: reviewNote,
	});
	if (error || data === null) {
		throw new DatasetImportEvidenceError(
			error ? classifyFailure(error) : "service_unavailable",
		);
	}
	try {
		return parseDatasetImportEvidenceApplyResult(data);
	} catch {
		throw new DatasetImportEvidenceError("service_unavailable");
	}
};
