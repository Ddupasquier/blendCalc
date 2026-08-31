import type { Database } from "$lib/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	readBlendCalcAPIV1Categories as readSourceCategories,
	readBlendCalcAPIV1ProductByBarcode as readSourceProduct,
	readBlendCalcAPIV1ProductRevisionHistory as readSourceRevisions,
	searchBlendCalcAPIV1Products as searchSourceProducts,
} from "./blendCalcAPICatalog.server";
import {
	readIsolatedBlendCalcAPIV1Categories,
	readIsolatedBlendCalcAPIV1ProductByBarcode,
	readIsolatedBlendCalcAPIV1ProductRevisionHistory,
	searchIsolatedBlendCalcAPIV1Products,
} from "./blendCalcAPIIsolatedCatalog.server";
import { hashCanonicalJson } from "./blendCalcAPIJson.server";
import { readBlendCalcAPIReadMode } from "./blendCalcAPIIsolatedClient.server";

type ReadOptions = { databaseAbortSignal?: AbortSignal };

const recordShadowParity = (
	operation: string,
	primary: unknown,
	isolatedRead: () => Promise<unknown>,
) => {
	void isolatedRead()
		.then((isolated) => {
			const sourceHash = hashCanonicalJson(primary);
			const isolatedHash = hashCanonicalJson(isolated);
			console.info("[blendCalcAPI] isolated read parity", {
				operation,
				matches: sourceHash === isolatedHash,
				sourceHash,
				isolatedHash,
			});
		})
		.catch((error: unknown) => {
			console.error("[blendCalcAPI] isolated shadow read failed", {
				operation,
				errorType: error instanceof Error ? error.name : typeof error,
			});
		});
};

const readConfigured = async <Result>(
	operation: string,
	readSource: () => Promise<Result>,
	readIsolated: () => Promise<Result>,
) => {
	const mode = readBlendCalcAPIReadMode();
	if (mode === "isolated") return readIsolated();
	const source = await readSource();
	if (mode === "shadow") recordShadowParity(operation, source, readIsolated);
	return source;
};

export const readBlendCalcAPIV1ProductByBarcode = (
	source: SupabaseClient<Database>,
	barcode: string,
	options: ReadOptions = {},
) =>
	readConfigured(
		"product",
		() => readSourceProduct(source, barcode, options),
		() => readIsolatedBlendCalcAPIV1ProductByBarcode(barcode, options),
	);

export const searchBlendCalcAPIV1Products = (
	source: SupabaseClient<Database>,
	input: { query: string; limit: number; offset: number },
	options: ReadOptions = {},
) =>
	readConfigured(
		"search",
		() => searchSourceProducts(source, input, options),
		() => searchIsolatedBlendCalcAPIV1Products(input, options),
	);

export const readBlendCalcAPIV1Categories = (
	source: SupabaseClient<Database>,
	input: { limit: number; offset: number },
	options: ReadOptions = {},
) =>
	readConfigured(
		"categories",
		() => readSourceCategories(source, input, options),
		() => readIsolatedBlendCalcAPIV1Categories(input, options),
	);

export const readBlendCalcAPIV1ProductRevisionHistory = (
	source: SupabaseClient<Database>,
	barcode: string,
	input: { limit: number; offset: number },
	options: ReadOptions = {},
) =>
	readConfigured(
		"revisions",
		() => readSourceRevisions(source, barcode, input, options),
		() =>
			readIsolatedBlendCalcAPIV1ProductRevisionHistory(barcode, input, options),
	);
