/**
 * Purpose: Preview or atomically purge every Supabase database record selected
 * for one exact UPC / GTIN. Local Supabase is the default and safest target.
 *
 * Preview: npm run catalog:product:purge -- preview 00869759000149
 * Apply: npm run catalog:product:purge -- apply 00869759000149 \
 *   --confirm=00869759000149 --reason="Confirmed disposable test product"
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const args = process.argv.slice(2);
const command = args[0];
const rawBarcode = args[1];
const hosted = args.includes("--hosted");
const confirmation = args
	.find((argument) => argument.startsWith("--confirm="))
	?.slice("--confirm=".length);
const reason = args
	.find((argument) => argument.startsWith("--reason="))
	?.slice("--reason=".length)
	.trim();

config({
	path: hosted ? ".env.moderation.local" : ".env.test.local",
	quiet: true,
});

const usage = () => {
	console.error(`Usage:
  npm run catalog:product:purge -- preview <UPC_OR_GTIN>
  npm run catalog:product:purge -- apply <UPC_OR_GTIN> --confirm=<UPC_OR_GTIN> --reason="<reason>"

The disposable local Supabase stack is used by default. Add --hosted only after
reviewing the preview and intentionally targeting the linked environment.`);
};

const cleanBarcode = (value = "") => value.replace(/[^0-9]/g, "");
const validLengths = new Set([8, 12, 13, 14]);
const hasValidCheckDigit = (value) => {
	const digits = cleanBarcode(value);
	if (!validLengths.has(digits.length)) return false;
	const sum = [...digits.slice(0, -1)]
		.reverse()
		.reduce(
			(total, digit, index) =>
				total + Number(digit) * (index % 2 === 0 ? 3 : 1),
			0,
		);
	return Number(digits.at(-1)) === (10 - (sum % 10)) % 10;
};
const normalizeBarcode = (value) => {
	const digits = cleanBarcode(value);
	return hasValidCheckDigit(digits) ? digits.padStart(14, "0") : null;
};

if (!new Set(["preview", "apply"]).has(command) || !rawBarcode) {
	usage();
	process.exit(1);
}

const barcode = normalizeBarcode(rawBarcode);
if (!barcode) {
	console.error("Enter a valid UPC / GTIN, including its check digit.");
	process.exit(1);
}

if (hosted && process.env.PUBLIC_SUPABASE_URL?.includes("127.0.0.1")) {
	console.error("--hosted was supplied, but the loaded Supabase URL is local.");
	process.exit(1);
}
if (
	!hosted &&
	!process.env.PUBLIC_SUPABASE_URL?.match(/^http:\/\/(127\.0\.0\.1|localhost):/)
) {
	console.error(
		"Refusing to use a non-local Supabase URL without the explicit --hosted flag.",
	);
	process.exit(1);
}
if (
	!process.env.PUBLIC_SUPABASE_URL ||
	!process.env.SUPABASE_SERVICE_ROLE_KEY
) {
	console.error(
		`Missing Supabase credentials in ${hosted ? ".env.moderation.local" : ".env.test.local"}.`,
	);
	process.exit(1);
}

const supabase = createClient(
	process.env.PUBLIC_SUPABASE_URL,
	process.env.SUPABASE_SERVICE_ROLE_KEY,
	{
		auth: {
			autoRefreshToken: false,
			detectSessionInUrl: false,
			persistSession: false,
		},
		realtime: { transport: WebSocket },
	},
);
const evidenceBucket = "product-submission-evidence";

const preview = async () => {
	const { data, error } = await supabase.rpc(
		"service_preview_catalog_product_purge",
		{ p_barcode: barcode },
	);
	if (error) throw error;
	return data;
};

const getStoragePaths = async () => {
	const { data, error } = await supabase.rpc(
		"service_catalog_product_purge_storage_paths",
		{ p_barcode: barcode },
	);
	if (error) throw error;
	return data ?? [];
};

try {
	const selection = await preview();
	console.log(JSON.stringify(selection, null, 2));
	if (command === "preview") process.exit(0);

	const normalizedConfirmation = normalizeBarcode(confirmation);
	if (normalizedConfirmation !== barcode) {
		throw new Error(
			"Apply requires --confirm with the exact UPC / GTIN shown in the preview.",
		);
	}
	if (!reason || reason.length < 10 || reason.length > 1000) {
		throw new Error("Apply requires --reason with 10 to 1000 characters.");
	}
	if (!selection?.found) {
		throw new Error(
			"No Supabase product records were found for this UPC / GTIN.",
		);
	}
	const storagePaths = await getStoragePaths();

	const { data, error } = await supabase.rpc(
		"service_purge_catalog_product_by_barcode",
		{
			p_barcode: barcode,
			p_confirmation_barcode: normalizedConfirmation,
			p_reason: reason,
		},
	);
	if (error) throw error;

	if (storagePaths.length > 0) {
		const { error: storageError } = await supabase.storage
			.from(evidenceBucket)
			.remove(storagePaths);
		if (storageError) {
			throw new Error(
				`Database purge ${data.purgeId} succeeded, but private Storage cleanup failed: ${storageError.message}. Do not rerun the purge.`,
			);
		}
	}

	const verification = await preview();
	if (verification?.found) {
		throw new Error(
			"The purge returned success, but the verification preview still found related records.",
		);
	}

	console.log(
		JSON.stringify(
			{ ...data, storageObjectsDeleted: storagePaths.length },
			null,
			2,
		),
	);
	console.log(`Verified: no selected Supabase records remain for ${barcode}.`);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
