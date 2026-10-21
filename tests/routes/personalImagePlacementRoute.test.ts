import { describe, expect, it, vi } from "vitest";
import { POST } from "../../src/routes/api/food-images/placement/+server";

const imageId = "13010000-0000-4000-8000-000000000001";
const body = {
	imageId,
	imageUrl: "https://example.com/image.png",
	action: "personal",
	placement: {
		cropX: 50,
		cropY: 50,
		cropZoom: 1,
		rotationDegrees: 0,
		fitMode: "contain",
	},
};
const event = (
	value: unknown = body,
	signedIn = true,
	result = { data: { status: "personal_saved" }, error: null as unknown },
) => {
	const rpc = vi.fn().mockResolvedValue(result);
	return {
		rpc,
		input: {
			locals: {
				getVerifiedUser: vi
					.fn()
					.mockResolvedValue(signedIn ? { id: "owner" } : null),
				supabase: { rpc },
			},
			request: new Request("http://localhost:5174/api/food-images/placement", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(value),
			}),
		},
	};
};
describe("account image placement API", () => {
	it("uses the authenticated RPC for an ordinary account without moderator or MFA access", async () => {
		const { input, rpc } = event({
			...body,
			userId: "someone-else",
			approvedBy: "forged",
		});
		const response = await POST(input as never);
		expect(response?.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith("save_food_image_placement", {
			p_image_id: imageId,
			p_image_url: body.imageUrl,
			p_action: "personal",
			p_placement: body.placement,
			p_base_revision: undefined,
		});
		expect(response?.headers.get("Cache-Control")).toBe("private, no-store");
	});
	it("rejects anonymous writes before reaching the database", async () => {
		const { input, rpc } = event(body, false);
		await expect(POST(input as never)).rejects.toMatchObject({ status: 401 });
		expect(rpc).not.toHaveBeenCalled();
	});
	it.each([
		null,
		{ ...body, imageId: "invalid" },
		{ ...body, action: "publish" },
		{ ...body, action: "suggest" },
		{ ...body, action: "suggest", baseRevision: -1 },
		{ ...body, action: "suggest", baseRevision: 0.5 },
	])("rejects malformed or privileged requests %#", async (value) => {
		const { input, rpc } = event(value);
		await expect(POST(input as never)).rejects.toMatchObject({ status: 400 });
		expect(rpc).not.toHaveBeenCalled();
	});
	it("passes the exact shared revision for a suggestion", async () => {
		const { input, rpc } = event({
			...body,
			action: "suggest",
			baseRevision: 4,
		});
		await POST(input as never);
		expect(rpc).toHaveBeenCalledWith(
			"save_food_image_placement",
			expect.objectContaining({ p_action: "suggest", p_base_revision: 4 }),
		);
	});
	it.each([
		["42501", 403],
		["P0002", 404],
		["22023", 400],
		["unexpected", 503],
	] as const)("maps %s without leaking SQL details", async (code, status) => {
		const { input } = event(body, true, {
			data: { status: "personal_saved" },
			error: { code, message: "private diagnostic" },
		});
		await expect(POST(input as never)).rejects.toMatchObject({ status });
	});
});
