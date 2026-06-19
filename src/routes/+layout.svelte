<script lang="ts">
	import { dev } from "$app/environment";
	import favicon from "$lib/assets/favicon.svg";
	import "../app.scss";
	import DailyWelcome from "$lib/components/app/DailyWelcome.svelte";
	import TabNavigation from "$lib/components/app/TabNavigation.svelte";
	import TutorialOverlay from "$lib/components/app/TutorialOverlay.svelte";
	import { userFoodPreferences } from "$lib/stores/userFoodPreferences";
	import {
		clearLegacyAppStorage,
		setActiveStorageUserId,
	} from "$lib/utils/storage/storageScope";
	import { saveTutorialChoice } from "$lib/utils/tutorial/tutorial";
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
	let signingOut = $state(false);

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
		userFoodPreferences.set(data.foodPreferences ?? null);

		if (data.authUser) {
			clearLegacyAppStorage();
		}
	});
</script>

<svelte:head>
	<title>Smoothie Mixer</title>
	<meta
		name="description"
		content="Build, compare, and save smoothie recipes with nutrition goals, ingredient amounts, custom foods, and visual nutrient tracking."
	/>
	<meta name="theme-color" content="#5f564f" />
	<link rel="icon" href={favicon} />
	<link rel="canonical" href="https://smoothie-mixer.vercel.app/" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://smoothie-mixer.vercel.app/" />
	<meta property="og:title" content="Smoothie Mixer" />
	<meta
		property="og:description"
		content="Build, compare, and save smoothie recipes with nutrition goals, ingredient amounts, custom foods, and visual nutrient tracking."
	/>
	<meta
		property="og:image"
		content="https://smoothie-mixer.vercel.app/og-image.png"
	/>
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta
		property="og:image:alt"
		content="Smoothie Mixer nutrition graph preview"
	/>
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Smoothie Mixer" />
	<meta
		name="twitter:description"
		content="Build, compare, and save smoothie recipes with nutrition goals, ingredient amounts, custom foods, and visual nutrient tracking."
	/>
	<meta
		name="twitter:image"
		content="https://smoothie-mixer.vercel.app/og-image.png"
	/>
	<meta
		name="twitter:image:alt"
		content="Smoothie Mixer nutrition graph preview"
	/>
</svelte:head>

{#if data.authUser}
	<header class="app-header">
		<span class="logo">🥤 Smoothie Mixer</span>
		<div class="auth-status">
			{#if data.authUser.role}
				<a class="moderation-link" href="/moderation" aria-label="Open moderation tools">
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M12 3 5 6v5c0 4.4 2.8 8.3 7 10 4.2-1.7 7-5.6 7-10V6l-7-3Z" />
						<path d="m9 12 2 2 4-5" />
					</svg>
				</a>
			{/if}
			<button
				class="tutorial-link"
				type="button"
				aria-label="Open app tutorial"
				title="App tutorial"
				onclick={() => (tutorialOpen = true)}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<circle cx="12" cy="12" r="9" />
					<path d="M12 10v6M12 7.5h.01" />
				</svg>
			</button>
			<a
				class="profile-link"
				href="/profile"
				aria-label={`Open profile for ${data.authUser.displayName}`}
			>
				{#if data.authUser.avatarUrl}
					<img
						src={data.authUser.avatarUrl}
						alt={data.authUser.avatarAltText ?? ""}
					/>
				{:else}
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />
					</svg>
				{/if}
			</a>
			<form method="POST" action="/auth/logout" onsubmit={() => (signingOut = true)}>
				<button type="submit" disabled={signingOut}>
					{signingOut ? "Signing out…" : "Sign out"}
				</button>
			</form>
		</div>
	</header>
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

<main class="app-main" class:app-main--guest={!data.authUser}>
	{@render children()}
</main>
