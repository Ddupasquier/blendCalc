<script lang="ts">
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import type { InputLoadingFrameProps } from "./types";

	let {
		loading = false,
		loadingLabel = "Loading input",
		controlKind = "input",
		children,
	}: InputLoadingFrameProps = $props();
</script>

<span
	class="input-loading-frame"
	class:input-loading-frame--loading={loading}
	data-control-kind={controlKind}
	aria-busy={loading}
>
	{@render children()}
	{#if loading}
		<span class="input-loading-frame__indicator">
			<LoadingSpinner size="small" label={loadingLabel} />
		</span>
	{/if}
</span>

<style lang="scss">
	@use "./InputLoadingFrame.scss";
</style>
