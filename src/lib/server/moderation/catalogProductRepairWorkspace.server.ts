import { fail, type RequestEvent } from "@sveltejs/kit";
import { readCatalogProductReadinessPassport } from "$lib/server/moderation/catalogProductReadinessPassport.server";
import {
	CatalogHealthRepairError,
	runCatalogHealthRepair,
} from "$lib/server/moderation/catalogHealthRepair.server";
import { requireModeratorPermission } from "$lib/server/moderation/moderationAccess.server";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";
import type { CatalogHealthRepairActionData } from "$lib/utils/moderation/catalogHealthRepair";

const CATALOG_PRODUCT_REPAIR_ROUTE =
	"/profile/privileged-tools/data-operations";
const CATALOG_REPAIR_FORM_MAX_BYTES = 16 * 1024;
const CATALOG_OCCURRENCE_KEY_MAX_LENGTH = 1024;
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type CatalogProductRepairLoadEvent = Pick<RequestEvent, "locals" | "params">;
type CatalogProductRepairActionEvent = Pick<
	RequestEvent,
	"locals" | "params" | "request"
>;

const getCatalogProductRepairRoute = (productId: string) =>
	`${CATALOG_PRODUCT_REPAIR_ROUTE}/products/${encodeURIComponent(productId)}`;

const getCatalogHealthRepairErrorMessage = (error: unknown) => {
	if (!(error instanceof CatalogHealthRepairError)) {
		return "The safe repair check could not be completed right now.";
	}
	if (error.reason === "issue_unavailable") {
		return "This catalog issue has already changed or closed. Refresh the product before trying again.";
	}
	if (error.reason === "dry_run_required") {
		return "Run a fresh safety check before applying this repair.";
	}
	if (error.reason === "repair_not_supported") {
		return "This issue no longer has a safe automated repair.";
	}
	return "The safe repair check could not be completed right now.";
};

export const loadCatalogProductRepairWorkspace = async ({
	locals,
	params,
}: CatalogProductRepairLoadEvent) => {
	const productId = params.productId ?? "";
	if (!productId) throw new TypeError("Catalog product ID is required.");
	const { role, permissions } = await requireModeratorPermission(
		locals,
		"data_operations.catalog_health.read",
		getCatalogProductRepairRoute(productId),
	);

	return {
		viewerRole: role,
		canRunRepairs: permissions.includes(
			"data_operations.catalog_health.repair",
		),
		passport: await readCatalogProductReadinessPassport(
			locals.supabase,
			productId,
		),
	};
};

export const runCatalogProductRepairAction = async ({
	locals,
	params,
	request,
}: CatalogProductRepairActionEvent): Promise<
	CatalogHealthRepairActionData | ReturnType<typeof fail>
> => {
	const productId = params.productId ?? "";
	if (!productId) throw new TypeError("Catalog product ID is required.");
	await requireModeratorPermission(
		locals,
		"data_operations.catalog_health.repair",
		getCatalogProductRepairRoute(productId),
	);
	const formData = await readLimitedFormData(
		request,
		CATALOG_REPAIR_FORM_MAX_BYTES,
	);
	const occurrenceKey = String(formData.get("occurrenceKey") ?? "").trim();
	const mode = String(formData.get("mode") ?? "");
	const dryRunId = String(formData.get("dryRunId") ?? "").trim();

	if (
		!occurrenceKey ||
		occurrenceKey.length > CATALOG_OCCURRENCE_KEY_MAX_LENGTH ||
		(mode !== "dry_run" && mode !== "apply") ||
		(mode === "apply" && !UUID_PATTERN.test(dryRunId)) ||
		(mode === "dry_run" && dryRunId)
	) {
		return fail(400, {
			catalogRepairOccurrenceKey: occurrenceKey,
			catalogRepairError:
				"Run a fresh safety check before applying a catalog repair.",
		});
	}

	try {
		const passport = await readCatalogProductReadinessPassport(
			locals.supabase,
			productId,
		);
		if (
			!passport.issues.some(
				(issue) =>
					issue.occurrenceKey === occurrenceKey &&
					issue.automatedRepairAllowed &&
					issue.automatedRepairKey,
			)
		) {
			return fail(409, {
				catalogRepairOccurrenceKey: occurrenceKey,
				catalogRepairError:
					"This product's repair options have changed. Refresh it before trying again.",
			});
		}
		const result = await runCatalogHealthRepair(locals.supabase, {
			occurrenceKey,
			apply: mode === "apply",
			dryRunId: mode === "apply" ? dryRunId : null,
		});
		if (result.status === "failed") {
			return fail(500, {
				catalogRepairOccurrenceKey: occurrenceKey,
				catalogRepairError:
					"The safety check stopped before making an uncertain change.",
			});
		}
		return {
			catalogRepairOccurrenceKey: occurrenceKey,
			catalogRepairResult: result,
			...(mode === "apply"
				? {
						catalogRepairSuccess:
							result.changedCount === 1
								? "One exact evidence link was repaired."
								: `${result.changedCount} exact evidence links were repaired.`,
					}
				: {}),
		};
	} catch (error) {
		return fail(500, {
			catalogRepairOccurrenceKey: occurrenceKey,
			catalogRepairError: getCatalogHealthRepairErrorMessage(error),
		});
	}
};

export type CatalogProductRepairWorkspaceData = Awaited<
	ReturnType<typeof loadCatalogProductRepairWorkspace>
>;
