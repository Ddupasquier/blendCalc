<script lang="ts">
	import { onMount, setContext } from "svelte";
	import AppAdvertising from "$lib/components/advertising/AppAdvertising/AppAdvertising.svelte";
	import {
		ADVERTISING_SESSION_CONTEXT,
		createAdvertisingSession,
	} from "$lib/utils/advertising/advertisingSession.svelte";
	import {
		createAdUsage,
		recordCompletedAdAction,
	} from "$lib/utils/advertising/adPolicy";
	const session = createAdvertisingSession();
	setContext(ADVERTISING_SESSION_CONTEXT, session);
	let adFree = $state(false);
	let editing = $state(false);
	let consent = $state(true);
	let dark = $state(false);
	let accountKey = $state("preview-one");
	$effect(() => {
		session.update(
			{ mode: "preview" },
			accountKey,
			adFree ? "ad-free" : "supported",
			false,
		);
		session.state.blocked = !consent;
	});
	$effect(() => {
		document.documentElement.dataset.theme = dark ? "dark" : "light";
	});
	onMount(() => session.mount());
</script>

<svelte:head><title>Local advertising preview</title></svelte:head>
<main class="preview">
	<h1>Advertising preview</h1>
	<p>Local test content. No ad network, payment or account changes.</p>
	<section class="controls" aria-label="Preview controls">
		<label
			><input type="checkbox" bind:checked={adFree} /> Ad-free account</label
		>
		<label
			><input type="checkbox" bind:checked={editing} /> Editing a recipe</label
		>
		<label
			><input type="checkbox" bind:checked={consent} /> Preview advertising allowed</label
		>
		<label><input type="checkbox" bind:checked={dark} /> Dark theme</label>
		<button
			onclick={() => {
				session.state.usage = recordCompletedAdAction(session.state.usage);
			}}>Complete an action</button
		>
		<button
			onclick={() => {
				session.state.now += 5 * 60_000;
			}}>Advance five minutes</button
		>
		<button
			onclick={() => {
				session.state.now += 30 * 60_000;
			}}>Advance thirty minutes</button
		>
		<button
			onclick={() => {
				accountKey =
					accountKey === "preview-one" ? "preview-two" : "preview-one";
				session.state.usage = createAdUsage(Date.now());
			}}>Switch preview account</button
		>
		<p role="status">
			Completed actions: {session.state.usage.completedActions}. Break
			attempted: {session.state.usage.lastBreakAt === null ? "never" : "yes"}.
		</p>
	</section>
	<section class="recipes" aria-label="Example saved content">
		<h2>Saved Recipes</h2>
		<article>
			<h3>Morning mix</h3>
			<p>Your reusable food combination.</p>
		</article>
		<article>
			<h3>Lunch preparation</h3>
			<p>Keep ingredients and amounts together.</p>
		</article>
	</section>
	<AppAdvertising pathname="/saved" hasContent busy={editing} />
</main>

<style lang="scss">
	@use "../../../src/styles/variables" as *;
	.preview {
		box-sizing: border-box;
		width: min(100%, 38rem);
		margin: 0 auto;
		padding: $app-gap-lg $app-gap-md;
		color: $app-shell-text-primary;
		background: $app-shell-surface-page;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: $app-gap-md;
		margin-block: $app-gap-lg;
	}
	label {
		display: flex;
		gap: $app-gap-sm;
		align-items: center;
	}
	.controls p {
		width: 100%;
	}
	article {
		border-block-start: 1px solid $app-shell-border-subtle;
		padding-block: $app-gap-sm;
	}

	button {
		color: $app-shell-text-primary;
		background: $app-shell-surface-control;
		border: 1px solid $app-shell-border-subtle;
		border-radius: $app-radius-sm;
		padding: $app-gap-sm;
		cursor: pointer;
	}
</style>
