import { describe, expect, it, vi } from "vitest";
import {
	getMfaVerificationRoute,
	readMfaSecurityStatus,
	requireElevatedAuthenticatorAssuranceForApi,
	requireElevatedAuthenticatorAssuranceForPage,
} from "$lib/server/auth/mfaAccess.server";

const createSupabase = ({
	currentLevel,
	verifiedFactors = [],
}: {
	currentLevel: "aal1" | "aal2";
	verifiedFactors?: Array<{
		id: string;
		friendly_name?: string;
		created_at: string;
		updated_at: string;
	}>;
}) => ({
	auth: {
		mfa: {
			getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
				data: {
					currentLevel,
					nextLevel: currentLevel === "aal1" ? "aal2" : "aal2",
				},
				error: null,
			}),
			listFactors: vi.fn().mockResolvedValue({
				data: { totp: verifiedFactors, all: verifiedFactors },
				error: null,
			}),
		},
	},
});

describe("privileged MFA access", () => {
	it("maps verified TOTP factors without exposing their secrets", async () => {
		const supabase = createSupabase({
			currentLevel: "aal1",
			verifiedFactors: [{
				id: "factor-1",
				friendly_name: "Primary authenticator",
				created_at: "2026-08-11T00:00:00.000Z",
				updated_at: "2026-08-11T00:01:00.000Z",
			}],
		});

		await expect(readMfaSecurityStatus(supabase as never)).resolves.toEqual({
			currentLevel: "aal1",
			nextLevel: "aal2",
			verifiedTotpFactors: [{
				id: "factor-1",
				friendlyName: "Primary authenticator",
				createdAt: "2026-08-11T00:00:00.000Z",
				updatedAt: "2026-08-11T00:01:00.000Z",
			}],
		});
	});

	it("routes unenrolled users through setup and enrolled users through a challenge", () => {
		expect(getMfaVerificationRoute({
			currentLevel: "aal1",
			nextLevel: "aal2",
			verifiedTotpFactors: [],
		}, "/moderation")).toBe("/auth/mfa/enroll?next=%2Fmoderation");

		expect(getMfaVerificationRoute({
			currentLevel: "aal1",
			nextLevel: "aal2",
			verifiedTotpFactors: [{
				id: "factor-1",
				friendlyName: null,
				createdAt: "2026-08-11T00:00:00.000Z",
				updatedAt: "2026-08-11T00:00:00.000Z",
			}],
		}, "//outside.example")).toBe("/auth/mfa/challenge?next=%2F");
	});

	it("redirects an AAL1 page session to MFA", async () => {
		const supabase = createSupabase({ currentLevel: "aal1" });

		await expect(
			requireElevatedAuthenticatorAssuranceForPage(
				supabase as never,
				"/moderation",
			),
		).rejects.toMatchObject({
			status: 303,
			location: "/auth/mfa/enroll?next=%2Fmoderation",
		});
	});

	it("blocks an AAL1 API session with the stable MFA issue code", async () => {
		const supabase = createSupabase({ currentLevel: "aal1" });

		await expect(
			requireElevatedAuthenticatorAssuranceForApi(supabase as never),
		).rejects.toMatchObject({
			status: 403,
			body: expect.objectContaining({ code: "MFA_REQUIRED" }),
		});
	});

	it("allows protected access only after the session reaches AAL2", async () => {
		const supabase = createSupabase({ currentLevel: "aal2" });

		await expect(
			requireElevatedAuthenticatorAssuranceForApi(supabase as never),
		).resolves.toMatchObject({ currentLevel: "aal2" });
	});
});
