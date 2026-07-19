<script lang="ts">
	import { dev } from "$app/environment";
	import { page } from "$app/state";
	import favicon from "$lib/assets/favicon.svg";
	import "../app.scss";
	import AppHeader from "$lib/components/app/AppHeader.svelte";
	import DailyWelcome from "$lib/components/app/DailyWelcome.svelte";
	import TabNavigation from "$lib/components/app/TabNavigation.svelte";
	import TutorialOverlay from "$lib/components/app/TutorialOverlay.svelte";
	import {
		APP_DESCRIPTION,
		APP_NAME,
		APP_NUTRITION_PREVIEW_ALT,
		APP_OG_IMAGE_URL,
		APP_PRODUCTION_ORIGIN,
	} from "$lib/config/brand";
	import type { FoodPreferenceProfile } from "$lib/utils/profile/foodPreferenceProfile";
	import { setFoodPreferenceContext } from "$lib/utils/profile/foodPreferenceContext.svelte";
	import {
		clearLegacyAppStorage,
		setActiveStorageUserId,
	} from "$lib/utils/storage/client/storageScope";
	import { saveTutorialChoice } from "$lib/utils/tutorial/tutorial";
	import { configureServingMeasureCatalog } from "$lib/utils/serving/servingMeasureCatalog";
	import { configureNutritionCompletenessCatalog } from "$lib/utils/food/quality/nutritionCompletenessCatalog";
	import type { LayoutData } from "./$types";
	import { injectSpeedInsights } from "@vercel/speed-insights/sveltekit";

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
	}: {
		children: import("svelte").Snippet;
		data: LayoutData;
	} = $props();

	let tutorialOpen = $state(false);
	let tutorialUserId = $state<string | null>(null);
	let foodPreferenceContext: { current: FoodPreferenceProfile | null } = $state({
		current: null,
	});
	const ingredientsRoute = $derived(
		Boolean(data.authUser) &&
			(page.url.pathname === "/fridge" ||
				page.url.pathname.startsWith("/fridge/")),
	);
	setFoodPreferenceContext(foodPreferenceContext);

	$effect.pre(() => {
		configureServingMeasureCatalog(data.servingMeasureCatalog);
		configureNutritionCompletenessCatalog(data.nutritionCompletenessCatalog);
	});

	const recordTutorialChoice = async (choice: "later" | "never") => {
		if (!data.authUser) return false;

		const saved = await saveTutorialChoice(data.authUser.id, choice);
		if (saved) tutorialOpen = false;
		return saved;
	};

	$effect(() => {
		const nextUserId = data.authUser?.id ?? null;
		if (nextUserId === tutorialUserId) return;

		tutorialUserId = nextUserId;
		tutorialOpen = data.authUser?.showTutorial ?? false;
	});

	$effect.pre(() => {
		setActiveStorageUserId(data.authUser?.id ?? null);
		foodPreferenceContext.current = data.foodPreferences ?? null;

		if (data.authUser) {
			clearLegacyAppStorage();
		}
	});
</script>

<svelte:head>
	<title>{APP_NAME}</title>
	<meta
		name="description"
		content={APP_DESCRIPTION}
	/>
	<meta name="theme-color" content="#5f564f" />
	<link rel="icon" href={favicon} />
	<link rel="canonical" href={`${APP_PRODUCTION_ORIGIN}/`} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={`${APP_PRODUCTION_ORIGIN}/`} />
	<meta property="og:title" content={APP_NAME} />
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
	<meta name="twitter:title" content={APP_NAME} />
	<meta
		name="twitter:description"
		content={APP_DESCRIPTION}
	/>
	<meta name="twitter:image" content={APP_OG_IMAGE_URL} />
	<meta name="twitter:image:alt" content={APP_NUTRITION_PREVIEW_ALT} />
</svelte:head>

{#if data.authUser}
	<AppHeader
		displayName={data.authUser.displayName}
		avatarUrl={data.authUser.avatarUrl}
		avatarAltText={data.authUser.avatarAltText}
		role={data.authUser.role}
	/>
	<TabNavigation />
	{#if !tutorialOpen}
		<DailyWelcome
			userId={data.authUser.id}
			name={data.authUser.welcomeName}
		/>
	{/if}
	<TutorialOverlay
		open={tutorialOpen}
		onRemindLater={() => recordTutorialChoice("later")}
		onDontShowAgain={() => recordTutorialChoice("never")}
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
