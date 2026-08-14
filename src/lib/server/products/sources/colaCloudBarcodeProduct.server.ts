import { env } from "$env/dynamic/private";
import { findFirstBarcodeCandidateMatch } from "$lib/server/products/barcodeCandidateLookup";
import { fetchCachedProductApiJson } from "$lib/server/products/productApiRequests.server";
import { getProductReferenceCatalog } from "$lib/server/products/productReferenceCatalog.server";
import {
	createProductSourceRequestTrace,
	recordProductSourceLookup,
} from "$lib/server/products/sourceMetrics.server";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { ProductReferenceCatalog } from "$lib/utils/food/reference/productReferenceCatalog";
import { getProductDataSource } from "$lib/utils/food/reference/productReferenceCatalog";
import { summarizeBarcodeProductQuality } from "$lib/utils/food/sources/sourceQuality";
import type {
	FoodAlcoholByVolume,
	FoodFieldProvenance,
	FoodPackageQuantity,
	FoodSourceRecordMetadata,
} from "$lib/utils/food/types";
import { toFiniteNonnegativeNumber } from "$lib/utils/numbers/finiteNumbers";
import { formatSourceProductName } from "$lib/utils/products/productNameFormatting.js";

const COLA_CLOUD_API_URL = "https://app.colacloud.us/api/v1";
const COLA_CLOUD_SOURCE_KEY = "cola-cloud";
const COLA_CLOUD_REQUEST_TIMEOUT_MILLISECONDS = 8_000;

type ColaCloudResponse<Data> = {
	data?: Data | null;
};

type ColaCloudApprovalSummary = {
	ttb_id?: string;
	application_status?: string;
	approval_date?: string;
	brand_name?: string;
	product_name?: string;
	product_type?: string;
};

type ColaCloudBarcodeLookup = {
	barcode_value?: string;
	colas?: ColaCloudApprovalSummary[];
	total_colas?: number;
};

type ColaCloudBarcodeEvidence = {
	barcode_value?: string;
};

type ColaCloudApprovalDetail = ColaCloudApprovalSummary & ColaCloudBarcodeEvidence & {
	abv?: number | string | null;
	volume?: number | string | null;
	volume_unit?: string | null;
	latest_update_date?: string | null;
	barcodes?: ColaCloudBarcodeEvidence[];
};

type ColaCloudLookupOptions = {
	apiKey?: string;
	fetcher?: typeof fetch;
	productReferenceCatalog?: ProductReferenceCatalog;
};

const transientRequestStore = {
	read: async () => null,
	write: async () => undefined,
};

const toIsoDate = (value: string | null | undefined) => {
	const trimmed = value?.trim();
	if (!trimmed) return undefined;
	const timestamp = Date.parse(trimmed);
	return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
};

const getApprovalTimestamp = (approval: ColaCloudApprovalSummary) =>
	Date.parse(approval.approval_date ?? "") || 0;

const selectNewestApprovedLabel = (
	approvals: ColaCloudApprovalSummary[] | undefined,
) => (approvals ?? [])
	.filter((approval) =>
		approval.ttb_id?.trim() &&
		approval.application_status?.trim().toLocaleLowerCase() === "approved"
	)
	.sort((left, right) =>
		getApprovalTimestamp(right) - getApprovalTimestamp(left) ||
		String(right.ttb_id).localeCompare(String(left.ttb_id))
	)[0] ?? null;

const detailMatchesBarcode = (
	detail: ColaCloudApprovalDetail,
	canonicalBarcode: string,
) => [
		detail.barcode_value,
		...(detail.barcodes ?? []).map((barcode) => barcode.barcode_value),
	].some((value) =>
		value ? normalizeBarcode(value) === canonicalBarcode : false
	);

const parseAlcoholByVolume = (
	value: ColaCloudApprovalDetail["abv"],
): FoodAlcoholByVolume | undefined => {
	const percent = toFiniteNonnegativeNumber(value);
	if (percent === null || percent > 100) return undefined;
	return {
		percent,
		valueStatus: percent === 0 ? "reported-zero" : "reported",
		basis: "volume-percent",
		sourceUnit: "% ABV",
	};
};

const parsePackageQuantity = (
	detail: ColaCloudApprovalDetail,
): FoodPackageQuantity | undefined => {
	const amount = toFiniteNonnegativeNumber(detail.volume);
	const unit = detail.volume_unit?.trim();
	if (amount === null || amount <= 0 || !unit) return undefined;
	return {
		label: `${amount} ${unit}`,
		amount,
		unit,
	};
};

const parseSourceMetadata = (
	detail: ColaCloudApprovalDetail,
): FoodSourceRecordMetadata => ({
	marketCountries: ["US"],
	...(toIsoDate(detail.approval_date)
		? { publishedAt: toIsoDate(detail.approval_date) }
		: {}),
	...(toIsoDate(detail.latest_update_date)
		? { updatedAt: toIsoDate(detail.latest_update_date) }
		: {}),
});

const createColaCloudDraft = (
	detail: ColaCloudApprovalDetail,
	canonicalBarcode: string,
	productReferenceCatalog: ProductReferenceCatalog,
): BarcodeProductDraft | null => {
	const name = formatSourceProductName(detail.product_name);
	const sourceReference = detail.ttb_id?.trim();
	if (!name || !sourceReference || !detailMatchesBarcode(detail, canonicalBarcode)) {
		return null;
	}

	const source = getProductDataSource(
		productReferenceCatalog,
		COLA_CLOUD_SOURCE_KEY,
	);
	const fieldSource = {
		source: COLA_CLOUD_SOURCE_KEY,
		sourceReference,
		confidence: "imported",
	} as const;
	const alcoholByVolume = parseAlcoholByVolume(detail.abv);
	const packageQuantity = parsePackageQuantity(detail);
	const sourceMetadata = parseSourceMetadata(detail);
	const brandOwner = detail.brand_name?.trim() ?? "";
	const fieldProvenance: FoodFieldProvenance = {
		productName: fieldSource,
		...(brandOwner ? { brandOwner: fieldSource } : {}),
		...(packageQuantity ? { package: fieldSource } : {}),
		...(alcoholByVolume ? { alcoholByVolume: fieldSource } : {}),
		regulatoryDisclosure: fieldSource,
		sourceMetadata: fieldSource,
	};

	return {
		barcode: canonicalBarcode,
		name,
		nameProvenance: "source",
		brandOwner,
		servingLabel: "100 g",
		servingWeightGrams: 100,
		hasSourceServing: false,
		nutrients: [],
		reportedNutrientIds: [],
		foodIdentityType: "packaged",
		packageQuantity,
		alcoholByVolume,
		regulatoryDisclosure: {
			profileKey: "us-ttb-alcohol-beverage-v1",
			evidenceStatus: "source-reported",
		},
		sourceMetadata,
		fieldProvenance,
		source: COLA_CLOUD_SOURCE_KEY,
		sourceLabel: source.displayName,
		sourceReference,
		sourceKey: source.key,
		sourceDataType: detail.product_type?.trim() || undefined,
		sourcePublishedDate: toIsoDate(detail.approval_date),
		sourceModifiedDate: toIsoDate(detail.latest_update_date),
	};
};

const fetchColaCloudJson = async <Data>(input: {
	path: string;
	requestKind: string;
	cacheValue: unknown;
	apiKey: string;
	fetcher?: typeof fetch;
}) => fetchCachedProductApiJson<ColaCloudResponse<Data> | null>({
	provider: COLA_CLOUD_SOURCE_KEY,
	requestKind: input.requestKind,
	cacheValue: input.cacheValue,
	url: `${COLA_CLOUD_API_URL}${input.path}`,
	headers: {
		accept: "application/json",
		"x-api-key": input.apiKey,
	},
	ttlMilliseconds: 0,
	notFoundStatusCodes: [404],
	notFoundValue: null,
	timeoutMilliseconds: COLA_CLOUD_REQUEST_TIMEOUT_MILLISECONDS,
	cacheStore: transientRequestStore,
	fetcher: input.fetcher,
});

export const lookupColaCloudBarcodeProduct = async (
	barcode: string,
	productReferenceCatalog?: ProductReferenceCatalog,
	options: ColaCloudLookupOptions = {},
): Promise<BarcodeProductDraft | null> => {
	const canonicalBarcode = normalizeBarcode(barcode);
	const apiKey = options.apiKey ?? env.COLA_CLOUD_API_KEY?.trim();
	if (!canonicalBarcode || !apiKey) return null;
	const startedAt = Date.now();
	const trace = createProductSourceRequestTrace();

	try {
		const candidateMatch = await findFirstBarcodeCandidateMatch(
			barcode,
			async (candidate) => {
				const response = await fetchColaCloudJson<ColaCloudBarcodeLookup>({
					path: `/barcode/${encodeURIComponent(candidate)}`,
					requestKind: "barcode-approvals",
					cacheValue: candidate,
					apiKey,
					fetcher: options.fetcher,
				});
				const lookup = response?.data;
				if (
					!lookup?.barcode_value ||
					normalizeBarcode(lookup.barcode_value) !== canonicalBarcode
				) {
					return null;
				}
				const approval = selectNewestApprovedLabel(lookup.colas);
				return approval?.ttb_id?.trim() ? approval : null;
			},
		);
		if (!candidateMatch) {
			await recordProductSourceLookup({
				sourceKey: COLA_CLOUD_SOURCE_KEY,
				lookupKind: "barcode",
				outcome: "not-found",
				startedAt,
				trace,
			});
			return null;
		}

		const ttbId = candidateMatch.value.ttb_id?.trim();
		if (!ttbId) return null;
		const detailResponse = await fetchColaCloudJson<ColaCloudApprovalDetail>({
			path: `/colas/${encodeURIComponent(ttbId)}`,
			requestKind: "approval-detail",
			cacheValue: ttbId,
			apiKey,
			fetcher: options.fetcher,
		});
		const detail = detailResponse?.data;
		const draft = detail
			? createColaCloudDraft(
				detail,
				canonicalBarcode,
				options.productReferenceCatalog ??
					productReferenceCatalog ??
					await getProductReferenceCatalog(),
			)
			: null;
		await recordProductSourceLookup({
			sourceKey: COLA_CLOUD_SOURCE_KEY,
			sourceDataType: draft?.sourceDataType,
			lookupKind: "barcode",
			outcome: draft ? "matched" : "not-found",
			startedAt,
			trace,
			quality: draft ? summarizeBarcodeProductQuality(draft) : undefined,
			exactBarcodeMatch: Boolean(draft),
		});
		return draft;
	} catch (error) {
		await recordProductSourceLookup({
			sourceKey: COLA_CLOUD_SOURCE_KEY,
			lookupKind: "barcode",
			outcome: "error",
			startedAt,
			trace,
		});
		throw error;
	}
};
