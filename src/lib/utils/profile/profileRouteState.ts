export const PROFILE_SETTINGS_ROUTES = {
	appearance: "appearance",
	playfulMessages: "playful-messages",
	details: "details",
	image: "image",
	foodPreferences: "food-preferences",
	privilegedTools: "privileged-tools",
	privilegedProductSubmissions: "privileged-tools/product-submissions",
	privilegedFoodWarningReports: "privileged-tools/food-warning-reports",
	privilegedProfileImages: "privileged-tools/profile-images",
	privilegedAccountAccess: "privileged-tools/account-access",
	privilegedCatalogDataHealth: "privileged-tools/catalog-data-health",
} as const;

export type ProfileSettingsRoute =
	(typeof PROFILE_SETTINGS_ROUTES)[keyof typeof PROFILE_SETTINGS_ROUTES];

const PROFILE_BASE_PATH = "/profile";

const PROFILE_SETTINGS_ROUTE_TITLES: Record<ProfileSettingsRoute, string> = {
	[PROFILE_SETTINGS_ROUTES.appearance]: "Light/Dark Mode",
	[PROFILE_SETTINGS_ROUTES.playfulMessages]: "Playful Messages",
	[PROFILE_SETTINGS_ROUTES.details]: "Profile Details",
	[PROFILE_SETTINGS_ROUTES.image]: "Profile Image",
	[PROFILE_SETTINGS_ROUTES.foodPreferences]: "Food Preferences",
	[PROFILE_SETTINGS_ROUTES.privilegedTools]: "Privileged Tools",
	[PROFILE_SETTINGS_ROUTES.privilegedProductSubmissions]: "Product Submissions",
	[PROFILE_SETTINGS_ROUTES.privilegedFoodWarningReports]: "Food Warning Reports",
	[PROFILE_SETTINGS_ROUTES.privilegedProfileImages]: "Profile Image Reviews",
	[PROFILE_SETTINGS_ROUTES.privilegedAccountAccess]: "Account Access",
	[PROFILE_SETTINGS_ROUTES.privilegedCatalogDataHealth]: "Catalog Data Health",
};

export const getProfileSettingsRoute = (
	pathname: string,
): ProfileSettingsRoute | null => {
	const routeSegment = pathname.split("/").filter(Boolean).slice(1).join("/");
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
