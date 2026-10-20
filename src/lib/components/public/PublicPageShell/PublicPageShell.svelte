<script lang="ts">
	import { resolve } from "$app/paths";
	import FloatingFruitBackground from "$lib/components/app/FloatingFruitBackground/FloatingFruitBackground.svelte";
	import PublicPolicyLinks from "$lib/components/common/navigation/PublicPolicyLinks/PublicPolicyLinks.svelte";
	import { APP_NAME } from "$lib/config/brand";
	import type { PublicPageShellProps } from "./types";
	let {
		children,
		next = "/ingredients/fridge",
		variant = "default",
	}: PublicPageShellProps = $props();
	let content = $state<HTMLElement>();
</script>

<div class="public-page-shell" data-variant={variant}>
	{#if variant !== "landing"}<FloatingFruitBackground
			focusElement={content}
		/>{/if}
	<div class="public-page-shell__content" bind:this={content}>
		<header>
			<a class="brand" href={resolve("/")}>{APP_NAME}</a>
			<nav aria-label="Public navigation">
				<a href={resolve("/demo")}>Try the demo</a>
				<a href={`${resolve("/auth")}?next=${encodeURIComponent(next)}`}
					>Sign in</a
				>
			</nav>
		</header>
		{@render children()}
		<footer>
			<PublicPolicyLinks />
			<p>
				Made by ModernCraft LLC, Oregon. <a href="mailto:support@blendcalc.food"
					>Get in touch</a
				>
			</p>
		</footer>
	</div>
</div>

<style lang="scss">
	@use "./PublicPageShell.scss";
</style>
