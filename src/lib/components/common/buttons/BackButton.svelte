<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton.svelte";
	import type { BackButtonProps } from "./types";

	let {
		label = "Back",
		variant = "ghost",
		size = "small",
		class: className = "",
		onclick,
	}: BackButtonProps = $props();
</script>

<CircleIconButton
	class={`back-button ${className}`.trim()}
	{label}
	{variant}
	{size}
	{onclick}
>
	<Chevron class="back-button__icon" direction="left" />
</CircleIconButton>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	:global(.back-button__icon) {
		width: $app-control-icon-size;
		height: $app-control-icon-size;
	}
</style>
