<script lang="ts">
	import ArrowLeft from "$lib/assets/icons/ArrowLeft.svelte";
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
	<ArrowLeft size={20} strokeWidth={2.4} />
</CircleIconButton>
