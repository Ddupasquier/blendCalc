import { describe, expect, it, vi } from "vitest";
import {
	isCatalogMonitorSchemaUnavailable,
	readCatalogDataOperationsHealth,
	readCatalogMonitorModerationSummary,
} from "$lib/server/moderation/catalogDataOperations.server";
import { createUnavailableCatalogMonitorModerationSummary } from "$lib/utils/moderation/catalogMonitorModeration";
import { catalogDataOperationsHealthFixture } from "../../../fixtures/catalogDataOperationsHealth";
import { catalogMonitorModerationFixture } from "../../../fixtures/catalogMonitorModeration";

describe("catalog data-operations repository", () => {
	it("requests a bounded aggregate through the caller's authenticated client", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: catalogDataOperationsHealthFixture,
			error: null,
		});

		await expect(readCatalogDataOperationsHealth({ rpc } as never))
			.resolves.toEqual(catalogDataOperationsHealthFixture);
		expect(rpc).toHaveBeenCalledWith("get_catalog_data_operations_health", {
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
			"get_catalog_data_operations_monitor_summary",
			{ p_limit: 20 },
		);
	});

	it("keeps the existing data-health view usable while the monitor migration rolls out", async () => {
		const missingFunctionError = {
			code: "PGRST202",
			message:
				"Could not find the function public.get_catalog_data_operations_monitor_summary in the schema cache",
		};
		await expect(readCatalogMonitorModerationSummary({
			rpc: vi.fn().mockResolvedValue({ data: null, error: missingFunctionError }),
		} as never)).resolves.toEqual(
			createUnavailableCatalogMonitorModerationSummary(),
		);
		expect(isCatalogMonitorSchemaUnavailable({
			code: "42501",
			message: "permission denied for function get_catalog_data_operations_monitor_summary",
		})).toBe(false);
	});

	it("returns the approved moderation error for database or contract failures", async () => {
		await expect(readCatalogDataOperationsHealth({
			rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "failed" } }),
		} as never)).rejects.toMatchObject({ status: 502 });

		await expect(readCatalogDataOperationsHealth({
			rpc: vi.fn().mockResolvedValue({ data: {}, error: null }),
		} as never)).rejects.toMatchObject({ status: 502 });
	});
});
