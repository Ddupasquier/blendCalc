/**
 * Purpose: Perform privileged local user operations by email: grant/revoke moderator or
 * admin roles, ban an account, or reverse a ban while recording moderation audit rows.
 * This writes Auth and moderation tables and requires service-role credentials.
 * Role example: `npm run moderate -- role user@example.com moderator`
 * Ban example: `npm run moderate -- ban user@example.com terms_violation`
 */

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

const setRole = async (user) => {
	if (!new Set(["moderator", "admin", "none"]).has(value)) {
		throw new Error("Role must be moderator, admin, or none.");
	}

	const nextRole = value === "none" ? "user" : value;
	const { data: changed, error } = await supabase.rpc("set_app_user_role", {
		p_target_user_id: user.id,
		p_role: nextRole,
		p_actor_user_id: null,
		p_reason_code: value === "none" ? "cli_role_revoke" : `cli_role_${value}`,
		p_internal_note: "Executed through the local moderation CLI.",
	});
	if (error) throw error;
	if (!changed) {
		console.log(`${email} already has the requested role.`);
		return;
	}
	console.log(
		value === "none"
			? `Removed the elevated role from ${email}.`
			: `Assigned ${value} to ${email}.`,
	);
	console.log(
		"The affected user must refresh their session or sign in again before the JWT role claim changes.",
	);
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
