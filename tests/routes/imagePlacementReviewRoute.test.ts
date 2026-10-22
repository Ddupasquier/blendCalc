import { beforeEach, describe, expect, it, vi } from "vitest";
const access = vi.hoisted(() => ({ requireModeratorPermission: vi.fn() }));
vi.mock("$lib/server/moderation/moderationAccess.server", () => access);
import {
	actions,
	load,
} from "../../src/routes/profile/privileged-tools/image-placement/+page.server";

const imageId = "13010000-0000-4000-8000-000000000001";
const createEvent = (
	fields: Record<string, string> = {},
	result = { data: {}, error: null as unknown },
) => {
	const rpc = vi.fn().mockResolvedValue(result);
	return {
		rpc,
		event: {
			locals: { supabase: { rpc } },
			url: new URL(
				"http://localhost:5174/profile/privileged-tools/image-placement",
			),
			request: new Request(
				"http://localhost:5174/profile/privileged-tools/image-placement?/review",
				{
					method: "POST",
					body: new URLSearchParams(fields),
				},
			),
		},
	};
};
describe("image placement moderator workspace", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		access.requireModeratorPermission.mockResolvedValue({
			user: { id: "moderator" },
		});
	});
	it("requires the existing catalog-review permission for loading", async () => {
		const { event, rpc } = createEvent();
		await load(event as never);
		expect(access.requireModeratorPermission).toHaveBeenCalledWith(
			event.locals,
			"moderation.catalog.review",
			"/profile/privileged-tools/image-placement",
		);
		expect(rpc).toHaveBeenCalledWith("get_food_image_placement_workspace", {
			p_image_id: undefined,
		});
	});
	it("does not reach data after an access or MFA rejection", async () => {
		const { event, rpc } = createEvent();
		access.requireModeratorPermission.mockRejectedValue({ status: 403 });
		await expect(load(event as never)).rejects.toMatchObject({ status: 403 });
		expect(rpc).not.toHaveBeenCalled();
	});
	it("publishes a reviewed proposal with its exact current revision through the user RPC", async () => {
		const { event, rpc } = createEvent({
			action: "approve",
			imageId,
			revision: "2",
			suggestionId: imageId,
		});
		await actions.review(event as never);
		expect(access.requireModeratorPermission).toHaveBeenCalled();
		expect(rpc).toHaveBeenCalledWith(
			"review_food_image_placement",
			expect.objectContaining({
				p_action: "approve",
				p_revision: 2,
				p_image_id: imageId,
			}),
		);
	});
	it("publishes a moderator adjustment with exact image and revision through the existing protected RPC", async () => {
		const placement = {
			cropX: 55,
			cropY: 50,
			cropZoom: 1.5,
			fitMode: "custom",
			rotationDegrees: 0,
			placementVersion: 2,
		};
		const { event, rpc } = createEvent({
			action: "publish",
			imageId,
			imageUrl: "https://example.com/food.jpg",
			revision: "2",
			placement: JSON.stringify(placement),
		});
		expect(await actions.review(event as never)).toEqual({
			success: "Shared image updated.",
		});
		expect(rpc).toHaveBeenCalledWith("publish_food_image_placement", {
			p_image_id: imageId,
			p_image_url: "https://example.com/food.jpg",
			p_revision: 2,
			p_placement: placement,
		});
	});
	it.each(["", "null", "[]", "not json"])(
		"rejects malformed publish geometry %s before a write",
		async (placement) => {
			const { event, rpc } = createEvent({
				action: "publish",
				imageId,
				imageUrl: "https://example.com/food.jpg",
				revision: "2",
				placement,
			});
			expect(await actions.review(event as never)).toMatchObject({
				status: 400,
			});
			expect(rpc).not.toHaveBeenCalled();
		},
	);
	it("does not publish after an access or MFA rejection", async () => {
		const { event, rpc } = createEvent({
			action: "publish",
			imageId,
			revision: "2",
			imageUrl: "https://example.com/food.jpg",
			placement: "{}",
		});
		access.requireModeratorPermission.mockRejectedValue({ status: 403 });
		await expect(actions.review(event as never)).rejects.toMatchObject({
			status: 403,
		});
		expect(rpc).not.toHaveBeenCalled();
	});
	it("rejects empty rejection reasons before a write", async () => {
		const { event, rpc } = createEvent({
			action: "reject",
			imageId,
			revision: "2",
			suggestionId: imageId,
			note: " ",
		});
		expect(await actions.review(event as never)).toMatchObject({ status: 400 });
		expect(rpc).not.toHaveBeenCalled();
	});
	it.each([
		["40001", 409],
		["42501", 403],
		["22023", 400],
		["P0002", 404],
		["unknown", 503],
	] as const)(
		"handles %s without exposing private diagnostics",
		async (code, status) => {
			const { event } = createEvent(
				{ action: "lock", imageId, revision: "2", enabled: "true" },
				{ data: {}, error: { code, message: "private SQL" } },
			);
			expect(await actions.review(event as never)).toMatchObject({
				status,
				data: { error: expect.not.stringContaining("private SQL") },
			});
		},
	);
});
