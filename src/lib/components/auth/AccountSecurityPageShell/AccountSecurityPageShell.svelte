<script lang="ts">
	import type { AccountSecurityPageShellProps } from "./types";

	let { eyebrow, title, description, children }: AccountSecurityPageShellProps =
		$props();
</script>

<div class="account-security-page-shell">
	<section class="account-security-page-shell__card">
		<header class="account-security-page-shell__header">
			<p class="account-security-page-shell__eyebrow">{eyebrow}</p>
			<h1>{title}</h1>
			<p>{description}</p>
		</header>
		<div class="account-security-page-shell__content">
			{@render children()}
		</div>
	</section>
</div>

<style lang="scss">
	@use "./AccountSecurityPageShell.scss";
</style>
