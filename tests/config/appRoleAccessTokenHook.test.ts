import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = readFileSync("supabase/config.toml", "utf8");
const migration = readFileSync(
	"supabase/migrations/20260801101000_supabase_auth_rbac.sql",
	"utf8",
);

const readTomlSection = (name: string) =>
	config.match(
		new RegExp(
			`\\[${name.replaceAll(".", "\\.")}\\]\\n([\\s\\S]*?)(?=\\n\\[|$)`,
		),
	)?.[1] ?? "";

describe("application-role access token hook", () => {
	it("enables the local Supabase Auth hook", () => {
		expect(config).toContain("[auth.hook.custom_access_token]");
		expect(config).toContain("enabled = true");
		expect(config).toContain(
			'uri = "pg-functions://postgres/public/custom_access_token_hook"',
		);
	});

	it("enables the database-owned blocked-signup hook", () => {
		expect(config).toContain("[auth.hook.before_user_created]");
		expect(config).toContain(
			'uri = "pg-functions://postgres/public/reject_blocked_signup"',
		);
	});

	it("keeps hosted and local Auth callbacks explicit", () => {
		expect(config).toContain('site_url = "https://blendcalc.vercel.app"');
		expect(config).toContain(
			'"https://blendcalc.vercel.app/auth/callback"',
		);
		expect(config).toContain('"http://localhost:5173/auth/callback"');
		expect(config).toContain(
			'"https://*-dylan-dupasquiers-projects.vercel.app/auth/callback"',
		);
	});

	it("preserves the hardened hosted Auth settings", () => {
		expect(readTomlSection("auth")).toContain("minimum_password_length = 15");
		expect(readTomlSection("auth.email")).toContain("enable_confirmations = true");
		expect(readTomlSection("auth.email")).toContain("secure_password_change = true");
		expect(readTomlSection("auth.email")).toContain('max_frequency = "60s"');
		expect(readTomlSection("auth.email")).toContain("otp_length = 8");
		expect(readTomlSection("auth.mfa.totp")).toContain("enroll_enabled = true");
		expect(readTomlSection("auth.mfa.totp")).toContain("verify_enabled = true");
	});

	it("keeps role assignments database-owned and fails closed", () => {
		expect(migration).toContain("from public.app_role_assignments");
		expect(migration).toContain("claims := claims - 'app_role'");
		expect(migration).toContain("'user'::public.app_role");
		expect(migration).toContain("security definer");
		expect(migration).toContain("set search_path = ''");
	});

	it("exposes the hook only to Supabase Auth", () => {
		expect(migration).toContain("to supabase_auth_admin");
		expect(migration).toContain(
			"from public, anon, authenticated, service_role",
		);
	});

	it("keeps permissions database-backed and role changes atomic", () => {
		expect(migration).toContain("create table public.app_role_permissions");
		expect(migration).toContain("public.authorize_app_permission");
		expect(migration).toContain("public.set_app_user_role");
		expect(migration).toContain("insert into public.moderation_actions");
	});
});
