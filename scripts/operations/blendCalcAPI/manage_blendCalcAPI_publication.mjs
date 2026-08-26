/**
 * Purpose: Review blendCalcAPI correction/rights concerns and place, release, or resolve
 * reversible publication holds without deleting canonical products, revisions, images,
 * or evidence. This is a privileged hosted operation requiring service-role credentials
 * and an elevated actor email in `.env.moderation.local`.
 * Run: `npm run blendCalcAPI:publication -- list`
 * List: `npm run blendCalcAPI:publication -- list`
 * Hold: `npm run blendCalcAPI:publication -- hold product 00021130493609 rights-review --actor-email=moderator@example.com --public-message="Temporarily unavailable while publication rights are reviewed." --internal-note="Rights-holder report received."`
 * Release: `npm run blendCalcAPI:publication -- release <hold-uuid> --actor-email=moderator@example.com --note="Evidence reviewed; publication may resume."`
 * Resolve: `npm run blendCalcAPI:publication -- resolve <concern-uuid> resolved publication-hold --actor-email=moderator@example.com --note="Placed a publication hold."`
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.moderation.local", quiet: true });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const [command, ...positionals] = process.argv
	.slice(2)
	.filter((argument) => !argument.startsWith("--"));
const options = new Map(
	process.argv
		.slice(2)
		.filter((argument) => argument.startsWith("--") && argument.includes("="))
		.map((argument) => {
			const [key, ...valueParts] = argument.slice(2).split("=");
			return [key, valueParts.join("=").trim()];
		}),
);

const usage = () => {
	console.error(`Usage:
  npm run blendCalcAPI:publication -- list
  npm run blendCalcAPI:publication -- hold <product|image|dataset|source> <reference> <reason> --actor-email=<email> --public-message=<message> --internal-note=<note> [--concern-id=<uuid>]
  npm run blendCalcAPI:publication -- release <hold-uuid> --actor-email=<email> --note=<note>
  npm run blendCalcAPI:publication -- resolve <concern-uuid> <resolved|dismissed> <action> --actor-email=<email> --note=<note>

Hold reasons: accuracy-review, rights-review, attribution-review, privacy-review, source-retirement, legal-request
Resolution actions: product-correction, image-correction, source-policy-correction, publication-hold, no-change`);
};

if (command === "help" || command === "--help" || command === "-h") {
	usage();
	process.exit(0);
}

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error(
		"Add PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.moderation.local.",
	);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
	auth: {
		autoRefreshToken: false,
		detectSessionInUrl: false,
		persistSession: false,
	},
});
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUBJECT_TYPES = new Set(["product", "image", "dataset", "source"]);
const HOLD_REASONS = new Set([
	"accuracy-review",
	"rights-review",
	"attribution-review",
	"privacy-review",
	"source-retirement",
	"legal-request",
]);
const RESOLUTION_ACTIONS = new Set([
	"product-correction",
	"image-correction",
	"source-policy-correction",
	"publication-hold",
	"no-change",
]);
const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

const normalizeGtin = (value) => {
	const digits = value.replace(/\D/g, "");
	if (!GTIN_LENGTHS.has(digits.length)) return null;
	const suppliedCheckDigit = Number(digits.at(-1));
	const sum = [...digits.slice(0, -1)]
		.reverse()
		.reduce(
			(total, digit, index) =>
				total + Number(digit) * (index % 2 === 0 ? 3 : 1),
			0,
		);
	if ((10 - (sum % 10)) % 10 !== suppliedCheckDigit) return null;
	return digits.padStart(14, "0");
};

const getActor = async () => {
	const email = options.get("actor-email")?.toLowerCase();
	if (!email)
		throw new Error("Provide --actor-email=<elevated-account-email>.");
	for (let page = 1; page <= 100; page += 1) {
		const { data, error } = await supabase.auth.admin.listUsers({
			page,
			perPage: 1000,
		});
		if (error) throw error;
		const user = data.users.find(
			(candidate) => candidate.email?.toLowerCase() === email,
		);
		if (user) {
			const { data: role, error: roleError } = await supabase
				.from("app_role_assignments")
				.select("role")
				.eq("user_id", user.id)
				.in("role", ["moderator", "admin", "developer"])
				.maybeSingle();
			if (roleError) throw roleError;
			if (!role)
				throw new Error(`${email} does not have an elevated application role.`);
			return user;
		}
		if (data.users.length < 1000) break;
	}
	throw new Error(`No Supabase Auth user found for ${email}.`);
};

const resolveSubject = async (subjectType, reference) => {
	const lookup = {
		product: ["shared_products", "barcode", "shared_product_id", "id"],
		image: ["food_image_assets", "id", "food_image_asset_id", "id"],
		dataset: ["generic_food_datasets", "key", "dataset_key", "key"],
		source: ["product_data_sources", "key", "source_key", "key"],
	}[subjectType];
	if (!lookup) return null;
	const [table, referenceColumn, targetColumn, selectedColumn] = lookup;
	const normalizedReference =
		subjectType === "product" ? normalizeGtin(reference) : reference.trim();
	if (!normalizedReference) return null;
	const { data, error } = await supabase
		.from(table)
		.select(selectedColumn)
		.eq(referenceColumn, normalizedReference)
		.maybeSingle();
	if (error) throw error;
	return data
		? { targetColumn, targetValue: data[selectedColumn], normalizedReference }
		: null;
};

const listQueue = async () => {
	const [
		{ data: concerns, error: concernError },
		{ data: holds, error: holdError },
	] = await Promise.all([
		supabase
			.from("blendcalc_api_publication_concerns")
			.select(
				"id, urgency, reporter_type, concern_type, subject_type, subject_reference, status, created_at",
			)
			.in("status", ["open", "triaged"])
			.order("urgency", { ascending: false })
			.order("created_at", { ascending: true })
			.limit(100),
		supabase
			.from("blendcalc_api_publication_holds")
			.select("id, subject_type, reason_code, public_message, placed_at")
			.is("released_at", null)
			.order("placed_at", { ascending: false })
			.limit(100),
	]);
	if (concernError) throw concernError;
	if (holdError) throw holdError;
	console.log("Open publication concerns:");
	console.table(concerns ?? []);
	console.log("Active publication holds:");
	console.table(holds ?? []);
};

const placeHold = async () => {
	const [subjectType, reference, reasonCode] = positionals;
	if (
		!SUBJECT_TYPES.has(subjectType) ||
		!HOLD_REASONS.has(reasonCode) ||
		!reference
	) {
		usage();
		process.exitCode = 1;
		return;
	}
	const publicMessage = options.get("public-message")?.trim();
	const internalNote = options.get("internal-note")?.trim();
	if (!publicMessage || !internalNote) {
		throw new Error("Provide both --public-message and --internal-note.");
	}
	const actor = await getActor();
	const subject = await resolveSubject(subjectType, reference);
	if (!subject) throw new Error(`No ${subjectType} matched ${reference}.`);
	const readExistingHold = () =>
		supabase
			.from("blendcalc_api_publication_holds")
			.select("id")
			.eq("subject_type", subjectType)
			.eq(subject.targetColumn, subject.targetValue)
			.is("released_at", null)
			.maybeSingle();
	const { data: existingHold, error: existingHoldError } =
		await readExistingHold();
	if (existingHoldError) throw existingHoldError;
	if (existingHold) {
		console.log(
			`Publication hold ${existingHold.id} is already active on ${subjectType} ${subject.normalizedReference}.`,
		);
		return;
	}
	const { data, error } = await supabase
		.from("blendcalc_api_publication_holds")
		.insert({
			subject_type: subjectType,
			[subject.targetColumn]: subject.targetValue,
			reason_code: reasonCode,
			public_message: publicMessage,
			internal_note: internalNote,
			concern_id: options.get("concern-id") || null,
			placed_by: actor.id,
		})
		.select("id")
		.single();
	if (error?.code === "23505") {
		const { data: concurrentHold, error: concurrentHoldError } =
			await readExistingHold();
		if (concurrentHoldError) throw concurrentHoldError;
		if (concurrentHold) {
			console.log(
				`Publication hold ${concurrentHold.id} is already active on ${subjectType} ${subject.normalizedReference}.`,
			);
			return;
		}
	}
	if (error) throw error;
	console.log(
		`Placed publication hold ${data.id} on ${subjectType} ${subject.normalizedReference}.`,
	);
};

const releaseHold = async () => {
	const [holdId] = positionals;
	const note = options.get("note")?.trim();
	if (!UUID_PATTERN.test(holdId ?? "") || !note)
		throw new Error("Provide a valid hold UUID and --note.");
	const actor = await getActor();
	const { data, error } = await supabase
		.from("blendcalc_api_publication_holds")
		.update({
			released_by: actor.id,
			released_at: new Date().toISOString(),
			release_note: note,
		})
		.eq("id", holdId)
		.is("released_at", null)
		.select("id")
		.maybeSingle();
	if (error) throw error;
	if (!data) throw new Error("No active hold matched that UUID.");
	console.log(`Released publication hold ${holdId}.`);
};

const resolveConcern = async () => {
	const [concernId, status, resolutionAction] = positionals;
	const note = options.get("note")?.trim();
	if (
		!UUID_PATTERN.test(concernId ?? "") ||
		!new Set(["resolved", "dismissed"]).has(status) ||
		!RESOLUTION_ACTIONS.has(resolutionAction) ||
		!note
	) {
		usage();
		process.exitCode = 1;
		return;
	}
	if (status === "dismissed" && resolutionAction !== "no-change") {
		throw new Error(
			"Dismissed concerns must use the no-change resolution action.",
		);
	}
	const actor = await getActor();
	const { data, error } = await supabase
		.from("blendcalc_api_publication_concerns")
		.update({
			status,
			resolution_action: resolutionAction,
			resolution_note: note,
			reviewed_by: actor.id,
			reviewed_at: new Date().toISOString(),
		})
		.eq("id", concernId)
		.in("status", ["open", "triaged"])
		.select("id")
		.maybeSingle();
	if (error) throw error;
	if (!data) throw new Error("No unresolved concern matched that UUID.");
	console.log(
		`${status === "resolved" ? "Resolved" : "Dismissed"} publication concern ${concernId}.`,
	);
};

try {
	if (command === "list") await listQueue();
	else if (command === "hold") await placeHold();
	else if (command === "release") await releaseHold();
	else if (command === "resolve") await resolveConcern();
	else {
		usage();
		process.exitCode = 1;
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
