import type { Cookies } from "@sveltejs/kit";
import { getSafeAuthNextPath } from "$lib/utils/auth/authFlow";

const PASSWORD_UPGRADE_COOKIE = "sm-password-upgrade";
const PASSWORD_UPGRADE_MAX_AGE_SECONDS = 60 * 60;

export const requirePasswordUpgrade = (
	cookies: Cookies,
	next: string,
	secure: boolean,
) => {
	cookies.set(PASSWORD_UPGRADE_COOKIE, getSafeAuthNextPath(next), {
		httpOnly: true,
		maxAge: PASSWORD_UPGRADE_MAX_AGE_SECONDS,
		path: "/",
		sameSite: "lax",
		secure,
	});
};

export const getPasswordUpgradeNext = (cookies: Cookies) => {
	const value = cookies.get(PASSWORD_UPGRADE_COOKIE);
	return value ? getSafeAuthNextPath(value) : null;
};

export const clearPasswordUpgrade = (cookies: Cookies) => {
	cookies.delete(PASSWORD_UPGRADE_COOKIE, { path: "/" });
};
