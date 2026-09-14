import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ownerEmail = "owner@example.com";
const ownerEmailSha256 = createHash("sha256").update(ownerEmail).digest("hex");
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("$env/dynamic/private", () => ({
	env: {
		BLENDCALC_RUNTIME_ENVIRONMENT: "rehearsal",
		BLENDCALC_REHEARSAL_OWNER_PERSONA_ID:
			"11111111-1111-4111-8111-111111111111",
		BLENDCALC_REHEARSAL_OWNER_EMAIL_SHA256:
			"c8cd3c6427301eaf6665bccacd65ddb614527acc843a15463e3faba57124c351",
	},
}));
vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: () => ({ rpc: mocks.rpc }),
}));

import { claimRehearsalOwnerAfterGoogleSignIn } from "../../../../src/lib/server/auth/rehearsalOwnerClaim.server";

const googleUser = (email = ownerEmail) =>
	({
		id: "22222222-2222-4222-8222-222222222222",
		email,
		app_metadata: { provider: "google" },
		identities: [{ provider: "google" }],
	}) as never;

describe("Rehearsal owner claim", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.rpc.mockResolvedValue({ data: true, error: null });
	});

	it("claims the approved owner snapshot only after matching Google identity", async () => {
		await expect(
			claimRehearsalOwnerAfterGoogleSignIn({
				user: googleUser(),
				requestOrigin: "http://localhost:5175",
			}),
		).resolves.toBe(true);
		expect(mocks.rpc).toHaveBeenCalledWith(
			"claim_rehearsal_owner_persona",
			expect.objectContaining({
				p_authenticated_user_id: "22222222-2222-4222-8222-222222222222",
				p_email_sha256: ownerEmailSha256,
				p_expected_persona_id: "11111111-1111-4111-8111-111111111111",
			}),
		);
	});

	it("does not map another Google account onto private owner data", async () => {
		await expect(
			claimRehearsalOwnerAfterGoogleSignIn({
				user: googleUser("someone-else@example.com"),
				requestOrigin: "http://localhost:5175",
			}),
		).resolves.toBe(false);
		expect(mocks.rpc).not.toHaveBeenCalled();
	});

	it("refuses to claim an owner snapshot outside the isolated 5175 app", async () => {
		await expect(
			claimRehearsalOwnerAfterGoogleSignIn({
				user: googleUser(),
				requestOrigin: "http://localhost:5173",
			}),
		).rejects.toThrow("port 5175");
		expect(mocks.rpc).not.toHaveBeenCalled();
	});
});
