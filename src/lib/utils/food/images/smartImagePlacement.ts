import {
	getImagePlacementCropXFromOffset,
	getImagePlacementGeometry,
	IMAGE_PLACEMENT_MAX_ZOOM,
} from "$lib/utils/food/images/imagePlacement";
import type {
	ImagePlacementGeometry,
	ImagePlacementValue,
	SmartImagePlacementDocument,
	SmartImagePlacementSuggestion,
	SmartImageTextBounds,
	SmartImageTextRegion,
} from "$lib/utils/food/images/types";

export const SMART_IMAGE_PLACEMENT_VERSION = "tesseract-product-label-v1";

const MAX_SUGGESTED_ZOOM = Math.min(4.5, IMAGE_PLACEMENT_MAX_ZOOM);
const STOP_WORDS = new Set([
	"a",
	"an",
	"and",
	"for",
	"from",
	"in",
	"of",
	"on",
	"the",
	"to",
	"with",
]);
const NUTRITION_TEXT =
	/\b(?:nutrition facts?|amount per serving|daily value|calories?|sodium|carbohydrate|protein|servings?)\b/i;
const DISCLAIMER_TEXT =
	/\b(?:ingredients?|distributed by|manufactured by|best before|keep refrigerated|net wt|product of)\b/i;

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

const round = (value: number, precision = 4) => {
	const factor = 10 ** precision;
	return Math.round(value * factor) / factor;
};

const normalizeText = (value: string) =>
	value
		.toLocaleLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();

const tokenize = (value: string) =>
	[...new Set(
		normalizeText(value)
			.split(" ")
			.filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
	)];

const getBoundsWidth = (bounds: SmartImageTextBounds) =>
	Math.max(1, bounds.x1 - bounds.x0);

const getBoundsHeight = (bounds: SmartImageTextBounds) =>
	Math.max(1, bounds.y1 - bounds.y0);

const mergeBounds = (
	regions: SmartImageTextRegion[],
): SmartImageTextBounds => ({
	x0: Math.min(...regions.map((region) => region.bounds.x0)),
	y0: Math.min(...regions.map((region) => region.bounds.y0)),
	x1: Math.max(...regions.map((region) => region.bounds.x1)),
	y1: Math.max(...regions.map((region) => region.bounds.y1)),
});

const combineRegions = (
	regions: SmartImageTextRegion[],
): SmartImageTextRegion => ({
	text: regions.map((region) => region.text.trim()).filter(Boolean).join(" "),
	confidence:
		regions.reduce((total, region) => total + region.confidence, 0) /
		regions.length,
	bounds: mergeBounds(regions),
});

const buildCandidates = (regions: SmartImageTextRegion[]) => {
	const ordered = regions
		.filter((region) => region.text.trim())
		.sort((left, right) =>
			left.bounds.y0 - right.bounds.y0 ||
			left.bounds.x0 - right.bounds.x0
		);
	const candidates = [...ordered];

	for (let index = 0; index < ordered.length; index += 1) {
		for (const count of [2, 3]) {
			const group = ordered.slice(index, index + count);
			if (group.length !== count) continue;
			const first = group[0];
			const last = group[group.length - 1];
			const averageHeight =
				group.reduce(
					(total, region) => total + getBoundsHeight(region.bounds),
					0,
				) / group.length;
			const verticalGap =
				last.bounds.y0 -
				first.bounds.y1 -
				group.slice(1, -1).reduce(
					(total, region) => total + getBoundsHeight(region.bounds),
					0,
				);
			if (verticalGap <= averageHeight * count * 1.5) {
				candidates.push(combineRegions(group));
			}
		}
	}

	return candidates;
};

const getTokenOverlap = (candidate: string[], expected: string[]) => {
	if (expected.length === 0) return 0;
	const candidateTokens = new Set(candidate);
	return (
		expected.filter((token) => candidateTokens.has(token)).length /
		expected.length
	);
};

const scoreCandidate = ({
	region,
	document,
	productName,
	brandName,
}: {
	region: SmartImageTextRegion;
	document: SmartImagePlacementDocument;
	productName: string;
	brandName?: string;
}) => {
	const normalizedCandidate = normalizeText(region.text);
	const candidateTokens = tokenize(region.text);
	const productTokens = tokenize(productName);
	const brandTokens = tokenize(brandName ?? "");
	const productOverlap = getTokenOverlap(candidateTokens, productTokens);
	const brandOverlap = getTokenOverlap(candidateTokens, brandTokens);
	const productPhrase = normalizeText(productName);
	const brandPhrase = normalizeText(brandName ?? "");
	const phraseScore =
		(productPhrase.length > 2 && normalizedCandidate.includes(productPhrase)
			? 24
			: 0) +
		(brandPhrase.length > 2 && normalizedCandidate.includes(brandPhrase)
			? 14
			: 0);
	const textMatchScore = productOverlap * 60 + brandOverlap * 25 + phraseScore;

	const boundsWidth = getBoundsWidth(region.bounds);
	const boundsHeight = getBoundsHeight(region.bounds);
	const centerX = (region.bounds.x0 + region.bounds.x1) / 2;
	const centerY = (region.bounds.y0 + region.bounds.y1) / 2;
	const distanceFromCenter = Math.hypot(
		(centerX - document.width / 2) / (document.width / 2),
		(centerY - document.height / 2) / (document.height / 2),
	);
	const centralityScore = Math.max(0, 1 - distanceFromCenter) * 12;
	const textHeightScore = Math.min(1, boundsHeight / (document.height * 0.08)) * 12;
	const areaScore = Math.min(
		1,
		Math.sqrt(
			(boundsWidth * boundsHeight) /
				(document.width * document.height),
		) / 0.25,
	) * 8;
	const confidenceScore = clamp(region.confidence, 0, 100) * 0.12;
	const nutritionPenalty = NUTRITION_TEXT.test(region.text) ? 80 : 0;
	const disclaimerPenalty = DISCLAIMER_TEXT.test(region.text) ? 24 : 0;
	const denseNumberPenalty =
		(region.text.match(/\d/g)?.length ?? 0) > region.text.length * 0.25
			? 18
			: 0;
	const tinyTextPenalty =
		boundsHeight < document.height * 0.012 ? 22 : 0;
	const score =
		textMatchScore +
		centralityScore +
		textHeightScore +
		areaScore +
		confidenceScore -
		nutritionPenalty -
		disclaimerPenalty -
		denseNumberPenalty -
		tinyTextPenalty;

	return {
		region,
		score,
		productOverlap,
		brandOverlap,
		textMatchScore,
	};
};

const positionFromOffset = (offset: number, maxOffset: number) =>
	maxOffset > 0.5
		? round(clamp(50 - (offset / maxOffset) * 50, 0, 100))
		: 50;

const buildPlacement = ({
	document,
	geometry,
	region,
	confidence,
}: {
	document: SmartImagePlacementDocument;
	geometry: ImagePlacementGeometry;
	region: SmartImageTextRegion;
	confidence: number;
}): ImagePlacementValue => {
	const scale = geometry.baseWidth / document.width;
	const paddedWidth = Math.min(
		document.width,
		getBoundsWidth(region.bounds) * 1.45,
	);
	const paddedHeight = Math.min(
		document.height,
		getBoundsHeight(region.bounds) * 2.2,
	);
	const widthZoom =
		(geometry.frameWidth * 0.78) / Math.max(1, paddedWidth * scale);
	const heightZoom =
		(geometry.frameHeight * 0.72) / Math.max(1, paddedHeight * scale);
	const minimumUsefulZoom = Math.min(
		Math.max(1, geometry.coverZoom * 1.15),
		MAX_SUGGESTED_ZOOM,
	);
	const cropZoom = round(
		clamp(
			Math.min(widthZoom, heightZoom),
			minimumUsefulZoom,
			MAX_SUGGESTED_ZOOM,
		),
	);
	const suggestionGeometry = getImagePlacementGeometry({
		naturalWidth: document.width,
		naturalHeight: document.height,
		frameWidth: geometry.frameWidth,
		frameHeight: geometry.frameHeight,
		horizontalMovement: geometry.horizontalMovement,
		value: {
			cropX: 50,
			cropY: 50,
			cropZoom,
			fitMode: "custom",
			placementVersion: 2,
		},
	});
	const targetCenterX = (region.bounds.x0 + region.bounds.x1) / 2;
	const targetCenterY = (region.bounds.y0 + region.bounds.y1) / 2;
	const desiredOffsetX =
		-(targetCenterX - document.width / 2) * scale * cropZoom;
	const desiredOffsetY =
		-(targetCenterY - document.height / 2) * scale * cropZoom;

	return {
		cropX: getImagePlacementCropXFromOffset(
			suggestionGeometry,
			desiredOffsetX,
		),
		cropY: positionFromOffset(
			desiredOffsetY,
			suggestionGeometry.maxOffsetY,
		),
		cropZoom,
		fitMode: "custom",
		placementVersion: 2,
		placementMethod: "smart-ocr",
		suggestionVersion: SMART_IMAGE_PLACEMENT_VERSION,
		suggestionConfidence: round(confidence, 2),
	};
};

export const suggestImagePlacementFromText = ({
	document,
	geometry,
	productName,
	brandName,
}: {
	document: SmartImagePlacementDocument;
	geometry: ImagePlacementGeometry;
	productName: string;
	brandName?: string;
}): SmartImagePlacementSuggestion | null => {
	if (
		!geometry.ready ||
		document.width <= 0 ||
		document.height <= 0 ||
		document.regions.length === 0
	) {
		return null;
	}

	const ranked = buildCandidates(document.regions)
		.map((region) =>
			scoreCandidate({
				region,
				document,
				productName,
				brandName,
			})
		)
		.sort((left, right) => right.score - left.score);
	const winner = ranked[0];
	if (!winner) return null;

	const hasKnownTextMatch =
		winner.productOverlap > 0 || winner.brandOverlap > 0;
	if (
		(hasKnownTextMatch && winner.score < 25) ||
		(!hasKnownTextMatch && winner.score < 42)
	) {
		return null;
	}

	const confidence = clamp(
		(hasKnownTextMatch ? 48 : 30) +
			winner.productOverlap * 30 +
			winner.brandOverlap * 15 +
			clamp(winner.region.confidence, 0, 100) * 0.12,
		0,
		100,
	);

	return {
		placement: buildPlacement({
			document,
			geometry,
			region: winner.region,
			confidence,
		}),
		confidence: round(confidence, 2),
		matchedText: winner.region.text.trim(),
	};
};
