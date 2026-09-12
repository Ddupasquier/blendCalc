import type { CatalogCorrectionHandoff } from "$lib/server/moderation/catalogCorrectionHandoff.server";
import type { ProductEvidenceRole } from "$lib/utils/products/productEvidenceRequirements";

export type CatalogCorrectionHandoffProps = {
	handoff: CatalogCorrectionHandoff;
	returnPath: string;
	allowConflictResolution?: boolean;
	onOpenCorrection?: (evidenceRoles: ProductEvidenceRole[]) => void;
};
