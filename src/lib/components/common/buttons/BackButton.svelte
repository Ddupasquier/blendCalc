<script lang="ts">
	import ArrowLeft from "$lib/assets/icons/ArrowLeft.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton.svelte";

	let {
		label = "Back",
		variant = "ghost",
		size = "small",
		class: className = "",
		onclick,
	}: {
		label?: string;
		variant?: "primary" | "soft" | "ghost";
		size?: "tiny" | "small" | "control" | "fab";
		class?: string;
		onclick?: (event: MouseEvent) => void;
	} = $props();
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
