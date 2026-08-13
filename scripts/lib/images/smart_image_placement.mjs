/**
 * Purpose: Provide the reusable Node-side OCR, orientation, product-name matching, and
 * card-placement calculations used by image backfills and audits. It never writes to
 * the database or stores recognized text.
 * Do not run directly; execute the documented image-placement backfill instead.
 */

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { createWorker, PSM } from "tesseract.js";

export const SMART_IMAGE_PLACEMENT_VERSION = "tesseract-product-label-v2";
export const AUTOMATIC_IMAGE_PLACEMENT_MINIMUM_CONFIDENCE = 68;

const MAX_OCR_IMAGE_DIMENSION = 1800;
const MAX_SUGGESTED_ZOOM = 4.5;
const REPRESENTATIVE_CARD_MEDIA_LANE_WIDTH = 96;
const REPRESENTATIVE_CARD_HEIGHT = 68;
const TESSERACT_CACHE_PATH = resolve("scripts/output/tesseract");
const STOP_WORDS = new Set(["a", "an", "and", "for", "from", "in", "of", "on", "the", "to", "with"]);
const NUTRITION_TEXT = /\b(?:nutrition facts?|amount per serving|daily value|calories?|sodium|carbohydrate|protein|servings?)\b/i;
const DISCLAIMER_TEXT = /\b(?:ingredients?|distributed by|manufactured by|best before|keep refrigerated|net wt|product of)\b/i;
const QUARTER_TURN_RECOGNITION_ATTEMPTS = [0, 90, 270, 180];

const clamp = (value, minimum, maximum) =>
	Math.min(maximum, Math.max(minimum, value));

const round = (value, precision = 4) => {
	const factor = 10 ** precision;
	return Math.round(value * factor) / factor;
};

const normalizeText = (value) =>
	String(value ?? "")
		.toLocaleLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();

const tokenize = (value) =>
	[...new Set(
		normalizeText(value)
			.split(" ")
			.filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
	)];

const getBoundsWidth = (bounds) => Math.max(1, bounds.x1 - bounds.x0);
const getBoundsHeight = (bounds) => Math.max(1, bounds.y1 - bounds.y0);

const mergeBounds = (regions) => ({
	x0: Math.min(...regions.map((region) => region.bounds.x0)),
	y0: Math.min(...regions.map((region) => region.bounds.y0)),
	x1: Math.max(...regions.map((region) => region.bounds.x1)),
	y1: Math.max(...regions.map((region) => region.bounds.y1)),
});

const combineRegions = (regions) => ({
	text: regions.map((region) => region.text.trim()).filter(Boolean).join(" "),
	confidence:
		regions.reduce((total, region) => total + region.confidence, 0) /
		regions.length,
	bounds: mergeBounds(regions),
});

const buildCandidates = (regions) => {
	const ordered = regions
		.filter((region) => region.text.trim())
		.sort((left, right) =>
			left.bounds.y0 - right.bounds.y0 || left.bounds.x0 - right.bounds.x0);
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

const getTokenOverlap = (candidate, expected) => {
	if (expected.length === 0) return 0;
	const candidateTokens = new Set(candidate);
	return expected.filter((token) => candidateTokens.has(token)).length / expected.length;
};

const scoreCandidate = ({ region, document, productName, brandName }) => {
	const normalizedCandidate = normalizeText(region.text);
	const candidateTokens = tokenize(region.text);
	const productTokens = tokenize(productName);
	const brandTokens = tokenize(brandName);
	const productOverlap = getTokenOverlap(candidateTokens, productTokens);
	const brandOverlap = getTokenOverlap(candidateTokens, brandTokens);
	const productPhrase = normalizeText(productName);
	const brandPhrase = normalizeText(brandName);
	const phraseScore =
		(productPhrase.length > 2 && normalizedCandidate.includes(productPhrase) ? 24 : 0) +
		(brandPhrase.length > 2 && normalizedCandidate.includes(brandPhrase) ? 14 : 0);
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
		Math.sqrt((boundsWidth * boundsHeight) / (document.width * document.height)) /
			0.25,
	) * 8;
	const confidenceScore = clamp(region.confidence, 0, 100) * 0.12;
	const score =
		textMatchScore +
		centralityScore +
		textHeightScore +
		areaScore +
		confidenceScore -
		(NUTRITION_TEXT.test(region.text) ? 80 : 0) -
		(DISCLAIMER_TEXT.test(region.text) ? 24 : 0) -
		((region.text.match(/\d/g)?.length ?? 0) > region.text.length * 0.25 ? 18 : 0) -
		(boundsHeight < document.height * 0.012 ? 22 : 0);

	return { region, score, productOverlap, brandOverlap };
};

const getImagePlacementGeometry = ({
	naturalWidth,
	naturalHeight,
	frameWidth,
	frameHeight,
	rotationDegrees,
	zoom,
}) => {
	const swapsDimensions = rotationDegrees === 90 || rotationDegrees === 270;
	const rotatedNaturalWidth = swapsDimensions ? naturalHeight : naturalWidth;
	const rotatedNaturalHeight = swapsDimensions ? naturalWidth : naturalHeight;
	const containScale = Math.min(
		frameWidth / rotatedNaturalWidth,
		frameHeight / rotatedNaturalHeight,
	);
	const baseWidth = rotatedNaturalWidth * containScale;
	const baseHeight = rotatedNaturalHeight * containScale;
	const coverZoom = clamp(
		Math.max(frameWidth / baseWidth, frameHeight / baseHeight),
		1,
		8,
	);
	const effectiveZoom = zoom ?? 1;
	const scaledWidth = baseWidth * effectiveZoom;
	return {
		baseWidth,
		baseHeight,
		coverZoom,
		maxOffsetX: Math.max(
			Math.max(0, scaledWidth - frameWidth),
			Math.min(scaledWidth, frameWidth) / 2,
		),
		maxOffsetY: Math.max(0, (baseHeight * effectiveZoom - frameHeight) / 2),
		horizontalOriginOffsetX: (scaledWidth - frameWidth) / 2,
	};
};

const positionFromOffset = (offset, maxOffset) =>
	maxOffset > 0.5 ? round(clamp(50 - (offset / maxOffset) * 50, 0, 100)) : 50;

const getCropXFromOffset = (geometry, offsetX) => {
	if (geometry.maxOffsetX <= 0.5) return 50;
	const shift = clamp(
		geometry.horizontalOriginOffsetX - offsetX,
		0,
		geometry.maxOffsetX,
	);
	return round(50 + (shift / geometry.maxOffsetX) * 50);
};

const createPlacement = ({ document, region, confidence, originalWidth, originalHeight }) => {
	const rotationDegrees = document.rotationDegrees;
	const baseGeometry = getImagePlacementGeometry({
		naturalWidth: originalWidth,
		naturalHeight: originalHeight,
		frameWidth: REPRESENTATIVE_CARD_MEDIA_LANE_WIDTH,
		frameHeight: REPRESENTATIVE_CARD_HEIGHT,
		rotationDegrees,
		zoom: 1,
	});
	const scale = baseGeometry.baseWidth / document.width;
	const paddedWidth = Math.min(document.width, getBoundsWidth(region.bounds) * 1.45);
	const paddedHeight = Math.min(document.height, getBoundsHeight(region.bounds) * 2.2);
	const widthZoom =
		(REPRESENTATIVE_CARD_MEDIA_LANE_WIDTH * 0.78) /
		Math.max(1, paddedWidth * scale);
	const heightZoom =
		(REPRESENTATIVE_CARD_HEIGHT * 0.72) /
		Math.max(1, paddedHeight * scale);
	const cropZoom = round(clamp(
		Math.min(widthZoom, heightZoom),
		Math.min(Math.max(1, baseGeometry.coverZoom * 1.15), MAX_SUGGESTED_ZOOM),
		MAX_SUGGESTED_ZOOM,
	));
	const geometry = getImagePlacementGeometry({
		naturalWidth: originalWidth,
		naturalHeight: originalHeight,
		frameWidth: REPRESENTATIVE_CARD_MEDIA_LANE_WIDTH,
		frameHeight: REPRESENTATIVE_CARD_HEIGHT,
		rotationDegrees,
		zoom: cropZoom,
	});
	const targetCenterX = (region.bounds.x0 + region.bounds.x1) / 2;
	const targetCenterY = (region.bounds.y0 + region.bounds.y1) / 2;
	const desiredOffsetX = -(targetCenterX - document.width / 2) * scale * cropZoom;
	const desiredOffsetY = -(targetCenterY - document.height / 2) * scale * cropZoom;

	return {
		crop_x: getCropXFromOffset(geometry, desiredOffsetX),
		crop_y: positionFromOffset(desiredOffsetY, geometry.maxOffsetY),
		crop_zoom: cropZoom,
		rotation_degrees: rotationDegrees,
		fit_mode: "custom",
		placement_version: 2,
		placement_method: "automatic-ocr",
		placement_suggestion_version: SMART_IMAGE_PLACEMENT_VERSION,
		placement_suggestion_confidence: round(confidence, 2),
		placement_suggestion_accepted_at: null,
		crop_source: "auto",
	};
};

const recognizeQuarterTurns = async ({ worker, imageBuffer }) => {
	const documents = [];
	for (const rotationDegrees of QUARTER_TURN_RECOGNITION_ATTEMPTS) {
		const { data: orientedBuffer, info } = await sharp(imageBuffer)
			.rotate(rotationDegrees)
			.png()
			.toBuffer({ resolveWithObject: true });
		const result = await worker.recognize(
			orientedBuffer,
			{ rotateAuto: true },
			{ blocks: true, text: true },
		);
		const regions =
			result.data.blocks?.flatMap((block) =>
				block.paragraphs.flatMap((paragraph) =>
					paragraph.lines.map((line) => ({
						text: line.text,
						confidence: line.confidence,
						bounds: {
							x0: line.bbox.x0,
							y0: line.bbox.y0,
							x1: line.bbox.x1,
							y1: line.bbox.y1,
						},
					})),
				),
			) ?? [];
		documents.push({
			width: info.width,
			height: info.height,
			rotationDegrees,
			regions,
		});
	}
	return documents;
};

export const createSmartImagePlacementWorker = async () => {
	mkdirSync(TESSERACT_CACHE_PATH, { recursive: true });
	const worker = await createWorker("eng", undefined, {
		cachePath: TESSERACT_CACHE_PATH,
	});
	await worker.setParameters({
		tessedit_pageseg_mode: PSM.SPARSE_TEXT,
		preserve_interword_spaces: "1",
	});
	return worker;
};

export const suggestStoredImagePlacement = async ({
	worker,
	imageBuffer,
	productName,
	brandName = "",
}) => {
	const prepared = sharp(imageBuffer, { autoOrient: true }).resize({
		width: MAX_OCR_IMAGE_DIMENSION,
		height: MAX_OCR_IMAGE_DIMENSION,
		fit: "inside",
		withoutEnlargement: true,
	});
	const { data, info } = await prepared.png().toBuffer({ resolveWithObject: true });
	const documents = await recognizeQuarterTurns({
		worker,
		imageBuffer: data,
	});
	let best = null;

	for (const document of documents) {
		const ranked = buildCandidates(document.regions)
			.map((region) => scoreCandidate({ region, document, productName, brandName }))
			.sort((left, right) => right.score - left.score);
		const winner = ranked[0];
		if (!winner) continue;
		const hasProductTextMatch = winner.productOverlap > 0;
		const hasKnownTextMatch = hasProductTextMatch || winner.brandOverlap > 0;
		if (
			(hasKnownTextMatch && winner.score < 25) ||
			(!hasKnownTextMatch && winner.score < 42)
		) continue;
		const confidence = clamp(
			(hasKnownTextMatch ? 48 : 30) +
				winner.productOverlap * 30 +
				winner.brandOverlap * 15 +
				clamp(winner.region.confidence, 0, 100) * 0.12,
			0,
			100,
		);
		if (!best || confidence > best.confidence) {
			best = { document, winner, confidence };
		}
	}

	if (
		!best ||
		best.confidence < AUTOMATIC_IMAGE_PLACEMENT_MINIMUM_CONFIDENCE ||
		best.winner.productOverlap <= 0
	) {
		return null;
	}

	return createPlacement({
		document: best.document,
		region: best.winner.region,
		confidence: best.confidence,
		originalWidth: info.width,
		originalHeight: info.height,
	});
};
