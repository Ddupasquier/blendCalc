export const PROFILE_SETTINGS_ROUTES = {
	appearance: "appearance",
	details: "details",
	image: "image",
	foodPreferences: "food-preferences",
	moderatorActions: "moderator-actions",
} as const;

export type ProfileSettingsRoute =
	(typeof PROFILE_SETTINGS_ROUTES)[keyof typeof PROFILE_SETTINGS_ROUTES];

const PROFILE_BASE_PATH = "/profile";

const PROFILE_SETTINGS_ROUTE_TITLES: Record<ProfileSettingsRoute, string> = {
	[PROFILE_SETTINGS_ROUTES.appearance]: "Light/Dark Mode",
	[PROFILE_SETTINGS_ROUTES.details]: "Profile Details",
	[PROFILE_SETTINGS_ROUTES.image]: "Profile Image",
	[PROFILE_SETTINGS_ROUTES.foodPreferences]: "Food Preferences",
	[PROFILE_SETTINGS_ROUTES.moderatorActions]: "Moderator Actions",
};

export const getProfileSettingsRoute = (
	pathname: string,
): ProfileSettingsRoute | null => {
	const routeSegment = pathname.split("/").filter(Boolean)[1];
	return Object.values(PROFILE_SETTINGS_ROUTES).includes(
		routeSegment as ProfileSettingsRoute,
	)
		? (routeSegment as ProfileSettingsRoute)
		: null;
};

export const getProfileSettingsRouteHref = (
	settingsRoute: ProfileSettingsRoute,
) => `${PROFILE_BASE_PATH}/${settingsRoute}`;

export const getProfileSettingsRouteTitle = (
	pathname: string,
) => {
	const settingsRoute = getProfileSettingsRoute(pathname);
	return settingsRoute
		? PROFILE_SETTINGS_ROUTE_TITLES[settingsRoute]
		: "Profile";
};
