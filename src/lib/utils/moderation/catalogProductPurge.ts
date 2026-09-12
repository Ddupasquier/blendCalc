export type CatalogProductPurgeCounts = {
	products: number;
	submissions: number;
	revisions: number;
	observations: number;
	conflicts: number;
	providerSnapshots: number;
	images: number;
	warningReports: number;
	apiCacheEntries: number;
	userListItems: number;
	customFoods: number;
	savedMixes: number;
};

export type CatalogProductPurgePreview = {
	normalizedBarcode: string;
	found: boolean;
	productName: string | null;
	brandOwner: string | null;
	counts: CatalogProductPurgeCounts;
};

export type CatalogProductPurgeResult = {
	purgeId: string;
	normalizedBarcode: string;
	deleted: true;
	counts: CatalogProductPurgeCounts;
	storageObjectsDeleted: number;
};

export type CatalogProductPurgeResponse =
	| { action: "preview"; preview: CatalogProductPurgePreview }
	| { action: "purge"; result: CatalogProductPurgeResult };

export const getCatalogProductPurgeSelectedCount = (
	counts: CatalogProductPurgeCounts,
) => Object.values(counts).reduce((total, count) => total + count, 0);
