/**
 * Purpose: Provide shared temporary-download, checksum, normalization, batched-write,
 * retry, and dataset-cleanup utilities for national nutrition imports. This module can
 * write when called by an importer but is not an executable workflow itself.
 * Do not run directly; use `npm run import:nutrition:cnf` or `npm run import:nutrition:cofid`.
 */

import { createHash } from "node:crypto";
import { rmSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const WRITE_RETRY_COUNT = 3;

export const createNutritionImportClient = () => {
	const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !serviceRoleKey) {
		throw new Error(
			"Add PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.moderation.local.",
		);
	}

	return createClient(supabaseUrl, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			detectSessionInUrl: false,
			persistSession: false,
		},
		realtime: { transport: WebSocket },
	});
};

const temporaryDirectories = new Set();

process.once("exit", () => {
	for (const directory of temporaryDirectories) {
		rmSync(directory, { force: true, recursive: true });
	}
});

export const createTemporaryDownloadDirectory = async (prefix) => {
	const directory = await mkdtemp(path.join(tmpdir(), prefix));
	temporaryDirectories.add(directory);
	return directory;
};

export const downloadTemporaryFile = async ({
	directory,
	name,
	url,
	userAgent = "blendCalc nutrition data importer",
}) => {
	const filePath = path.join(directory, name);
	const response = await fetch(url, { headers: { "user-agent": userAgent } });
	if (!response.ok) {
		throw new Error(`Could not download ${name}: ${response.status}`);
	}
	await writeFile(filePath, Buffer.from(await response.arrayBuffer()));
	return filePath;
};

export const getFilesChecksum = async (paths) => {
	const hash = createHash("sha256");
	for (const [key, filePath] of Object.entries(paths).sort()) {
		hash.update(key);
		hash.update(await readFile(filePath));
	}
	return hash.digest("hex");
};

const withRetries = async (operation, label) => {
	let lastError;
	for (let attempt = 1; attempt <= WRITE_RETRY_COUNT; attempt += 1) {
		try {
			return await operation();
		} catch (error) {
			lastError = error;
			if (attempt < WRITE_RETRY_COUNT) {
				await new Promise((resolve) => setTimeout(resolve, attempt * 500));
			}
		}
	}
	throw new Error(
		`${label} failed after ${WRITE_RETRY_COUNT} attempts: ${lastError?.message ?? lastError}`,
	);
};

export const createBatchWriter = ({
	supabase,
	table,
	onConflict,
	dryRun = false,
	batchSize = 750,
	concurrency = 4,
}) => {
	let batch = [];
	let processed = 0;
	const pending = new Set();

	const submit = async () => {
		if (batch.length === 0) return;
		const rows = batch;
		batch = [];
		processed += rows.length;
		const request = (dryRun
			? Promise.resolve()
			: withRetries(async () => {
				const { error } = await supabase
					.from(table)
					.upsert(rows, { onConflict });
				if (error) throw error;
			}, `${table} batch`)
		).finally(() => pending.delete(request));
		pending.add(request);
		if (pending.size >= concurrency) await Promise.race(pending);
		if (processed % (batchSize * 25) < rows.length) {
			console.log(`${table}: ${processed} rows processed`);
		}
	};

	return {
		async add(row) {
			batch.push(row);
			if (batch.length >= batchSize) await submit();
		},
		async finish() {
			await submit();
			await Promise.all(pending);
		},
	};
};

export const deleteGenericDatasetRows = async (supabase, datasetKey) => {
	for (const table of [
		"generic_food_dataset_reference_rows",
		"generic_food_measures",
		"generic_food_nutrients",
		"generic_food_records",
	]) {
		const { error } = await supabase
			.from(table)
			.delete()
			.eq("dataset_key", datasetKey);
		if (error) throw error;
	}
};

const NORMALIZED_DATASET_UNIT_ALIASES = new Map([
	["GRAM", "G"],
	["GRAMS", "G"],
	["MILLIGRAM", "MG"],
	["MILLIGRAMS", "MG"],
	["MICROGRAM", "UG"],
	["MICROGRAMS", "UG"],
	["MCG", "UG"],
	["KILOCALORIE", "KCAL"],
	["KILOCALORIES", "KCAL"],
	["KILOJOULE", "KJ"],
	["KILOJOULES", "KJ"],
	["INTERNATIONAL UNIT", "IU"],
	["INTERNATIONAL UNITS", "IU"],
	["NIACIN EQUIVALENTS", "NE"],
]);

export const normalizeDatasetUnit = (value) => {
	const normalized = String(value ?? "")
		.trim()
		.toLocaleUpperCase("en-US")
		.replaceAll("Μ", "U")
		.replaceAll("µ", "U");
	return NORMALIZED_DATASET_UNIT_ALIASES.get(normalized) ?? normalized;
};

export const normalizeDatasetSearchText = (...values) =>
	values
		.flatMap((value) => String(value ?? "").split(/\s+/))
		.map((value) => value.trim().toLocaleLowerCase("en-US"))
		.filter(Boolean)
		.join(" ");
