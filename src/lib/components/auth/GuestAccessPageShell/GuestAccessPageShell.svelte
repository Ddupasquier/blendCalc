<script lang="ts">
	import FloatingFruitBackground from "$lib/components/app/FloatingFruitBackground/FloatingFruitBackground.svelte";
	import PublicPolicyLinks from "$lib/components/common/navigation/PublicPolicyLinks/PublicPolicyLinks.svelte";
	import type { GuestAccessPageShellProps } from "./types";

	let { width = "standard", children }: GuestAccessPageShellProps = $props();
	let cardElement = $state<HTMLElement>();
</script>

<section class="guest-access-page-shell">
	<FloatingFruitBackground focusElement={cardElement} />
	<div
		class="guest-access-page-shell__card"
		data-width={width}
		bind:this={cardElement}
	>
		{@render children()}
		<PublicPolicyLinks />
	</div>
</section>

<style lang="scss">
	@use "./GuestAccessPageShell.scss";
</style>
