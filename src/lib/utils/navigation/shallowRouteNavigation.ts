import {
	pushState,
	replaceState as replaceNavigationState,
} from "$app/navigation";
import {
	createShallowRoutePageState,
	type ShallowRoutePageStateKey,
} from "$lib/utils/navigation/shallowRouteState";

type NavigateShallowRouteOptions = {
	href: string;
	pageState: App.PageState;
	routeStateKey: ShallowRoutePageStateKey;
	replace?: boolean;
};

export const navigateShallowRoute = ({
	href,
	pageState,
	routeStateKey,
	replace = false,
}: NavigateShallowRouteOptions) => {
	const nextPageState = createShallowRoutePageState(
		pageState,
		routeStateKey,
		href,
	);

	if (replace) {
		replaceNavigationState(href, nextPageState);
		return;
	}

	pushState(href, nextPageState);
};
