import { describe, it, expect, vi, beforeEach } from "vitest";
const readPage = vi.hoisted(() => vi.fn());
vi.mock("$lib/server/user-data/favorites.server", () => ({
	readFavoriteFoodPage: readPage,
}));
import { GET, POST } from "../../src/routes/api/favorites/+server";
const event = (body: unknown, user = true) => ({
	locals: {
		getVerifiedUser: vi
			.fn()
			.mockResolvedValue(user ? { id: "session-owner" } : null),
		supabase: {
			rpc: vi.fn().mockResolvedValue({ data: "saved", error: null }),
		},
	},
	request: new Request("http://localhost/api/favorites", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	}),
	url: new URL("http://localhost/api/favorites?kind=food&limit=15"),
});
describe("authenticated favorites boundary", () => {
	beforeEach(() => vi.clearAllMocks());
	it("requires a verified session before reading or writing", async () => {
		const input = event({}, false);
		expect((await POST(input as never)).status).toBe(401);
		expect((await GET(input as never)).status).toBe(401);
		expect(input.locals.supabase.rpc).not.toHaveBeenCalled();
	});
	it.each([
		{ kind: "food", targetId: "1", favorite: true },
		{
			kind: "recipe",
			targetId: "06500000-0000-4000-8000-000000000005",
			favorite: false,
		},
	])(
		"passes only the target and desired state to the authoritative RPC: %j",
		async (body) => {
			const input = event({ ...body, userId: "attacker" });
			expect((await POST(input as never)).status).toBe(200);
			expect(input.locals.supabase.rpc).toHaveBeenCalledWith(
				"set_user_favorite",
				{
					p_kind: body.kind,
					p_target_id: body.targetId,
					p_favorite: body.favorite,
				},
			);
		},
	);
	it.each([
		null,
		{},
		{ kind: "food", targetId: "0", favorite: true },
		{ kind: "food", targetId: "1.2", favorite: true },
		{ kind: "food", targetId: "1", favorite: "yes" },
		{ kind: "unknown", targetId: "1", favorite: true },
	])("rejects malformed input %j", async (body) => {
		const input = event(body);
		expect((await POST(input as never)).status).toBe(400);
		expect(input.locals.supabase.rpc).not.toHaveBeenCalled();
	});
	it("does not expose persistence error details", async () => {
		const input = event({ kind: "food", targetId: "1", favorite: true });
		input.locals.supabase.rpc.mockResolvedValue({
			data: null,
			error: { message: "private database detail" },
		} as never);
		const response = await POST(input as never);
		expect(response.status).toBe(503);
		expect(await response.text()).not.toContain("private database detail");
	});
	it("makes unavailable targets indistinguishable", async () => {
		const input = event({ kind: "food", targetId: "1", favorite: true });
		input.locals.supabase.rpc.mockResolvedValue({
			data: "unavailable",
			error: null,
		});
		expect((await POST(input as never)).status).toBe(404);
	});
	it.each([
		"limit=101",
		"limit=0",
		"offset=-1",
		"sort=arbitrary",
		"safety=arbitrary",
	])("rejects page boundaries %s", async (query) => {
		const input = event({});
		input.url = new URL(`http://localhost/api/favorites?kind=food&${query}`);
		expect((await GET(input as never)).status).toBe(400);
		expect(readPage).not.toHaveBeenCalled();
	});
	it("filters current warnings before server counting and pagination", async () => {
		const input = event({});
		input.url = new URL(
			"http://localhost/api/favorites?kind=food&safety=warnings&limit=1&offset=1",
		);
		const warning = {
			fdcId: 1,
			description: "Warning",
			preferenceWarnings: [{ message: "Allergen" }],
		};
		readPage.mockResolvedValueOnce({
			foods: [
				warning,
				{ ...warning, fdcId: 2 },
				{ fdcId: 3, description: "No warning" },
			],
			totalCount: 3,
		});
		const result = await (await GET(input as never)).json();
		expect(result.totalCount).toBe(2);
		expect(result.foods.map((food: { fdcId: number }) => food.fdcId)).toEqual([
			2,
		]);
	});
});
