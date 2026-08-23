import { describe, expect, it, vi } from "vitest";
import { runCatalogHealthRepair } from "$lib/server/moderation/catalogHealthRepair.server";
import { catalogHealthRepairDryRunFixture } from "../../../fixtures/catalogHealthRepair";

describe("catalog health repair repository", () => {
	it("runs a bounded dry run through the authenticated database client", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: catalogHealthRepairDryRunFixture,
			error: null,
		});

		await expect(runCatalogHealthRepair({ rpc } as never, {
			occurrenceKey: "product:issue:nutrients",
			apply: false,
			dryRunId: null,
		})).resolves.toEqual(catalogHealthRepairDryRunFixture);
		expect(rpc).toHaveBeenCalledWith("run_catalog_health_repair", {
			p_occurrence_key: "product:issue:nutrients",
			p_apply: false,
			p_dry_run_id: undefined,
		});
	});

	it("classifies stale issues and apply attempts without leaking database errors", async () => {
		await expect(runCatalogHealthRepair({
			rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "P0002" } }),
		} as never, {
			occurrenceKey: "closed-issue",
			apply: false,
			dryRunId: null,
		})).rejects.toMatchObject({ reason: "issue_unavailable" });

		await expect(runCatalogHealthRepair({
			rpc: vi.fn().mockResolvedValue({
				data: null,
				error: { message: "A current successful dry run is required" },
			}),
		} as never, {
			occurrenceKey: "issue",
			apply: true,
			dryRunId: "b1000000-0000-4000-8000-000000000001",
		})).rejects.toMatchObject({ reason: "dry_run_required" });
	});

	it("rejects malformed database responses", async () => {
		await expect(runCatalogHealthRepair({
			rpc: vi.fn().mockResolvedValue({ data: {}, error: null }),
		} as never, {
			occurrenceKey: "issue",
			apply: false,
			dryRunId: null,
		})).rejects.toMatchObject({ reason: "service_unavailable" });
	});
});
