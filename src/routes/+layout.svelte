<script lang="ts">
	import { dev } from "$app/environment";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import favicon from "$lib/assets/favicon.svg";
	import "../app.scss";
	import AppHeader from "$lib/components/app/AppHeader/AppHeader.svelte";
	import DailyWelcome from "$lib/components/app/DailyWelcome/DailyWelcome.svelte";
	import TabNavigation from "$lib/components/app/TabNavigation/TabNavigation.svelte";
	import TutorialOverlay from "$lib/components/app/TutorialOverlay/TutorialOverlay.svelte";
	import ThemeController from "$lib/components/app/ThemeController/ThemeController.svelte";
	import {
		APP_DESCRIPTION,
		APP_NUTRITION_PREVIEW_ALT,
		APP_OG_IMAGE_URL,
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
	import type { TutorialChoice } from "$lib/utils/tutorial/tutorial";
	import { saveTutorialChoice } from "$lib/utils/tutorial/tutorialClient";
	import { configureServingMeasureCatalog } from "$lib/utils/serving/servingMeasureCatalog";
	import { configureNutritionCompletenessCatalog } from "$lib/utils/food/quality/nutritionCompletenessCatalog";
	import { configureAppReferenceCatalog } from "$lib/utils/food/reference/appReferenceCatalog";
	import { injectSpeedInsights } from "@vercel/speed-insights/sveltekit";
	import type { AppLayoutProps } from "./types";

	if (!dev) {
		injectSpeedInsights({
			debug: false,
			scriptSrc: "/_vercel/speed-insights/script.js",
			endpoint: "/_vercel/speed-insights/vitals",
			beforeSend: (event) => {
				const url = new URL(event.url);
				url.search = "";
				url.hash = "";
				return { ...event, url: url.toString() };
			},
		});
	}

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
	const ingredientsRoute = $derived(
		Boolean(data.authUser) &&
			(page.url.pathname === "/fridge" ||
				page.url.pathname.startsWith("/fridge/")),
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

	const finishTutorial = async (choice: TutorialChoice) => {
		if (!data.authUser) return false;

		if (tutorialMode === "replay") {
			tutorialOpen = false;
			await goto("/profile", { replaceState: true });
			return true;
		}

		const saved = await saveTutorialChoice(choice);
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
	<link rel="icon" href={favicon} />
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:title" content={documentTitle} />
	<meta
		property="og:description"
		content={APP_DESCRIPTION}
	/>
	<meta property="og:image" content={APP_OG_IMAGE_URL} />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={APP_NUTRITION_PREVIEW_ALT} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={documentTitle} />
	<meta
		name="twitter:description"
		content={APP_DESCRIPTION}
	/>
	<meta name="twitter:image" content={APP_OG_IMAGE_URL} />
	<meta name="twitter:image:alt" content={APP_NUTRITION_PREVIEW_ALT} />
</svelte:head>

<ThemeController preference={data.themePreference} />

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
	class:app-main--ingredients={ingredientsRoute}
>
	{@render children()}
</main>
