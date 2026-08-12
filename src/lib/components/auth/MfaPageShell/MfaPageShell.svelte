<script lang="ts">
	import { APP_NAME } from "$lib/config/brand";
	import type { MfaPageShellProps } from "./types";

	let {
		eyebrow,
		title,
		description,
		children,
	}: MfaPageShellProps = $props();
</script>

<main class="mfa-page">
	<section class="mfa-card">
		<header class="mfa-card__header">
			<a class="mfa-card__brand" href="/">{APP_NAME}</a>
			<p class="mfa-card__eyebrow">{eyebrow}</p>
			<h1>{title}</h1>
			<p>{description}</p>
		</header>
		<div class="mfa-card__content">
			{@render children()}
		</div>
	</section>
</main>

<style lang="scss">
	@use "./MfaPageShell.scss";
</style>
