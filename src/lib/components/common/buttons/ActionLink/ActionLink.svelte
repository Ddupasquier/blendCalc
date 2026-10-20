<script lang="ts">
	import type { ActionLinkProps } from "./types";
	let { href, variant = "primary", children }: ActionLinkProps = $props();
</script>

<a class="action-link" data-variant={variant} {href}>{@render children()}</a>

<style lang="scss">
	@use "./ActionLink.scss";
</style>
