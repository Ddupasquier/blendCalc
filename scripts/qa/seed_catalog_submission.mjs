/**
 * Purpose: Seed deterministic reviewable and/or incomplete shared-product submissions,
 * including private evidence, for an existing moderator account; the paired cleanup
 * command removes fixtures created for that email. This writes QA rows and storage files.
 * Seed: `npm run catalog:qa-seed -- moderator@example.com both`
 * Cleanup: `npm run catalog:qa-clean -- moderator@example.com`
 */

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

config({ path: ".env.moderation.local", quiet: true });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const [command = "seed", rawEmail, rawMode = "both"] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase();
const allowedModes = new Set(["reviewable", "incomplete", "both"]);
const evidenceBucket = "product-submission-evidence";
const qaProductPrefix = "[QA] Questionable Chips";

const usage = () => {
	console.error(`Usage:
  npm run catalog:qa-seed -- moderator@example.com
  npm run catalog:qa-seed -- moderator@example.com reviewable
  npm run catalog:qa-seed -- moderator@example.com incomplete
  npm run catalog:qa-clean -- moderator@example.com`);
};

if (!supabaseUrl || !serviceRoleKey) {
	console.error(
		"Add PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.moderation.local.",
	);
	process.exit(1);
}

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

const createQaBarcode = async () => {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		const suffix = `${Date.now()}${attempt}`.slice(-7).padStart(7, "0");
		const body = `099999${suffix}`;
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
	throw new Error("Could not create an unused QA barcode.");
};

const createFood = (barcode, mode) => ({
	fdcId: -Number(barcode.slice(-8)),
	description: `${qaProductPrefix} (${mode})`,
	brandOwner: "Test Kitchen Labs",
	foodCategory: "QA fixture — do not publish",
	dataType: "Custom Food",
	servingSize: 28,
	servingSizeUnit: "g",
	householdServingFullText: "About 12 chips",
	gtinUpc: barcode,
	barcode,
	barcodeSource: "manual",
	customFood: true,
	customServingLabel: "About 12 chips",
	customServingWeightGrams: 28,
	reportedNutrientIds: [1008, 1004, 1005, 1079, 2000, 1003, 1093],
	foodNutrients: [
		{ nutrientId: 1008, nutrientName: "Energy", nutrientNumber: "208", unitName: "KCAL", value: 571 },
		{ nutrientId: 1004, nutrientName: "Total lipid (fat)", nutrientNumber: "204", unitName: "G", value: 35.7 },
		{ nutrientId: 1005, nutrientName: "Carbohydrate, by difference", nutrientNumber: "205", unitName: "G", value: 53.6 },
		{ nutrientId: 1079, nutrientName: "Fiber, total dietary", nutrientNumber: "291", unitName: "G", value: 3.6 },
		{ nutrientId: 2000, nutrientName: "Sugars, total including NLEA", nutrientNumber: "269", unitName: "G", value: 7.1 },
		{ nutrientId: 1003, nutrientName: "Protein", nutrientNumber: "203", unitName: "G", value: 7.1 },
		{ nutrientId: 1093, nutrientName: "Sodium, Na", nutrientNumber: "307", unitName: "MG", value: 1786 },
	],
});

const uploadQaEvidence = async (userId) => {
	const image = await readFile(new URL("../../static/og-image.png", import.meta.url));
	const uploadId = randomUUID();
	const paths = {};

	try {
		for (const role of ["front", "nutrition", "barcode"]) {
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

const seedSubmission = async (user, mode) => {
	const barcode = await createQaBarcode();
	const evidencePaths = mode === "reviewable" ? await uploadQaEvidence(user.id) : {};
	const evidenceComplete = mode === "reviewable";
	const food = createFood(barcode, mode);
	const issues = mode === "reviewable"
		? [
				"QA fixture: the uploaded images intentionally do not match the entered product.",
				"QA fixture: sodium is unusually high and should be checked against the label.",
			]
		: ["QA fixture: required package evidence is intentionally missing."];

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
			matched_source: null,
			matched_reference: null,
			validation_report: {
				valid: false,
				issues,
				externalLookupFailed: true,
				evidenceComplete,
				conflictCount: 2,
				qaSeed: true,
			},
			evidence_paths: evidencePaths,
			evidence_complete: evidenceComplete,
		})
		.select("id, product_name, barcode")
		.single();

	if (error) {
		const uploadedPaths = Object.values(evidencePaths);
		if (uploadedPaths.length > 0) {
			await supabase.storage.from(evidenceBucket).remove(uploadedPaths);
		}
		throw error;
	}

	console.log(`Created ${mode} QA submission ${data.id}: ${data.product_name}`);
	console.log(`Barcode: ${data.barcode}`);
};

const cleanupQaSubmissions = async (user) => {
	const { data, error } = await supabase
		.from("shared_product_submissions")
		.select("id, status, evidence_paths")
		.eq("submitted_by", user.id)
		.contains("validation_report", { qaSeed: true });
	if (error) throw error;

	const approved = (data ?? []).filter((submission) => submission.status === "approved");
	if (approved.length > 0) {
		throw new Error(
			"A QA fixture was approved. Retire its shared product before removing the audit record.",
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
	console.log(`Removed ${ids.length} QA catalog submission(s) for ${email}.`);
};

try {
	const user = await findUserByEmail();
	if (command === "cleanup") {
		await cleanupQaSubmissions(user);
	} else if (command === "seed") {
		await cleanupQaSubmissions(user);
		if (rawMode === "reviewable" || rawMode === "both") {
			await seedSubmission(user, "reviewable");
		}
		if (rawMode === "incomplete" || rawMode === "both") {
			await seedSubmission(user, "incomplete");
		}
		console.log("Open /moderation to review the QA submission(s). Reject them when finished.");
	} else {
		usage();
		process.exitCode = 1;
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
