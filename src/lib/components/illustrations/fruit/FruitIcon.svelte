<script lang="ts">
	import type { FruitName } from "$lib/utils/animation/floatingFruit";
	import AppleSvg from "./AppleSvg.svelte";
	import BananaSvg from "./BananaSvg.svelte";
	import PeachSvg from "./PeachSvg.svelte";
	import PineappleSvg from "./PineappleSvg.svelte";
	import StrawberrySvg from "./StrawberrySvg.svelte";

	let { name }: { name: FruitName } = $props();
</script>

{#if name === "apple"}
	<AppleSvg />
{:else if name === "banana"}
	<BananaSvg />
{:else if name === "peach"}
	<PeachSvg />
{:else if name === "pineapple"}
	<PineappleSvg />
{:else}
	<StrawberrySvg />
{/if}
