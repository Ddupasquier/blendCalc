<script lang="ts">
	import type { Snippet } from "svelte";
	import GuestAccessPageShell from "$lib/components/auth/GuestAccessPageShell/GuestAccessPageShell.svelte";

	let { children }: { children: Snippet } = $props();
</script>

<GuestAccessPageShell width="wide">
	<article class="legal-notice">
		{@render children()}
	</article>
</GuestAccessPageShell>

<style lang="scss">
	@use "./LegalNoticeShell.scss";
</style>
