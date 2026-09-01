import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { ProductReferenceCatalog } from "$lib/utils/food/reference/productReferenceCatalog";

const addSourceKey = (sourceKeys: Set<string>, sourceKey?: string) => {
	const normalizedSourceKey = sourceKey?.trim();
	if (normalizedSourceKey) sourceKeys.add(normalizedSourceKey);
};

export const barcodeDraftUsesOnlyCanonicalSources = (
	draft: BarcodeProductDraft,
	productReferenceCatalog: ProductReferenceCatalog,
) => {
	if (draft.source === "shared-catalog") return true;

	const sourceKeys = new Set<string>();
	addSourceKey(sourceKeys, draft.sourceKey ?? draft.source);
	for (const [field, provenance] of Object.entries(
		draft.fieldProvenance ?? {},
	)) {
		if (field !== "image") addSourceKey(sourceKeys, provenance?.source);
	}
	for (const nutrient of draft.nutrients ?? []) {
		addSourceKey(sourceKeys, nutrient.source);
	}
	for (const fact of draft.nutrientQualitativeFacts ?? []) {
		addSourceKey(sourceKeys, fact.source);
	}
	addSourceKey(sourceKeys, draft.serving?.source);

	return (
		sourceKeys.size > 0 &&
		[...sourceKeys].every((sourceKey) => {
			const source = productReferenceCatalog.sources[sourceKey];
			return Boolean(
				source?.canonicalStorageAllowed && source.canonicalLicenseName,
			);
		})
	);
};
