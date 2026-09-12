export const PRODUCT_EVIDENCE_ROLES = [
	"front",
	"nutrition",
	"barcode",
] as const;

export type ProductEvidenceRole = (typeof PRODUCT_EVIDENCE_ROLES)[number];

const CORRECTION_FIELD_EVIDENCE_ROLES: Record<
	string,
	readonly ProductEvidenceRole[]
> = {
	productName: ["front"],
	brandOwner: ["front"],
	category: ["front"],
	servingWeightGrams: ["nutrition"],
	householdServing: ["nutrition"],
	ingredients: ["nutrition"],
	allergens: ["nutrition"],
	traces: ["nutrition"],
	barcode: ["barcode"],
	gtinUpc: ["barcode"],
};

export const getCatalogCorrectionEvidenceRoles = (
	fieldPaths: readonly string[],
): ProductEvidenceRole[] => {
	if (fieldPaths.length === 0) return [...PRODUCT_EVIDENCE_ROLES];

	return [
		...new Set(
			fieldPaths.flatMap((fieldPath) =>
				fieldPath.startsWith("nutrient:")
					? ["nutrition" as const]
					: (CORRECTION_FIELD_EVIDENCE_ROLES[fieldPath] ??
						PRODUCT_EVIDENCE_ROLES),
			),
		),
	];
};

export const parseCatalogCorrectionEvidenceRoles = (
	value: string | null | undefined,
): ProductEvidenceRole[] | undefined => {
	if (!value) return undefined;
	if (value === "none") return [];
	const requested = value.split(",").map((role) => role.trim());
	const roles = PRODUCT_EVIDENCE_ROLES.filter((role) =>
		requested.includes(role),
	);
	return roles.length > 0 ? roles : undefined;
};

export const getTrustedSourceEvidencePolicy = ({
	hasExactSourceMatch,
	hasSourceChanges,
}: {
	hasExactSourceMatch: boolean;
	hasSourceChanges: boolean;
}) => {
	const requiresCatalogEvidence = !hasExactSourceMatch || hasSourceChanges;
	return {
		defaultSharingAllowed: hasExactSourceMatch && !hasSourceChanges,
		requiresCatalogEvidence,
	};
};

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
