/**
 * Purpose: Seed deterministic image-addition and/or image-adjustment submissions with
 * generated evidence for an existing moderator account; the paired cleanup command
 * removes fixtures created for that email. This writes QA rows and private storage files.
 * Seed: `npm run catalog:qa-image-seed -- moderator@example.com both`
 * Cleanup: `npm run catalog:qa-image-clean -- moderator@example.com`
 */

import { randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { loadQaDatabaseEnvironment } from "../../lib/qa/qa_database_environment.mjs";

const { supabaseUrl, serviceRoleKey } = loadQaDatabaseEnvironment();
const [command = "seed", rawEmail, rawMode = "both"] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase();
const allowedModes = new Set(["addition", "adjustment", "both"]);
const evidenceBucket = "product-submission-evidence";
const qaProductPrefix = "[QA Image]";

const usage = () => {
	console.error(`Usage:
  npm run catalog:qa-image-seed -- moderator@example.com
  npm run catalog:qa-image-seed -- moderator@example.com addition
  npm run catalog:qa-image-seed -- moderator@example.com adjustment
  npm run catalog:qa-image-clean -- moderator@example.com`);
};

if (!email || (command === "seed" && !allowedModes.has(rawMode))) {
	usage();
	process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
	auth: {
		autoRefreshToken: false,
		detectSessionInUrl: false,
		persistSession: false,
	},
	realtime: { transport: WebSocket },
});

const crcTable = Array.from({ length: 256 }, (_, index) => {
	let value = index;
	for (let bit = 0; bit < 8; bit += 1) {
		value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
	}
	return value >>> 0;
});

const crc32 = (buffer) => {
	let crc = 0xffffffff;
	for (const byte of buffer) {
		crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
};

const createPngChunk = (type, data = Buffer.alloc(0)) => {
	const typeBuffer = Buffer.from(type);
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
	return Buffer.concat([length, typeBuffer, data, crc]);
};

const createPng = (width, height, draw) => {
	const rowLength = width * 3 + 1;
	const bytes = Buffer.alloc(rowLength * height, 255);
	for (let row = 0; row < height; row += 1) {
		bytes[row * rowLength] = 0;
	}

	const setPixel = (x, y, color) => {
		if (x < 0 || x >= width || y < 0 || y >= height) return;
		const offset = y * rowLength + 1 + x * 3;
		bytes[offset] = color[0];
		bytes[offset + 1] = color[1];
		bytes[offset + 2] = color[2];
	};

	const rect = (x, y, rectWidth, rectHeight, color) => {
		for (let row = Math.max(0, y); row < Math.min(height, y + rectHeight); row += 1) {
			for (
				let column = Math.max(0, x);
				column < Math.min(width, x + rectWidth);
				column += 1
			) {
				setPixel(column, row, color);
			}
		}
	};

	draw({ rect, width, height });

	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8;
	header[9] = 2;
	header[10] = 0;
	header[11] = 0;
	header[12] = 0;

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		createPngChunk("IHDR", header),
		createPngChunk("IDAT", deflateSync(bytes)),
		createPngChunk("IEND"),
	]);
};

const drawPackageImage = (mode) =>
	createPng(360, 520, ({ rect, width, height }) => {
		rect(0, 0, width, height, [248, 250, 252]);
		rect(34, 24, 292, 472, [255, 255, 255]);
		rect(34, 24, 292, 68, mode === "adjustment" ? [92, 174, 128] : [227, 94, 82]);
		rect(64, 124, 232, 126, [239, 246, 255]);
		rect(92, 152, 176, 70, mode === "adjustment" ? [184, 225, 206] : [255, 210, 120]);
		rect(64, 284, 232, 22, [20, 27, 45]);
		rect(64, 324, 232, 16, [145, 153, 180]);
		rect(64, 354, 170, 16, [145, 153, 180]);
		rect(64, 410, 232, 58, [245, 245, 244]);
	});

const drawNutritionImage = () =>
	createPng(520, 360, ({ rect, width, height }) => {
		rect(0, 0, width, height, [255, 255, 255]);
		rect(22, 22, width - 44, height - 44, [20, 20, 20]);
		rect(28, 28, width - 56, height - 56, [255, 255, 255]);
		rect(42, 64, width - 84, 12, [20, 20, 20]);
		rect(42, 106, width - 84, 8, [20, 20, 20]);
		for (let row = 142; row <= 276; row += 28) {
			rect(42, row, width - 84, 2, [196, 196, 196]);
		}
		rect(256, 126, 3, 168, [20, 20, 20]);
	});

const drawBarcodeImage = () =>
	createPng(520, 320, ({ rect, width, height }) => {
		rect(0, 0, width, height, [255, 255, 255]);
		rect(42, 42, width - 84, height - 84, [245, 245, 244]);
		for (let column = 86; column < width - 86; column += 13) {
			const barWidth = column % 3 === 0 ? 8 : column % 5 === 0 ? 5 : 3;
			rect(column, 90, barWidth, 132, [20, 20, 20]);
		}
	});

const findUserByEmail = async () => {
	for (let page = 1; page <= 100; page += 1) {
		const { data, error } = await supabase.auth.admin.listUsers({
			page,
			perPage: 1000,
		});
		if (error) throw error;
		const user = data.users.find(
			(candidate) => candidate.email?.toLowerCase() === email,
		);
		if (user) return user;
		if (data.users.length < 1000) break;
	}
	throw new Error(`No Supabase Auth user found for ${email}.`);
};

const calculateGtinCheckDigit = (body) => {
	const sum = [...body]
		.reverse()
		.reduce(
			(total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1),
			0,
		);
	return String((10 - (sum % 10)) % 10);
};

const createQaBarcode = async (mode) => {
	const prefix = mode === "adjustment" ? "099997" : "099998";
	for (let attempt = 0; attempt < 20; attempt += 1) {
		const suffix = `${Date.now()}${attempt}`.slice(-7).padStart(7, "0");
		const body = `${prefix}${suffix}`;
		const barcode = `${body}${calculateGtinCheckDigit(body)}`;
		const [{ data: product }, { data: submission }] = await Promise.all([
			supabase.from("shared_products").select("id").eq("barcode", barcode).maybeSingle(),
			supabase
				.from("shared_product_submissions")
				.select("id")
				.eq("barcode", barcode)
				.eq("status", "pending")
				.maybeSingle(),
		]);
		if (!product && !submission) return barcode;
	}
	throw new Error("Could not create an unused QA image barcode.");
};

const createFood = (barcode, mode) => ({
	fdcId: -Number(barcode.slice(-8)),
	description: `${qaProductPrefix} ${mode === "adjustment" ? "Crop Adjustment" : "Image Addition"} Granola`,
	brandOwner: "blendCalc QA Kitchen",
	foodCategory: "Verified Packaged Food",
	dataType: "Custom Food",
	servingSize: 40,
	servingSizeUnit: "g",
	householdServingFullText: "1 test pouch",
	gtinUpc: barcode,
	barcode,
	barcodeSource: "manual",
	customFood: true,
	customServingLabel: "1 test pouch",
	customServingWeightGrams: 40,
	reportedNutrientIds: [1008, 1004, 1005, 1079, 2000, 1003, 1093],
	foodNutrients: [
		{ nutrientId: 1008, nutrientName: "Energy", nutrientNumber: "208", unitName: "KCAL", value: 425 },
		{ nutrientId: 1004, nutrientName: "Total lipid (fat)", nutrientNumber: "204", unitName: "G", value: 12.5 },
		{ nutrientId: 1005, nutrientName: "Carbohydrate, by difference", nutrientNumber: "205", unitName: "G", value: 62.5 },
		{ nutrientId: 1079, nutrientName: "Fiber, total dietary", nutrientNumber: "291", unitName: "G", value: 7.5 },
		{ nutrientId: 2000, nutrientName: "Sugars, total including NLEA", nutrientNumber: "269", unitName: "G", value: 15 },
		{ nutrientId: 1003, nutrientName: "Protein", nutrientNumber: "203", unitName: "G", value: 10 },
		{ nutrientId: 1093, nutrientName: "Sodium, Na", nutrientNumber: "307", unitName: "MG", value: 250 },
	],
});

const createEvidenceImages = (mode) => ({
	front: drawPackageImage(mode),
	nutrition: drawNutritionImage(),
	barcode: drawBarcodeImage(),
});

const uploadQaEvidence = async (userId, mode) => {
	const uploadId = randomUUID();
	const paths = {};
	const images = createEvidenceImages(mode);

	try {
		for (const [role, image] of Object.entries(images)) {
			const path = `${userId}/${uploadId}/${role}.png`;
			const { error } = await supabase.storage
				.from(evidenceBucket)
				.upload(path, image, { contentType: "image/png", upsert: false });
			if (error) throw error;
			paths[role] = path;
		}
		return paths;
	} catch (error) {
		const uploadedPaths = Object.values(paths);
		if (uploadedPaths.length > 0) {
			await supabase.storage.from(evidenceBucket).remove(uploadedPaths);
		}
		throw error;
	}
};

const createValidationReport = (mode) => ({
	valid: mode === "adjustment",
	issues:
		mode === "adjustment"
			? ["QA image fixture: verify the crop before approving the image update."]
			: ["QA image fixture: verify this user-submitted front image before making it public."],
	evidenceComplete: true,
	conflictCount: mode === "adjustment" ? 1 : 0,
	externalLookupFailed: mode === "addition",
	qaImageSeed: true,
	imageReviewMode: mode,
	imageCrop: {
		cropX: mode === "adjustment" ? 42 : 50,
		cropY: mode === "adjustment" ? 48 : 50,
		cropZoom: mode === "adjustment" ? 1.45 : 1.2,
		fitMode: "custom",
		placementVersion: 2,
	},
});

const seedSubmission = async (user, mode) => {
	const barcode = await createQaBarcode(mode);
	const evidencePaths = await uploadQaEvidence(user.id, mode);
	const food = createFood(barcode, mode);

	const { data, error } = await supabase
		.from("shared_product_submissions")
		.insert({
			submitted_by: user.id,
			barcode,
			product_name: food.description,
			brand_owner: food.brandOwner,
			food,
			consent_to_share: true,
			status: "pending",
			verification_status: "manual_review",
			matched_source: mode === "adjustment" ? "open-food-facts" : null,
			matched_reference: mode === "adjustment" ? barcode : null,
			validation_report: createValidationReport(mode),
			evidence_paths: evidencePaths,
			evidence_complete: true,
		})
		.select("id, product_name, barcode")
		.single();

	if (error) {
		await supabase.storage.from(evidenceBucket).remove(Object.values(evidencePaths));
		throw error;
	}

	console.log(`Created ${mode} image moderation submission ${data.id}: ${data.product_name}`);
	console.log(`Barcode: ${data.barcode}`);
};

const cleanupQaSubmissions = async (user) => {
	const { data, error } = await supabase
		.from("shared_product_submissions")
		.select("id, status, evidence_paths")
		.eq("submitted_by", user.id)
		.contains("validation_report", { qaImageSeed: true });
	if (error) throw error;

	const approved = (data ?? []).filter((submission) => submission.status === "approved");
	if (approved.length > 0) {
		throw new Error(
			"An image QA fixture was approved. Retire its shared product before removing the audit record.",
		);
	}

	const evidencePaths = (data ?? []).flatMap((submission) =>
		Object.values(submission.evidence_paths ?? {}).filter(
			(path) => typeof path === "string",
		),
	);
	if (evidencePaths.length > 0) {
		const { error: storageError } = await supabase.storage
			.from(evidenceBucket)
			.remove(evidencePaths);
		if (storageError) throw storageError;
	}

	const ids = (data ?? []).map((submission) => submission.id);
	if (ids.length > 0) {
		const { error: deleteError } = await supabase
			.from("shared_product_submissions")
			.delete()
			.in("id", ids);
		if (deleteError) throw deleteError;
	}
	console.log(`Removed ${ids.length} QA image moderation submission(s) for ${email}.`);
};

try {
	const user = await findUserByEmail();
	if (command === "cleanup") {
		await cleanupQaSubmissions(user);
	} else if (command === "seed") {
		await cleanupQaSubmissions(user);
		if (rawMode === "addition" || rawMode === "both") {
			await seedSubmission(user, "addition");
		}
		if (rawMode === "adjustment" || rawMode === "both") {
			await seedSubmission(user, "adjustment");
		}
		console.log("Open /moderation to review the image submission(s).");
		console.log("These fixtures are approvable; reject them if you only need a UI check.");
	} else {
		usage();
		process.exitCode = 1;
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
