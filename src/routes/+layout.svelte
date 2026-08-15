<script lang="ts">
	import { browser, dev } from "$app/environment";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { onMount } from "svelte";
	import "../app.scss";
	import AppHeader from "$lib/components/app/AppHeader/AppHeader.svelte";
	import DailyWelcome from "$lib/components/app/DailyWelcome/DailyWelcome.svelte";
	import TabNavigation from "$lib/components/app/TabNavigation/TabNavigation.svelte";
	import TutorialOverlay from "$lib/components/app/TutorialOverlay/TutorialOverlay.svelte";
	import ThemeSynchronizer from "$lib/components/app/ThemeSynchronizer/ThemeSynchronizer.svelte";
	import {
		APP_DESCRIPTION,
		APP_SOCIAL_PREVIEW_ALT,
		APP_SOCIAL_PREVIEW_URL,
	} from "$lib/config/brand";
	import { APP_BUILD_VERSION, APP_VERSION } from "$lib/config/version";
	import { LIGHT_THEME_COLOR } from "$lib/utils/theme/themePreference";
	import {
		getAppDocumentTitle,
		getCanonicalAppUrl,
	} from "$lib/config/pageMetadata";
	import {
		clearObsoleteAppStorage,
		setActiveStorageUserId,
	} from "$lib/utils/storage/client/storageScope";
	import { saveTutorialCompletion } from "$lib/utils/tutorial/tutorialClient";
	import { configureServingMeasureCatalog } from "$lib/utils/serving/servingMeasureCatalog";
	import { configureNutritionCompletenessCatalog } from "$lib/utils/food/quality/nutritionCompletenessCatalog";
	import { configureAppReferenceCatalog } from "$lib/utils/food/reference/appReferenceCatalog";
	import { injectAnalytics } from "@vercel/analytics/sveltekit";
	import { track } from "@vercel/analytics/sveltekit";
	import { injectSpeedInsights } from "@vercel/speed-insights/sveltekit";
	import { APP_INTERACTION_METRICS } from "$lib/utils/analytics/appInteractionMetrics";
	import type { AppLayoutProps } from "./types";

	const redactObservabilityUrl = <Event extends { url: string }>(
		event: Event,
	): Event => {
		const url = new URL(event.url);
		url.search = "";
		url.hash = "";
		return { ...event, url: url.toString() };
	};
	const isVercelObservabilityAvailable =
		browser && window.location.hostname.endsWith(".vercel.app");

	if (!dev && isVercelObservabilityAvailable) {
		injectAnalytics({
			mode: "production",
			debug: false,
			beforeSend: redactObservabilityUrl,
		});
		injectSpeedInsights({
			debug: false,
			beforeSend: redactObservabilityUrl,
		});
	}

	onMount(() => {
		if (dev || !isVercelObservabilityAvailable) return;
		const navigationEntry = performance.getEntriesByType(
			"navigation",
		)[0] as PerformanceNavigationTiming | undefined;
		if (navigationEntry?.type === "reload") {
			track(APP_INTERACTION_METRICS.PAGE_RELOAD);
		}
	});

	onMount(() => {
		document.documentElement.dataset.appReady = "true";
		return () => {
			delete document.documentElement.dataset.appReady;
		};
	});

	let {
		children,
		data,
	}: AppLayoutProps = $props();

	let tutorialOpen = $state(page.url.pathname === "/profile/tutorial");
	let tutorialUserId = $state<string | null>(null);
	let tutorialMode = $state<"onboarding" | "replay">(
		page.url.pathname === "/profile/tutorial" ? "replay" : "onboarding",
	);
	let tutorialReplayActive = $state(
		page.url.pathname === "/profile/tutorial",
	);
	const appViewShellRoute = $derived(
		Boolean(data.authUser) &&
			(page.url.pathname === "/mix" ||
				page.url.pathname.startsWith("/mix/") ||
				page.url.pathname === "/ingredients/fridge" ||
				page.url.pathname.startsWith("/ingredients/fridge/") ||
				page.url.pathname === "/ingredients/shopping" ||
				page.url.pathname.startsWith("/ingredients/shopping/") ||
				page.url.pathname === "/saved" ||
				page.url.pathname.startsWith("/saved/") ||
				page.url.pathname === "/profile" ||
				page.url.pathname.startsWith("/profile/")),
	);
	const tutorialRouteOpen = $derived(page.url.pathname === "/profile/tutorial");
	const tutorialVisible = $derived(tutorialOpen || tutorialRouteOpen);
	const documentTitle = $derived(getAppDocumentTitle(page.url));
	const canonicalUrl = $derived(getCanonicalAppUrl(page.url));

	$effect.pre(() => {
		configureServingMeasureCatalog(data.servingMeasureCatalog);
		configureNutritionCompletenessCatalog(data.nutritionCompletenessCatalog);
		configureAppReferenceCatalog(data.appReferenceCatalog);
	});

	const navigateTutorial = async (href: string) => {
		await goto(href, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	};

	const finishTutorial = async () => {
		if (!data.authUser) return false;

		if (tutorialMode === "replay") {
			tutorialOpen = false;
			await goto("/profile", { replaceState: true });
			return true;
		}

		const saved = await saveTutorialCompletion();
		if (!saved) return false;
		tutorialOpen = false;
		return true;
	};

	$effect(() => {
		const nextUserId = data.authUser?.id ?? null;
		if (nextUserId === tutorialUserId) return;

		tutorialUserId = nextUserId;
		if (tutorialRouteOpen) {
			tutorialMode = "replay";
			tutorialReplayActive = true;
			tutorialOpen = true;
		} else {
			tutorialMode = "onboarding";
			tutorialOpen = data.authUser?.showTutorial ?? false;
		}
	});

	$effect(() => {
		if (tutorialRouteOpen && !tutorialReplayActive) {
			tutorialReplayActive = true;
			tutorialMode = "replay";
			tutorialOpen = true;
		} else if (!tutorialRouteOpen && !tutorialOpen) {
			tutorialReplayActive = false;
		}
	});

	$effect.pre(() => {
		setActiveStorageUserId(data.authUser?.id ?? null);
		if (data.authUser) {
			clearObsoleteAppStorage();
		}
	});
</script>

<svelte:head>
	<title>{documentTitle}</title>
	<meta
		name="description"
		content={APP_DESCRIPTION}
	/>
	<meta name="theme-color" content={LIGHT_THEME_COLOR} />
	<meta name="application-version" content={APP_VERSION} />
	<meta name="application-build" content={APP_BUILD_VERSION} />
	<link rel="icon" type="image/svg+xml" sizes="any" href="/favicon.ico" />
	<link rel="shortcut icon" href="/favicon.ico" />
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:title" content={documentTitle} />
	<meta
		property="og:description"
		content={APP_DESCRIPTION}
	/>
	<meta property="og:image" content={APP_SOCIAL_PREVIEW_URL} />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={APP_SOCIAL_PREVIEW_ALT} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={documentTitle} />
	<meta
		name="twitter:description"
		content={APP_DESCRIPTION}
	/>
	<meta name="twitter:image" content={APP_SOCIAL_PREVIEW_URL} />
	<meta name="twitter:image:alt" content={APP_SOCIAL_PREVIEW_ALT} />
</svelte:head>

<ThemeSynchronizer preference={data.themePreference} />

{#if data.authUser}
	<AppHeader
		displayName={data.authUser.displayName}
		avatarUrl={data.authUser.avatarUrl}
		avatarAltText={data.authUser.avatarAltText}
		role={data.authUser.role}
	/>
	<TabNavigation />
	{#if !tutorialVisible}
		<DailyWelcome
			userId={data.authUser.id}
			name={data.authUser.welcomeName}
		/>
	{/if}
		<TutorialOverlay
			open={tutorialVisible}
			mode={tutorialMode}
			pathname={page.url.pathname}
			onNavigate={navigateTutorial}
			onFinish={finishTutorial}
		/>
{/if}

<main
	class="app-main"
	class:app-main--guest={!data.authUser}
	class:app-main--authed={data.authUser}
	class:app-main--view-shell={appViewShellRoute}
>
	{@render children()}
</main>
