<script lang="ts">
	import type { ManualEntryStepLayoutProps } from "./types";

	let { children }: ManualEntryStepLayoutProps = $props();
</script>

<div class="manual-entry-step-layout">
	{@render children()}
</div>

<style lang="scss">
	@use "./ManualEntryStepLayout.scss";
</style>
