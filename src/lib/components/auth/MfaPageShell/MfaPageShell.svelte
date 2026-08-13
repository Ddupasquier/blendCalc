<script lang="ts">
	import type { MfaPageShellProps } from "./types";

	let {
		eyebrow,
		title,
		description,
		children,
	}: MfaPageShellProps = $props();
</script>

<div class="mfa-page">
	<section class="mfa-card">
		<header class="mfa-card__header">
			<p class="mfa-card__eyebrow">{eyebrow}</p>
			<h1>{title}</h1>
			<p>{description}</p>
		</header>
		<div class="mfa-card__content">
			{@render children()}
		</div>
	</section>
</div>

<style lang="scss">
	@use "./MfaPageShell.scss";
</style>
