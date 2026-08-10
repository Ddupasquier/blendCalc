import { beforeEach, describe, expect, it, vi } from "vitest";
import { moderatorDataHealthFixture } from "../fixtures/moderatorDataHealth";

const mocks = vi.hoisted(() => ({
  requireModeratorAccess: vi.fn(),
  readModeratorDataHealth: vi.fn(),
}));

vi.mock("$lib/server/moderation/moderationAccess.server", () => ({
  requireModeratorAccess: mocks.requireModeratorAccess,
}));

vi.mock("$lib/server/moderation/catalogDataHealth.server", () => ({
  readModeratorDataHealth: mocks.readModeratorDataHealth,
}));

import { load } from "../../src/routes/moderation/data-health/+page.server";

describe("moderator data-health page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires moderator access before loading the bounded dashboard", async () => {
    mocks.requireModeratorAccess.mockResolvedValue({
      user: { id: "moderator-id" },
      role: "moderator",
    });
    mocks.readModeratorDataHealth.mockResolvedValue(moderatorDataHealthFixture);
    const supabase = {};

    await expect(load({ locals: { supabase } } as never)).resolves.toEqual({
      viewerRole: "moderator",
      dashboard: moderatorDataHealthFixture,
    });
    expect(mocks.requireModeratorAccess).toHaveBeenCalledWith(
      expect.anything(),
      "/moderation/data-health",
    );
    expect(mocks.readModeratorDataHealth).toHaveBeenCalledWith(supabase);
  });

  it("does not read dashboard data when the access guard fails", async () => {
    mocks.requireModeratorAccess.mockRejectedValue({ status: 403 });

    await expect(
      load({ locals: { supabase: {} } } as never),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.readModeratorDataHealth).not.toHaveBeenCalled();
  });

  it("passes the developer role through to the privileged dashboard", async () => {
    mocks.requireModeratorAccess.mockResolvedValue({
      user: { id: "developer-id" },
      role: "developer",
    });
    mocks.readModeratorDataHealth.mockResolvedValue(moderatorDataHealthFixture);

    await expect(load({ locals: { supabase: {} } } as never)).resolves.toEqual({
      viewerRole: "developer",
      dashboard: moderatorDataHealthFixture,
    });
  });
});
