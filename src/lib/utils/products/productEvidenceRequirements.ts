export const PRODUCT_EVIDENCE_ROLES = [
	"front",
	"nutrition",
	"barcode",
] as const;

export type ProductEvidenceRole = (typeof PRODUCT_EVIDENCE_ROLES)[number];

const PRODUCT_EVIDENCE_LABELS: Record<ProductEvidenceRole, string> = {
	front: "front package",
	nutrition: "nutrition label",
	barcode: "barcode",
};

export const getMissingProductEvidenceRoles = (
	evidence: Partial<Record<ProductEvidenceRole, unknown>>,
	options: { requireFront?: boolean } = {},
) =>
	PRODUCT_EVIDENCE_ROLES.filter(
		(role) =>
			(role !== "front" || options.requireFront !== false) && !evidence[role],
	);

export const describeProductEvidencePhotos = (
	roles: readonly ProductEvidenceRole[],
) => {
	const labels = roles.map((role) => PRODUCT_EVIDENCE_LABELS[role]);
	if (labels.length === 0) return "";
	if (labels.length === 1) return `${labels[0]} photo`;
	if (labels.length === 2) return `${labels[0]} and ${labels[1]} photos`;
	return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)} photos`;
};
