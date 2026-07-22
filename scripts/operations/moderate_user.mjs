import { createHash } from "node:crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

config({ path: ".env.moderation.local", quiet: true });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const [command, rawEmail, value] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase();

const usage = () => {
	console.error(`Usage:
  npm run moderate -- role user@example.com moderator
  npm run moderate -- role user@example.com admin
  npm run moderate -- role user@example.com none
  npm run moderate -- ban user@example.com profile_image_policy_violation
  npm run moderate -- unban user@example.com moderator_reversal`);
};

if (!supabaseUrl || !serviceRoleKey) {
	console.error(
		"Add PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.moderation.local.",
	);
	process.exit(1);
}

if (!command || !email) {
	usage();
	process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
	auth: {
		autoRefreshToken: false,
		detectSessionInUrl: false,
		persistSession: false,
	},
	realtime: {
		transport: WebSocket,
	},
});

const findUserByEmail = async () => {
	for (let page = 1; page <= 100; page += 1) {
		const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
		if (error) throw error;
		const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
		if (user) return user;
		if (data.users.length < 1000) break;
	}
	throw new Error(`No Supabase Auth user found for ${email}.`);
};

const recordAction = async (userId, action, reasonCode) => {
	const { error } = await supabase.from("moderation_actions").insert({
		target_user_id: userId,
		actor_user_id: null,
		action,
		reason_code: reasonCode,
		internal_note: "Executed through the local moderation CLI.",
	});
	if (error) throw error;
};

const setRole = async (user) => {
	if (!new Set(["moderator", "admin", "none"]).has(value)) {
		throw new Error("Role must be moderator, admin, or none.");
	}

	if (value === "none") {
		const { error } = await supabase
			.from("app_role_assignments")
			.delete()
			.eq("user_id", user.id);
		if (error) throw error;
		await recordAction(user.id, "role_revoked", "cli_role_change");
		console.log(`Removed the elevated role from ${email}.`);
		return;
	}

	const { error } = await supabase.from("app_role_assignments").upsert({
		user_id: user.id,
		role: value,
		granted_by: null,
	});
	if (error) throw error;
	await recordAction(user.id, "role_granted", `cli_${value}`);
	console.log(`Assigned ${value} to ${email}.`);
};

const banUser = async (user) => {
	const reason = value || "terms_violation";
	const { error: authError } = await supabase.auth.admin.updateUserById(user.id, {
		ban_duration: "876000h",
	});
	if (authError) throw authError;

	const { error: statusError } = await supabase.from("account_moderation").upsert({
		user_id: user.id,
		status: "banned",
		public_reason: "This account was blocked for violating the community rules.",
		expires_at: null,
		moderated_by: null,
	});
	if (statusError) throw statusError;

	const emailHash = createHash("sha256").update(email).digest("hex");
	const { error: blocklistError } = await supabase.from("blocked_signup_emails").upsert({
		email_hash: emailHash,
		source_user_id: user.id,
		blocked_by: null,
		reason,
		expires_at: null,
	});
	if (blocklistError) throw blocklistError;

	await recordAction(user.id, "ban", reason);
	console.log(`Blocked ${email} from the app and future signup with that email.`);
};

const unbanUser = async (user) => {
	const { error: authError } = await supabase.auth.admin.updateUserById(user.id, {
		ban_duration: "none",
	});
	if (authError) throw authError;

	const { error: statusError } = await supabase.from("account_moderation").upsert({
		user_id: user.id,
		status: "active",
		public_reason: null,
		expires_at: null,
		moderated_by: null,
	});
	if (statusError) throw statusError;

	const { error: blocklistError } = await supabase
		.from("blocked_signup_emails")
		.delete()
		.eq("source_user_id", user.id);
	if (blocklistError) throw blocklistError;

	await recordAction(user.id, "unban", value || "cli_reversal");
	console.log(`Restored access for ${email}.`);
};

try {
	const user = await findUserByEmail();
	if (command === "role") await setRole(user);
	else if (command === "ban") await banUser(user);
	else if (command === "unban") await unbanUser(user);
	else {
		usage();
		process.exitCode = 1;
	}
} catch (moderationError) {
	console.error(moderationError instanceof Error ? moderationError.message : moderationError);
	process.exitCode = 1;
}
