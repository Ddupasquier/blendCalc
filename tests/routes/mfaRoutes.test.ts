import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requireMfaAuthenticatedUser: vi.fn(),
}));

vi.mock("$lib/server/auth/mfaAccess.server", async (importOriginal) => {
	const original = await importOriginal<
		typeof import("$lib/server/auth/mfaAccess.server")
	>();
	return {
		...original,
		requireMfaAuthenticatedUser: mocks.requireMfaAuthenticatedUser,
	};
});

import {
	actions as enrollmentActions,
	load as loadEnrollment,
} from "../../src/routes/auth/mfa/enroll/+page.server";
import {
	actions as challengeActions,
	load as loadChallenge,
} from "../../src/routes/auth/mfa/challenge/+page.server";

const createStatus = ({
	currentLevel = "aal1",
	factors = [],
}: {
	currentLevel?: "aal1" | "aal2";
	factors?: Array<{
		id: string;
		friendlyName: string | null;
		createdAt: string;
		updatedAt: string;
	}>;
} = {}) => ({
	currentLevel,
	nextLevel: "aal2" as const,
	verifiedTotpFactors: factors,
});

const verifiedFactor = {
	id: "verified-factor",
	friendlyName: "Primary authenticator",
	createdAt: "2026-08-11T00:00:00.000Z",
	updatedAt: "2026-08-11T00:01:00.000Z",
};

const createRequest = (fields: Record<string, string>) => {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) formData.set(key, value);
	return new Request("http://localhost:5173/auth/mfa", {
		method: "POST",
		body: formData,
	});
};

describe("MFA browser routes", () => {
	beforeEach(() => vi.clearAllMocks());

	it("sends an already-enrolled AAL1 user to the authenticator challenge", async () => {
		mocks.requireMfaAuthenticatedUser.mockResolvedValue({
			user: { id: "moderator-id" },
			status: createStatus({ factors: [verifiedFactor] }),
		});

		await expect(loadEnrollment({
			locals: {},
			url: new URL("http://localhost:5173/auth/mfa/enroll?next=/moderation"),
			setHeaders: vi.fn(),
		} as never)).rejects.toMatchObject({
			status: 303,
			location: "/auth/mfa/challenge?next=%2Fmoderation",
		});
	});

	it("creates one private TOTP setup payload after removing stale setup factors", async () => {
		mocks.requireMfaAuthenticatedUser.mockResolvedValue({
			user: { id: "moderator-id" },
			status: createStatus(),
		});
		const unenroll = vi.fn().mockResolvedValue({ data: {}, error: null });
		const qrCodeDataUrl =
			"data:image/svg+xml;utf-8,%3Csvg%3Eprivate%20QR%3C%2Fsvg%3E";
		const authenticatorUri =
			"otpauth://totp/blendCalc%3Amoderator%40example.com" +
			"?secret=PRIVATESETUPKEY&issuer=blendCalc";
		const enroll = vi.fn().mockResolvedValue({
			data: {
				id: "new-factor",
				totp: {
					qr_code: qrCodeDataUrl,
					secret: "PRIVATESETUPKEY",
					uri: authenticatorUri,
				},
			},
			error: null,
		});
		const locals = {
			supabase: {
				auth: {
					mfa: {
						listFactors: vi.fn().mockResolvedValue({
							data: {
								all: [{
									id: "stale-factor",
									factor_type: "totp",
									status: "unverified",
								}],
							},
							error: null,
						}),
						unenroll,
						enroll,
					},
				},
			},
		};

		const result = await enrollmentActions.beginEnrollment({
			locals,
			request: createRequest({}),
			url: new URL("http://localhost:5173/auth/mfa/enroll?next=/moderation"),
		} as never);

		expect(unenroll).toHaveBeenCalledWith({ factorId: "stale-factor" });
		expect(enroll).toHaveBeenCalledWith({
			factorType: "totp",
			friendlyName: "blendCalc authenticator",
			issuer: "blendCalc",
		});
		expect(result).toMatchObject({
			next: "/moderation",
			enrollment: {
				factorId: "new-factor",
				qrCodeDataUrl: expect.stringMatching(
					/^data:image\/svg\+xml;base64,/,
				),
				secret: "PRIVATESETUPKEY",
			},
		});
		if (!result || !("enrollment" in result)) {
			throw new Error("Expected authenticator enrollment data.");
		}
		expect(result.enrollment.qrCodeDataUrl).not.toBe(qrCodeDataUrl);
	});

	it("removes the pending factor when Supabase returns invalid setup data", async () => {
		mocks.requireMfaAuthenticatedUser.mockResolvedValue({
			user: { id: "moderator-id" },
			status: createStatus(),
		});
		const unenroll = vi.fn().mockResolvedValue({ data: {}, error: null });
		const locals = {
			supabase: {
				auth: {
					mfa: {
						listFactors: vi.fn().mockResolvedValue({
							data: { all: [] },
							error: null,
						}),
						unenroll,
						enroll: vi.fn().mockResolvedValue({
							data: {
								id: "invalid-factor",
								totp: {
									qr_code: "data:image/svg+xml;utf-8,invalid",
									secret: "EXPECTEDSECRET",
									uri: "otpauth://totp/blendCalc%3Amoderator" +
										"?secret=DIFFERENTSECRET&issuer=blendCalc",
								},
							},
							error: null,
						}),
					},
				},
			},
		};

		const result = await enrollmentActions.beginEnrollment({
			locals,
			request: createRequest({}),
			url: new URL("http://localhost:5173/auth/mfa/enroll?next=/moderation"),
		} as never);

		expect(unenroll).toHaveBeenCalledWith({ factorId: "invalid-factor" });
		expect(result).toMatchObject({
			status: 503,
			data: {
				message: "We couldn’t prepare the setup code. Try starting setup again.",
				next: "/moderation",
			},
		});
	});

	it("loads only a server-verified factor into the challenge", async () => {
		mocks.requireMfaAuthenticatedUser.mockResolvedValue({
			user: { id: "moderator-id" },
			status: createStatus({ factors: [verifiedFactor] }),
		});

		await expect(loadChallenge({
			locals: {},
			url: new URL("http://localhost:5173/auth/mfa/challenge?next=/moderation"),
			setHeaders: vi.fn(),
		} as never)).resolves.toEqual({
			next: "/moderation",
			factorId: "verified-factor",
			factorName: "Primary authenticator",
		});
	});

	it("rejects an unrecognized factor before asking Supabase to verify a code", async () => {
		mocks.requireMfaAuthenticatedUser.mockResolvedValue({
			user: { id: "moderator-id" },
			status: createStatus({ factors: [verifiedFactor] }),
		});
		const challengeAndVerify = vi.fn();

		const result = await challengeActions.default({
			locals: { supabase: { auth: { mfa: { challengeAndVerify } } } },
			request: createRequest({
				factorId: "attacker-factor",
				next: "/moderation",
				code: "123456",
			}),
			url: new URL("http://localhost:5173/auth/mfa/challenge?next=/moderation"),
		} as never);

		expect(result).toMatchObject({ status: 400 });
		expect(challengeAndVerify).not.toHaveBeenCalled();
	});

	it("returns to the protected internal route after a valid challenge", async () => {
		mocks.requireMfaAuthenticatedUser.mockResolvedValue({
			user: { id: "moderator-id" },
			status: createStatus({ factors: [verifiedFactor] }),
		});
		const challengeAndVerify = vi.fn().mockResolvedValue({
			data: {},
			error: null,
		});

		await expect(challengeActions.default({
			locals: { supabase: { auth: { mfa: { challengeAndVerify } } } },
			request: createRequest({
				factorId: "verified-factor",
				next: "/moderation",
				code: "123456",
			}),
			url: new URL("http://localhost:5173/auth/mfa/challenge?/default"),
		} as never)).rejects.toMatchObject({
			status: 303,
			location: "/moderation",
		});
		expect(challengeAndVerify).toHaveBeenCalledWith({
			factorId: "verified-factor",
			code: "123456",
		});
	});

	it("normalizes a formatted authenticator code during enrollment", async () => {
		mocks.requireMfaAuthenticatedUser.mockResolvedValue({
			user: { id: "moderator-id" },
			status: createStatus(),
		});
		const challengeAndVerify = vi.fn().mockResolvedValue({
			data: {},
			error: null,
		});
		const locals = {
			supabase: {
				auth: {
					mfa: {
						listFactors: vi.fn().mockResolvedValue({
							data: {
								all: [{
									id: "pending-factor",
									factor_type: "totp",
									status: "unverified",
								}],
							},
							error: null,
						}),
						challengeAndVerify,
					},
				},
			},
		};

		await expect(enrollmentActions.verifyEnrollment({
			locals,
			request: createRequest({
				factorId: "pending-factor",
				next: "/moderation",
				code: "123 456",
			}),
			url: new URL("http://localhost:5173/auth/mfa/enroll?/verifyEnrollment"),
		} as never)).rejects.toMatchObject({
			status: 303,
			location: "/moderation",
		});
		expect(challengeAndVerify).toHaveBeenCalledWith({
			factorId: "pending-factor",
			code: "123456",
		});
	});

	it("does not verify a factor that is already enrolled through the setup action", async () => {
		mocks.requireMfaAuthenticatedUser.mockResolvedValue({
			user: { id: "moderator-id" },
			status: createStatus(),
		});
		const challengeAndVerify = vi.fn();
		const result = await enrollmentActions.verifyEnrollment({
			locals: {
				supabase: {
					auth: {
						mfa: {
							listFactors: vi.fn().mockResolvedValue({
								data: {
									all: [{
										id: "verified-factor",
										factor_type: "totp",
										status: "verified",
									}],
								},
								error: null,
							}),
							challengeAndVerify,
						},
					},
				},
			},
			request: createRequest({
				factorId: "verified-factor",
				code: "123456",
			}),
			url: new URL("http://localhost:5173/auth/mfa/enroll?next=/moderation"),
		} as never);

		expect(result).toMatchObject({ status: 400 });
		expect(challengeAndVerify).not.toHaveBeenCalled();
	});
});
