import type {
	BlendCalcAPIV1Category,
	BlendCalcAPIV1Product,
	BlendCalcAPIV1ProductRevisionHistoryItem,
	BlendCalcAPIV1SourceAttribution,
} from "$lib/blendCalcAPI/v1/blendCalcAPITypes";
import type {
	Database as SourceDatabase,
	Json as SourceJson,
} from "$lib/types/database.types";
import type { Json as PublicationJson } from "../../../../../infrastructure/blendCalcAPI/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	readBlendCalcAPIV1Categories,
	readBlendCalcAPIV1ProductByBarcode,
	readBlendCalcAPIV1ProductRevisionHistory,
	searchBlendCalcAPIV1Products,
} from "../v1/blendCalcAPICatalog.server";
import { tokenizeIngredientSearchText } from "$lib/utils/ingredients/ingredientSearchRelevance";
import {
	getBlendCalcAPIIsolatedClient,
	type BlendCalcAPIIsolatedClient,
} from "../v1/blendCalcAPIIsolatedClient.server";
import { hashCanonicalJson } from "../v1/blendCalcAPIJson.server";

const SOURCE_PROJECT_REF = "wbqsnipoiqjzppjuawpn";
const PAGE_SIZE = 50;
const WRITE_BATCH_SIZE = 100;

type PublishedInventoryRow = {
	shared_product_id: string;
	barcode: string;
	current_revision_id: string;
	current_revision_number: number;
	catalog_updated_at: string;
};

type ProductSearchRow = {
	id: string;
	search_text: string | null;
	food: SourceJson;
};

type PublicationProduct = {
	sourceProductId: string;
	sourceRevisionId: string;
	gtin14: string;
	productName: string;
	brandOwner: string | null;
	categoryKey: string | null;
	categorySearchText: string;
	searchText: string;
	detailPayload: BlendCalcAPIV1Product;
	searchPayload: BlendCalcAPIV1Product;
	contentSha256: string;
	sourceUpdatedAt: string;
};

type PublicationRevision = {
	gtin14: string;
	sourceRevisionId: string;
	revisionNumber: number;
	publishedAt: string;
	payload: BlendCalcAPIV1ProductRevisionHistoryItem;
	contentSha256: string;
};

type PublicationCategory = {
	key: string;
	displayName: string;
	sortOrder: number;
	payload: BlendCalcAPIV1Category;
	contentSha256: string;
};

type PublicationAttribution = {
	key: string;
	payload: BlendCalcAPIV1SourceAttribution;
	contentSha256: string;
};

export type BlendCalcAPIPublicationSnapshot = {
	sourceProjectRef: string;
	sourceSnapshotAt: string;
	catalogHash: string;
	products: PublicationProduct[];
	revisions: PublicationRevision[];
	categories: PublicationCategory[];
	attributions: PublicationAttribution[];
};

export type BlendCalcAPIPublicationSyncResult = {
	action: "created" | "unchanged" | "rolled-back";
	generationId: string;
	catalogHash: string;
	counts: {
		products: number;
		revisions: number;
		categories: number;
		attributions: number;
	};
};

const toPublicationJson = (value: unknown) => value as PublicationJson;

const readAllRows = async <Row>(
	readPage: (
		from: number,
		to: number,
	) => Promise<{ data: Row[] | null; error: unknown }>,
) => {
	const rows: Row[] = [];
	for (let offset = 0; ; offset += 1000) {
		const result = await readPage(offset, offset + 999);
		if (result.error) throw result.error;
		const page = result.data ?? [];
		rows.push(...page);
		if (page.length < 1000) return rows;
	}
};

const readPublishedInventory = (source: SupabaseClient<SourceDatabase>) =>
	readAllRows<PublishedInventoryRow>(async (from, to) => {
		const result = await source
			.from("blendcalc_api_v1_published_products")
			.select(
				"shared_product_id, barcode, current_revision_id, current_revision_number, catalog_updated_at",
			)
			.order("barcode", { ascending: true })
			.range(from, to);
		return {
			data: result.data as PublishedInventoryRow[] | null,
			error: result.error,
		};
	});

const readProductSearchRows = async (
	source: SupabaseClient<SourceDatabase>,
	productIds: string[],
) => {
	const rows = new Map<string, ProductSearchRow>();
	for (let offset = 0; offset < productIds.length; offset += 100) {
		const { data, error } = await source
			.from("shared_products")
			.select("id, search_text, food")
			.in("id", productIds.slice(offset, offset + 100));
		if (error) throw error;
		for (const row of (data ?? []) as ProductSearchRow[]) rows.set(row.id, row);
	}
	return rows;
};

const readCategorySearchText = (food: SourceJson) => {
	if (!food || typeof food !== "object" || Array.isArray(food)) return "";
	const value = food as Record<string, SourceJson | undefined>;
	const arrays = [value.categories, value.sourceCategories].flatMap((entry) =>
		Array.isArray(entry)
			? entry.filter((item): item is string => typeof item === "string")
			: [],
	);
	return [value.foodCategory, value.brandedFoodCategory, ...arrays]
		.filter((entry): entry is string => typeof entry === "string")
		.join(" ")
		.toLocaleLowerCase();
};

const readAllCategories = async (source: SupabaseClient<SourceDatabase>) => {
	const categories: BlendCalcAPIV1Category[] = [];
	for (let offset = 0; ; offset += PAGE_SIZE) {
		const page = await readBlendCalcAPIV1Categories(source, {
			limit: PAGE_SIZE,
			offset,
		});
		categories.push(...page.categories);
		if (!page.pagination.hasMore) return categories;
	}
};

const readAllRevisions = async (
	source: SupabaseClient<SourceDatabase>,
	barcode: string,
) => {
	const revisions: BlendCalcAPIV1ProductRevisionHistoryItem[] = [];
	for (let offset = 0; ; offset += PAGE_SIZE) {
		const page = await readBlendCalcAPIV1ProductRevisionHistory(
			source,
			barcode,
			{ limit: PAGE_SIZE, offset },
		);
		if (!page)
			throw new Error(`Published product ${barcode} has no revision history.`);
		revisions.push(...page.revisions);
		if (!page.pagination.hasMore) return revisions;
	}
};

const attributionKey = (attribution: BlendCalcAPIV1SourceAttribution) =>
	`${attribution.source}:${attribution.dataset?.key ?? ""}`;

export const buildBlendCalcAPIPublicationSnapshot = async (
	source: SupabaseClient<SourceDatabase>,
): Promise<BlendCalcAPIPublicationSnapshot> => {
	const inventory = await readPublishedInventory(source);
	const searchRows = await readProductSearchRows(
		source,
		inventory.map((row) => row.shared_product_id),
	);
	const [categories, productEntries] = await Promise.all([
		readAllCategories(source),
		Promise.all(
			inventory.map(async (row) => {
				if (!row.current_revision_id || !row.current_revision_number) {
					throw new Error(
						`Published product ${row.barcode} has no current revision.`,
					);
				}
				const [product, revisions] = await Promise.all([
					readBlendCalcAPIV1ProductByBarcode(source, row.barcode),
					readAllRevisions(source, row.barcode),
				]);
				if (!product) {
					throw new Error(
						`Published product ${row.barcode} could not be serialized.`,
					);
				}
				const searchRow = searchRows.get(row.shared_product_id);
				if (!searchRow) {
					throw new Error(
						`Published product ${row.barcode} has no search record.`,
					);
				}
				return { row, product, revisions, searchRow };
			}),
		),
	]);

	const products = productEntries.map(
		({ row, product, searchRow }): PublicationProduct => ({
			sourceProductId: row.shared_product_id,
			sourceRevisionId: row.current_revision_id,
			gtin14: row.barcode,
			productName: product.name,
			brandOwner: product.brand,
			categoryKey: product.category?.id ?? null,
			categorySearchText: readCategorySearchText(searchRow.food),
			searchText: (searchRow.search_text ?? product.name).toLocaleLowerCase(),
			detailPayload: product,
			searchPayload: product,
			contentSha256: hashCanonicalJson(product),
			sourceUpdatedAt: row.catalog_updated_at,
		}),
	);
	const revisions = productEntries.flatMap(({ row, revisions }) =>
		revisions.map((revision): PublicationRevision => ({
			gtin14: row.barcode,
			sourceRevisionId: revision.id,
			revisionNumber: revision.number,
			publishedAt: revision.publishedAt,
			payload: revision,
			contentSha256: hashCanonicalJson(revision),
		})),
	);
	const publicationCategories = categories.map(
		(category, sortOrder): PublicationCategory => ({
			key: category.id,
			displayName: category.name,
			sortOrder,
			payload: category,
			contentSha256: hashCanonicalJson(category),
		}),
	);
	const attributionMap = new Map<string, BlendCalcAPIV1SourceAttribution>();
	for (const product of products) {
		for (const attribution of product.detailPayload.sourceAttributions) {
			attributionMap.set(attributionKey(attribution), attribution);
		}
	}
	const attributions = [...attributionMap.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, payload]): PublicationAttribution => ({
			key,
			payload,
			contentSha256: hashCanonicalJson(payload),
		}));
	const sourceSnapshotAt = products.reduce(
		(latest, product) =>
			product.sourceUpdatedAt > latest ? product.sourceUpdatedAt : latest,
		new Date(0).toISOString(),
	);
	const catalogHash = hashCanonicalJson({
		products: products.map((product) => [
			product.gtin14,
			product.contentSha256,
		]),
		revisions: revisions.map((revision) => [
			revision.gtin14,
			revision.revisionNumber,
			revision.contentSha256,
		]),
		categories: publicationCategories.map((category) => [
			category.key,
			category.contentSha256,
		]),
		attributions: attributions.map((attribution) => [
			attribution.key,
			attribution.contentSha256,
		]),
	});

	return {
		sourceProjectRef: SOURCE_PROJECT_REF,
		sourceSnapshotAt,
		catalogHash,
		products,
		revisions,
		categories: publicationCategories,
		attributions,
	};
};

const writeBatches = async <Row>(
	rows: Row[],
	write: (batch: Row[]) => PromiseLike<{ error: unknown }>,
) => {
	for (let offset = 0; offset < rows.length; offset += WRITE_BATCH_SIZE) {
		const result = await write(rows.slice(offset, offset + WRITE_BATCH_SIZE));
		if (result.error) throw result.error;
	}
};

const countsForSnapshot = (snapshot: BlendCalcAPIPublicationSnapshot) => ({
	products: snapshot.products.length,
	revisions: snapshot.revisions.length,
	categories: snapshot.categories.length,
	attributions: snapshot.attributions.length,
});

const assertMatchingRows = (
	label: string,
	expected: Array<readonly unknown[]>,
	actual: Array<readonly unknown[]>,
) => {
	if (hashCanonicalJson(actual) !== hashCanonicalJson(expected)) {
		throw new Error(
			`The isolated ${label} publication does not match its source snapshot.`,
		);
	}
};

export const verifyBlendCalcAPIPublicationGeneration = async (
	target: BlendCalcAPIIsolatedClient,
	generationId: string,
	snapshot: BlendCalcAPIPublicationSnapshot,
) => {
	const [products, revisions, categories, attributions] = await Promise.all([
		readAllRows<{
			gtin14: string;
			content_sha256: string;
			detail_payload: PublicationJson;
		}>(async (from, to) => {
			const result = await target
				.from("publication_products")
				.select("gtin14, content_sha256, detail_payload")
				.eq("generation_id", generationId)
				.order("gtin14", { ascending: true })
				.range(from, to);
			return { data: result.data, error: result.error };
		}),
		readAllRows<{
			gtin14: string;
			revision_number: number;
			content_sha256: string;
			revision_payload: PublicationJson;
		}>(async (from, to) => {
			const result = await target
				.from("publication_product_revisions")
				.select("gtin14, revision_number, content_sha256, revision_payload")
				.eq("generation_id", generationId)
				.order("gtin14", { ascending: true })
				.order("revision_number", { ascending: true })
				.range(from, to);
			return { data: result.data, error: result.error };
		}),
		readAllRows<{
			category_key: string;
			content_sha256: string;
			category_payload: PublicationJson;
		}>(async (from, to) => {
			const result = await target
				.from("publication_categories")
				.select("category_key, content_sha256, category_payload")
				.eq("generation_id", generationId)
				.order("category_key", { ascending: true })
				.range(from, to);
			return { data: result.data, error: result.error };
		}),
		readAllRows<{
			source_key: string;
			content_sha256: string;
			attribution_payload: PublicationJson;
		}>(async (from, to) => {
			const result = await target
				.from("publication_source_attributions")
				.select("source_key, content_sha256, attribution_payload")
				.eq("generation_id", generationId)
				.order("source_key", { ascending: true })
				.range(from, to);
			return { data: result.data, error: result.error };
		}),
	]);

	for (const row of products) {
		if (hashCanonicalJson(row.detail_payload) !== row.content_sha256) {
			throw new Error(
				`The isolated product ${row.gtin14} failed its content hash.`,
			);
		}
	}
	for (const row of revisions) {
		if (hashCanonicalJson(row.revision_payload) !== row.content_sha256) {
			throw new Error(
				`An isolated revision for ${row.gtin14} failed its content hash.`,
			);
		}
	}
	for (const row of categories) {
		if (hashCanonicalJson(row.category_payload) !== row.content_sha256) {
			throw new Error(
				`The isolated category ${row.category_key} failed its content hash.`,
			);
		}
	}
	for (const row of attributions) {
		if (hashCanonicalJson(row.attribution_payload) !== row.content_sha256) {
			throw new Error(
				`The isolated attribution ${row.source_key} failed its content hash.`,
			);
		}
	}

	assertMatchingRows(
		"product",
		snapshot.products
			.map((row) => [row.gtin14, row.contentSha256] as const)
			.sort(([left], [right]) => left.localeCompare(right)),
		products.map((row) => [row.gtin14, row.content_sha256] as const),
	);
	assertMatchingRows(
		"revision",
		snapshot.revisions
			.map(
				(row) => [row.gtin14, row.revisionNumber, row.contentSha256] as const,
			)
			.sort(([leftGtin, leftNumber], [rightGtin, rightNumber]) =>
				leftGtin === rightGtin
					? leftNumber - rightNumber
					: leftGtin.localeCompare(rightGtin),
			),
		revisions.map(
			(row) => [row.gtin14, row.revision_number, row.content_sha256] as const,
		),
	);
	assertMatchingRows(
		"category",
		snapshot.categories
			.map((row) => [row.key, row.contentSha256] as const)
			.sort(([left], [right]) => left.localeCompare(right)),
		categories.map((row) => [row.category_key, row.content_sha256] as const),
	);
	assertMatchingRows(
		"attribution",
		snapshot.attributions.map((row) => [row.key, row.contentSha256] as const),
		attributions.map((row) => [row.source_key, row.content_sha256] as const),
	);
};

const buildSearchParityCorpus = (snapshot: BlendCalcAPIPublicationSnapshot) => {
	const queries = new Set(["blendcalc-no-such-publication-product"]);
	for (const product of snapshot.products) {
		queries.add(product.gtin14);
		queries.add(product.productName);
		const firstNameTerm = tokenizeIngredientSearchText(product.productName)[0];
		if (firstNameTerm) queries.add(firstNameTerm);
		if (product.brandOwner) queries.add(product.brandOwner);
		if (product.detailPayload.category?.name) {
			queries.add(product.detailPayload.category.name);
		}
	}
	return [...queries].sort();
};

export const verifyBlendCalcAPIPublicationSearchParity = async (
	source: SupabaseClient<SourceDatabase>,
	target: BlendCalcAPIIsolatedClient,
	generationId: string,
	snapshot: BlendCalcAPIPublicationSnapshot,
) => {
	for (const query of buildSearchParityCorpus(snapshot)) {
		for (const page of [
			{ limit: 15, offset: 0 },
			{ limit: 1, offset: 0 },
			{ limit: 1, offset: 1 },
		]) {
			const sourceResult = await searchBlendCalcAPIV1Products(source, {
				query,
				...page,
			});
			const terms = tokenizeIngredientSearchText(query).slice(0, 6);
			const { data, error } = await target.rpc(
				"search_publication_generation_products",
				{
					p_generation_id: generationId,
					p_query: query,
					p_terms: terms,
					p_limit: page.limit,
					p_offset: page.offset,
				},
			);
			if (error) throw error;
			const rows = data ?? [];
			const targetResult = {
				products: rows.map((row) => row.search_payload),
				pagination: {
					limit: page.limit,
					offset: page.offset,
					total: Number(rows[0]?.total_count ?? 0),
					hasMore: page.offset + page.limit < Number(rows[0]?.total_count ?? 0),
					nextOffset:
						page.offset + page.limit < Number(rows[0]?.total_count ?? 0)
							? page.offset + page.limit
							: null,
				},
			};
			if (hashCanonicalJson(sourceResult) !== hashCanonicalJson(targetResult)) {
				throw new Error(
					`The isolated search result failed parity for ${JSON.stringify(query)} at offset ${page.offset}.`,
				);
			}
		}
	}
};

const verifySourceSnapshotIsCurrent = async (
	source: SupabaseClient<SourceDatabase>,
	snapshot: BlendCalcAPIPublicationSnapshot,
) => {
	const inventory = await readPublishedInventory(source);
	const expected = snapshot.products.map((product) => [
		product.sourceProductId,
		product.sourceRevisionId,
		product.sourceUpdatedAt,
	]);
	const actual = inventory.map((product) => [
		product.shared_product_id,
		product.current_revision_id,
		product.catalog_updated_at,
	]);
	if (hashCanonicalJson(expected) !== hashCanonicalJson(actual)) {
		throw new Error(
			"The canonical publication changed while synchronization was running.",
		);
	}
};

const failGeneration = async (
	target: BlendCalcAPIIsolatedClient,
	generationId: string,
) => {
	await target.rpc("fail_publication_generation", {
		p_generation_id: generationId,
		p_failure_code: "publication_sync_failed",
	});
};

export const synchronizeBlendCalcAPIPublication = async (
	source: SupabaseClient<SourceDatabase>,
	target = getBlendCalcAPIIsolatedClient(),
): Promise<BlendCalcAPIPublicationSyncResult> => {
	const snapshot = await buildBlendCalcAPIPublicationSnapshot(source);
	const counts = countsForSnapshot(snapshot);
	const { data: active, error: activeError } = await target
		.from("publication_generations")
		.select("id, source_catalog_hash")
		.eq("status", "active")
		.maybeSingle();
	if (activeError) throw activeError;
	if (active?.source_catalog_hash === snapshot.catalogHash) {
		await verifyBlendCalcAPIPublicationGeneration(target, active.id, snapshot);
		await verifyBlendCalcAPIPublicationSearchParity(
			source,
			target,
			active.id,
			snapshot,
		);
		await verifySourceSnapshotIsCurrent(source, snapshot);
		return {
			action: "unchanged",
			generationId: active.id,
			catalogHash: snapshot.catalogHash,
			counts,
		};
	}

	const { data: generation, error: generationError } = await target
		.from("publication_generations")
		.insert({
			source_project_ref: snapshot.sourceProjectRef,
			source_catalog_hash: snapshot.catalogHash,
			expected_product_count: counts.products,
			expected_revision_count: counts.revisions,
			expected_category_count: counts.categories,
			expected_attribution_count: counts.attributions,
			source_snapshot_at: snapshot.sourceSnapshotAt,
		})
		.select("id")
		.single();
	if (generationError) throw generationError;
	const generationId = generation.id;

	try {
		await writeBatches(snapshot.products, (batch) =>
			target.from("publication_products").insert(
				batch.map((product) => ({
					generation_id: generationId,
					source_product_id: product.sourceProductId,
					source_revision_id: product.sourceRevisionId,
					gtin14: product.gtin14,
					product_name: product.productName,
					brand_owner: product.brandOwner,
					category_key: product.categoryKey,
					category_search_text: product.categorySearchText,
					search_text: product.searchText,
					detail_payload: toPublicationJson(product.detailPayload),
					search_payload: toPublicationJson(product.searchPayload),
					content_sha256: product.contentSha256,
					source_updated_at: product.sourceUpdatedAt,
				})),
			),
		);
		await writeBatches(snapshot.revisions, (batch) =>
			target.from("publication_product_revisions").insert(
				batch.map((revision) => ({
					generation_id: generationId,
					gtin14: revision.gtin14,
					source_revision_id: revision.sourceRevisionId,
					revision_number: revision.revisionNumber,
					published_at: revision.publishedAt,
					revision_payload: toPublicationJson(revision.payload),
					content_sha256: revision.contentSha256,
				})),
			),
		);
		await writeBatches(snapshot.categories, (batch) =>
			target.from("publication_categories").insert(
				batch.map((category) => ({
					generation_id: generationId,
					category_key: category.key,
					display_name: category.displayName,
					sort_order: category.sortOrder,
					category_payload: toPublicationJson(category.payload),
					content_sha256: category.contentSha256,
				})),
			),
		);
		await writeBatches(snapshot.attributions, (batch) =>
			target.from("publication_source_attributions").insert(
				batch.map((attribution) => ({
					generation_id: generationId,
					source_key: attribution.key,
					attribution_payload: toPublicationJson(attribution.payload),
					content_sha256: attribution.contentSha256,
				})),
			),
		);
		const { error: readyError } = await target.rpc(
			"mark_publication_generation_ready",
			{ p_generation_id: generationId },
		);
		if (readyError) throw readyError;
		await verifyBlendCalcAPIPublicationGeneration(
			target,
			generationId,
			snapshot,
		);
		await verifyBlendCalcAPIPublicationSearchParity(
			source,
			target,
			generationId,
			snapshot,
		);
		await verifySourceSnapshotIsCurrent(source, snapshot);
		const { error: activateError } = await target.rpc(
			"activate_publication_generation",
			{ p_generation_id: generationId },
		);
		if (activateError) throw activateError;
	} catch (error) {
		await failGeneration(target, generationId).catch(() => undefined);
		throw error;
	}

	return {
		action: "created",
		generationId,
		catalogHash: snapshot.catalogHash,
		counts,
	};
};

export const rollbackBlendCalcAPIPublication = async (
	target = getBlendCalcAPIIsolatedClient(),
): Promise<BlendCalcAPIPublicationSyncResult> => {
	const { data: generation, error } = await target
		.from("publication_generations")
		.select(
			"id, source_catalog_hash, expected_product_count, expected_revision_count, expected_category_count, expected_attribution_count",
		)
		.eq("status", "retired")
		.order("retired_at", { ascending: false })
		.limit(1)
		.maybeSingle();
	if (error) throw error;
	if (!generation)
		throw new Error("No retired publication generation is available.");
	const activation = await target.rpc("activate_publication_generation", {
		p_generation_id: generation.id,
	});
	if (activation.error) throw activation.error;
	return {
		action: "rolled-back",
		generationId: generation.id,
		catalogHash: generation.source_catalog_hash,
		counts: {
			products: generation.expected_product_count,
			revisions: generation.expected_revision_count,
			categories: generation.expected_category_count,
			attributions: generation.expected_attribution_count,
		},
	};
};
