import { beforeEach, describe, expect, it, vi } from "vitest";
import { moderatorDataHealthFixture } from "../fixtures/moderatorDataHealth";
import { catalogMonitorModerationFixture } from "../fixtures/catalogMonitorModeration";

const mocks = vi.hoisted(() => ({
  requireModeratorPermission: vi.fn(),
  readModeratorDataHealth: vi.fn(),
  readCatalogMonitorModerationSummary: vi.fn(),
}));

vi.mock("$lib/server/moderation/moderationAccess.server", () => ({
  requireModeratorPermission: mocks.requireModeratorPermission,
}));

vi.mock("$lib/server/moderation/catalogDataHealth.server", () => ({
  readModeratorDataHealth: mocks.readModeratorDataHealth,
  readCatalogMonitorModerationSummary: mocks.readCatalogMonitorModerationSummary,
}));

import { load } from "../../src/routes/moderation/data-health/+page.server";

describe("moderator data-health page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires moderator access before loading the bounded dashboard", async () => {
    mocks.requireModeratorPermission.mockResolvedValue({
      user: { id: "moderator-id" },
      role: "moderator",
	  permissions: ["moderation.data_health.read"],
    });
    mocks.readModeratorDataHealth.mockResolvedValue(moderatorDataHealthFixture);
	mocks.readCatalogMonitorModerationSummary.mockResolvedValue(catalogMonitorModerationFixture);
    const supabase = {};

    await expect(load({ locals: { supabase } } as never)).resolves.toEqual({
      viewerRole: "moderator",
      dashboard: moderatorDataHealthFixture,
	  catalogMonitor: catalogMonitorModerationFixture,
    });
    expect(mocks.requireModeratorPermission).toHaveBeenCalledWith(
      expect.anything(),
	  "moderation.data_health.read",
      "/moderation/data-health",
    );
    expect(mocks.readModeratorDataHealth).toHaveBeenCalledWith(supabase);
	expect(mocks.readCatalogMonitorModerationSummary).toHaveBeenCalledWith(supabase);
  });

  it("does not read dashboard data when the access guard fails", async () => {
    mocks.requireModeratorPermission.mockRejectedValue({ status: 403 });

    await expect(
      load({ locals: { supabase: {} } } as never),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.readModeratorDataHealth).not.toHaveBeenCalled();
	expect(mocks.readCatalogMonitorModerationSummary).not.toHaveBeenCalled();
  });

  it("passes the developer role through to the privileged dashboard", async () => {
    mocks.requireModeratorPermission.mockResolvedValue({
      user: { id: "developer-id" },
      role: "developer",
	  permissions: ["moderation.data_health.read"],
    });
    mocks.readModeratorDataHealth.mockResolvedValue(moderatorDataHealthFixture);
	mocks.readCatalogMonitorModerationSummary.mockResolvedValue(catalogMonitorModerationFixture);

    await expect(load({ locals: { supabase: {} } } as never)).resolves.toEqual({
      viewerRole: "developer",
      dashboard: moderatorDataHealthFixture,
	  catalogMonitor: catalogMonitorModerationFixture,
    });
  });
});
