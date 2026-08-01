import { describe, expect, it, vi } from "vitest";
import { readModeratorDataHealth } from "$lib/server/moderation/catalogDataHealth.server";
import { moderatorDataHealthFixture } from "../../../fixtures/moderatorDataHealth";

describe("moderator catalog data-health repository", () => {
	it("requests a bounded aggregate through the caller's authenticated client", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: moderatorDataHealthFixture,
			error: null,
		});

		await expect(readModeratorDataHealth({ rpc } as never))
			.resolves.toEqual(moderatorDataHealthFixture);
		expect(rpc).toHaveBeenCalledWith("get_moderator_data_health", {
			p_days: 30,
			p_issue_limit: 20,
		});
	});

	it("returns the approved moderation error for database or contract failures", async () => {
		await expect(readModeratorDataHealth({
			rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "failed" } }),
		} as never)).rejects.toMatchObject({ status: 502 });

		await expect(readModeratorDataHealth({
			rpc: vi.fn().mockResolvedValue({ data: {}, error: null }),
		} as never)).rejects.toMatchObject({ status: 502 });
	});
});
