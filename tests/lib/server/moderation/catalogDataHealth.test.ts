import { describe, expect, it, vi } from "vitest";
import {
	isCatalogMonitorSchemaUnavailable,
	readCatalogMonitorModerationSummary,
	readModeratorDataHealth,
} from "$lib/server/moderation/catalogDataHealth.server";
import { createUnavailableCatalogMonitorModerationSummary } from "$lib/utils/moderation/catalogMonitorModeration";
import { moderatorDataHealthFixture } from "../../../fixtures/moderatorDataHealth";
import { catalogMonitorModerationFixture } from "../../../fixtures/catalogMonitorModeration";

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

	it("reads and validates the bounded catalog monitor moderation summary", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: catalogMonitorModerationFixture,
			error: null,
		});

		await expect(readCatalogMonitorModerationSummary({ rpc } as never))
			.resolves.toEqual(catalogMonitorModerationFixture);
		expect(rpc).toHaveBeenCalledWith(
			"get_catalog_monitor_moderation_summary",
			{ p_limit: 20 },
		);
	});

	it("keeps the existing data-health view usable while the monitor migration rolls out", async () => {
		const missingFunctionError = {
			code: "PGRST202",
			message:
				"Could not find the function public.get_catalog_monitor_moderation_summary in the schema cache",
		};
		await expect(readCatalogMonitorModerationSummary({
			rpc: vi.fn().mockResolvedValue({ data: null, error: missingFunctionError }),
		} as never)).resolves.toEqual(
			createUnavailableCatalogMonitorModerationSummary(),
		);
		expect(isCatalogMonitorSchemaUnavailable({
			code: "42501",
			message: "permission denied for function get_catalog_monitor_moderation_summary",
		})).toBe(false);
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
