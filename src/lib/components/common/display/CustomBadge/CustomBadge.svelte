<script lang="ts">
	import type { CustomBadgeProps } from "./types";

	let { label = "Custom" }: CustomBadgeProps = $props();
</script>

<span class="custom-badge">{label}</span>

<style lang="scss">
	@use "./CustomBadge.scss";
</style>
