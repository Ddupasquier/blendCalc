<script lang="ts">
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner.svelte";
	import type { InputLoadingFrameProps } from "$lib/components/common/forms/types";

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
	@use "../../../../styles/variables" as *;

	.input-loading-frame {
		position: relative;
		display: block;
		width: 100%;
		min-width: 0;
	}

	.input-loading-frame :global(input),
	.input-loading-frame :global(select),
	.input-loading-frame :global(textarea) {
		box-sizing: border-box;
		width: 100%;
	}

	.input-loading-frame--loading :global(input),
	.input-loading-frame--loading :global(select),
	.input-loading-frame--loading :global(textarea) {
		padding-inline-end: $app-loading-input-padding-end;
	}

	.input-loading-frame__indicator {
		position: absolute;
		top: 50%;
		right: $app-loading-input-inset;
		display: inline-grid;
		place-items: center;
		color: $ingredient-accent-primary;
		transform: translateY(-50%);
		pointer-events: none;
	}

	.input-loading-frame[data-control-kind="select"]
		.input-loading-frame__indicator {
		right: $app-loading-select-inset;
	}
</style>
