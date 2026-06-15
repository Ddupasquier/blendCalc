<script lang="ts">
	import { dev } from "$app/environment";
	import favicon from "$lib/assets/favicon.svg";
	import { injectSpeedInsights } from "@vercel/speed-insights/sveltekit";
	import "../app.scss";
	import type { LayoutData } from "./$types";

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

	let signingOut = $state(false);
</script>

<svelte:head>
	<title>SvelteKit App Skeleton</title>
	<meta
		name="description"
		content="A starter app template with SvelteKit, Supabase auth plumbing, and Vercel deployment support."
	/>
	<meta name="theme-color" content="#5f564f" />
	<link rel="icon" href={favicon} />
</svelte:head>

{#if data.authUser}
	<header class="app-header">
		<span class="logo">Starter App</span>
		<div class="auth-status">
			<span>{data.authUser.displayName}</span>
			<form method="POST" action="/auth/logout" onsubmit={() => (signingOut = true)}>
				<button type="submit" disabled={signingOut}>
					{signingOut ? "Signing out…" : "Sign out"}
				</button>
			</form>
		</div>
	</header>
{/if}

<main class="app-main" class:app-main--guest={!data.authUser}>
	{@render children()}
</main>
