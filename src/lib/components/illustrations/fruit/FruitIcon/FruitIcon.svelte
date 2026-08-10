<script lang="ts">
	import AppleSvg from "../AppleSvg/AppleSvg.svelte";
	import BananaSvg from "../BananaSvg/BananaSvg.svelte";
	import PeachSvg from "../PeachSvg/PeachSvg.svelte";
	import PineappleSvg from "../PineappleSvg/PineappleSvg.svelte";
	import StrawberrySvg from "../StrawberrySvg/StrawberrySvg.svelte";
	import type { FruitIconProps } from "./types";

	let { name }: FruitIconProps = $props();
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
