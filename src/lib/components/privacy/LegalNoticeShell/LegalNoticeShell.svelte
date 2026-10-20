<script lang="ts">
	import type { LegalNoticeShellProps } from "./types";
	import GuestAccessPageShell from "$lib/components/auth/GuestAccessPageShell/GuestAccessPageShell.svelte";

	let { children }: LegalNoticeShellProps = $props();
</script>

<GuestAccessPageShell width="wide">
	<article class="legal-notice">
		{@render children()}
	</article>
</GuestAccessPageShell>

<style lang="scss">
	@use "./LegalNoticeShell.scss";
</style>
