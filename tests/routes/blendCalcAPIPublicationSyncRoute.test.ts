import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	adminClient: { source: "canonical" },
	getSupabaseAdminClient: vi.fn(),
	synchronize: vi.fn(),
	rollback: vi.fn(),
}));

vi.mock("$env/dynamic/private", () => ({
	env: { CRON_SECRET: "publication-secret" },
}));

vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

vi.mock(
	"$lib/server/blendCalcAPI/publication/blendCalcAPIPublicationSync.server",
	() => ({
		synchronizeBlendCalcAPIPublication: mocks.synchronize,
		rollbackBlendCalcAPIPublication: mocks.rollback,
	}),
);

import {
	GET,
	POST,
} from "../../src/routes/api/internal/blendCalcAPI/publication/sync/+server";

const request = (method: "GET" | "POST", body?: object, authorized = true) =>
	new Request("http://localhost/api/internal/blendCalcAPI/publication/sync", {
		method,
		headers: {
			...(authorized ? { authorization: "Bearer publication-secret" } : {}),
			...(body ? { "content-type": "application/json" } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});

describe("blendCalcAPI publication synchronization route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getSupabaseAdminClient.mockReturnValue(mocks.adminClient);
		mocks.synchronize.mockResolvedValue({
			action: "created",
			generationId: "generation-1",
			catalogHash: "a".repeat(64),
			counts: { products: 6, revisions: 6, categories: 14, attributions: 2 },
		});
		mocks.rollback.mockResolvedValue({
			action: "rolled-back",
			generationId: "generation-0",
			catalogHash: "b".repeat(64),
			counts: { products: 5, revisions: 5, categories: 14, attributions: 2 },
		});
	});

	it("rejects requests without the server-only cron credential", async () => {
		await expect(
			GET({ request: request("GET", undefined, false) } as never),
		).rejects.toMatchObject({ status: 401 });
		expect(mocks.synchronize).not.toHaveBeenCalled();
	});

	it("synchronizes a complete generation from the canonical database", async () => {
		const response = await GET({ request: request("GET") } as never);
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			synchronized: true,
			action: "created",
			counts: { products: 6 },
		});
		expect(mocks.synchronize).toHaveBeenCalledWith(mocks.adminClient);
	});

	it("keeps rollback explicit and separate from routine synchronization", async () => {
		const response = await POST({
			request: request("POST", { action: "rollback" }),
		} as never);
		await expect(response.json()).resolves.toMatchObject({
			action: "rolled-back",
			generationId: "generation-0",
		});
		expect(mocks.rollback).toHaveBeenCalledOnce();
		expect(mocks.synchronize).not.toHaveBeenCalled();
	});
});
