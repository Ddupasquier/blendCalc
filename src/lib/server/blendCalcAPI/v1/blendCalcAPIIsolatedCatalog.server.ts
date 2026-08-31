import type {
	BlendCalcAPIV1Category,
	BlendCalcAPIV1Product,
	BlendCalcAPIV1ProductRevisionHistoryItem,
} from "$lib/blendCalcAPI/v1/blendCalcAPITypes";
import { tokenizeIngredientSearchText } from "$lib/utils/ingredients/ingredientSearchRelevance";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import { applyDatabaseQueryAbortSignal } from "$lib/utils/storage/supabase/databaseQueryAbortSignal";
import { createPagination } from "./blendCalcAPICatalog.server";
import { getBlendCalcAPIIsolatedClient } from "./blendCalcAPIIsolatedClient.server";

type ReadOptions = { databaseAbortSignal?: AbortSignal };

export const readIsolatedBlendCalcAPIV1ProductByBarcode = async (
	barcodeValue: string,
	options: ReadOptions = {},
) => {
	const barcode = normalizeBarcode(barcodeValue);
	if (!barcode) return null;
	const query = applyDatabaseQueryAbortSignal(
		getBlendCalcAPIIsolatedClient()
			.from("active_publication_products")
			.select("detail_payload")
			.eq("gtin14", barcode),
		options.databaseAbortSignal,
	).maybeSingle();
	const { data, error } = await query;
	if (error) throw error;
	return data?.detail_payload
		? (data.detail_payload as unknown as BlendCalcAPIV1Product)
		: null;
};

export const searchIsolatedBlendCalcAPIV1Products = async (
	input: { query: string; limit: number; offset: number },
	options: ReadOptions = {},
) => {
	const terms = tokenizeIngredientSearchText(input.query).slice(0, 6);
	if (terms.length === 0) {
		return {
			products: [] as BlendCalcAPIV1Product[],
			pagination: createPagination(input.limit, input.offset, 0),
		};
	}
	const query = getBlendCalcAPIIsolatedClient().rpc(
		"search_active_publication_products",
		{
			p_query: input.query,
			p_terms: terms,
			p_limit: input.limit,
			p_offset: input.offset,
		},
	);
	const { data, error } = await applyDatabaseQueryAbortSignal(
		query,
		options.databaseAbortSignal,
	);
	if (error) throw error;
	const rows = data ?? [];
	return {
		products: rows.map(
			(row) => row.search_payload as unknown as BlendCalcAPIV1Product,
		),
		pagination: createPagination(
			input.limit,
			input.offset,
			Number(rows[0]?.total_count ?? 0),
		),
	};
};

export const readIsolatedBlendCalcAPIV1Categories = async (
	input: { limit: number; offset: number },
	options: ReadOptions = {},
) => {
	const query = getBlendCalcAPIIsolatedClient()
		.from("active_publication_categories")
		.select("category_payload", { count: "exact" })
		.order("sort_order", { ascending: true })
		.order("category_key", { ascending: true })
		.range(input.offset, input.offset + input.limit - 1);
	const { data, error, count } = await applyDatabaseQueryAbortSignal(
		query,
		options.databaseAbortSignal,
	);
	if (error) throw error;
	return {
		categories: (data ?? []).map(
			(row) => row.category_payload as unknown as BlendCalcAPIV1Category,
		),
		pagination: createPagination(input.limit, input.offset, count ?? 0),
	};
};

export const readIsolatedBlendCalcAPIV1ProductRevisionHistory = async (
	barcodeValue: string,
	input: { limit: number; offset: number },
	options: ReadOptions = {},
) => {
	const barcode = normalizeBarcode(barcodeValue);
	if (!barcode) return null;
	const client = getBlendCalcAPIIsolatedClient();
	const revisionQuery = client
		.from("active_publication_product_revisions")
		.select("revision_payload", { count: "exact" })
		.eq("gtin14", barcode)
		.order("revision_number", { ascending: false })
		.range(input.offset, input.offset + input.limit - 1);
	const { data, error, count } = await applyDatabaseQueryAbortSignal(
		revisionQuery,
		options.databaseAbortSignal,
	);
	if (error) throw error;
	if ((data ?? []).length === 0 && (count ?? 0) === 0) {
		const productResult = await applyDatabaseQueryAbortSignal(
			client
				.from("active_publication_products")
				.select("gtin14")
				.eq("gtin14", barcode),
			options.databaseAbortSignal,
		).maybeSingle();
		if (productResult.error) throw productResult.error;
		if (!productResult.data) return null;
	}
	return {
		revisions: (data ?? []).map(
			(row) =>
				row.revision_payload as unknown as BlendCalcAPIV1ProductRevisionHistoryItem,
		),
		pagination: createPagination(input.limit, input.offset, count ?? 0),
	};
};
