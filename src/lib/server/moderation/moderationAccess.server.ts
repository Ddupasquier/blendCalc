import {
  requireAppValue,
  throwAppError,
} from "$lib/server/errors/appError.server";
import {
  getUserAppRole,
  isModerationAppRole,
  type AppRole,
} from "$lib/utils/moderation/moderation";
import type { VerifiedAuthUser } from "$lib/utils/auth/types";
import { redirect } from "@sveltejs/kit";

export type ModeratorAccess = {
  user: VerifiedAuthUser;
  role: AppRole;
};

export const requireModeratorAccess = async (
  locals: App.Locals,
  returnPath = "/moderation",
): Promise<ModeratorAccess> => {
  const user = await locals.getVerifiedUser();
  if (!user) {
    throw redirect(303, `/auth?next=${encodeURIComponent(returnPath)}`);
  }

  const role = requireAppValue(
    await getUserAppRole(locals.supabase, user.id),
    403,
    "ACCESS_DENIED",
  );
  if (!isModerationAppRole(role)) {
    throwAppError(403, "ACCESS_DENIED");
  }

  return { user, role };
};
