<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron/Chevron.svelte";
	import DotsHorizontal from "$lib/assets/icons/DotsHorizontal/DotsHorizontal.svelte";
	import X from "$lib/assets/icons/X/X.svelte";
	import CardWarningFrame from "$lib/components/common/display/CardWarningFrame/CardWarningFrame.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";
	import IngredientCardMediaLane from "$lib/components/ingredients/card/IngredientCardMediaLane/IngredientCardMediaLane.svelte";
	import { EMPTY_IMAGE_PLACEMENT_GEOMETRY } from "$lib/utils/food/images/imagePlacement";
	import type { ImagePlacementGeometry } from "$lib/utils/food/images/types";
	import { createImagePlacementInteraction } from "./imagePlacementInteraction";
	import type { ImagePlacementCardPreviewProps } from "./types";

	let {
		imageUrl,
		alt,
		value,
		foodName = "Product name",
		category = "Ingredient category",
		ariaLabel = "Card image preview",
		warningFrameTone = null,
		interactive = false,
		instructionsId = undefined,
		onChange,
		onGeometryChange,
		onError,
	}: ImagePlacementCardPreviewProps = $props();

	let geometry = $state<ImagePlacementGeometry>({
		...EMPTY_IMAGE_PLACEMENT_GEOMETRY,
	});

	const handleGeometryChange = (nextGeometry: ImagePlacementGeometry) => {
		geometry = nextGeometry;
		onGeometryChange?.(nextGeometry);
	};

	const interaction = createImagePlacementInteraction({
		isEnabled: () => interactive,
		getGeometry: () => geometry,
		getValue: () => value,
		onChange: (nextValue) => onChange?.(nextValue),
	});
</script>

<div
	class="image-placement-card-preview"
	class:image-placement-card-preview--interactive={interactive}
	class:image-placement-card-preview--warning={warningFrameTone !== null}
	role="group"
	aria-label={ariaLabel}
	aria-describedby={interactive ? instructionsId : undefined}
	onpointerdown={interaction.handlePointerDown}
	onpointermove={interaction.handlePointerMove}
	onpointerup={interaction.finishPointer}
	onpointercancel={interaction.finishPointer}
	onlostpointercapture={interaction.finishPointer}
	onwheel={interaction.handleWheel}
>
	<IngredientCardMediaLane
		{imageUrl}
		{alt}
		{value}
		onGeometryChange={handleGeometryChange}
		{onError}
	/>
	{#if warningFrameTone}
		<CardWarningFrame tone={warningFrameTone} />
	{/if}
	<span class="image-placement-card-preview__copy">
		<strong>{foodName}</strong>
		<small>{category}</small>
	</span>
	<span class="image-placement-card-preview__actions" aria-hidden="true">
		<CircularIconFrame
			class="image-placement-card-preview__action image-placement-card-preview__action--primary"
			decorative
		>
			<Chevron direction="right" />
		</CircularIconFrame>
		<CircularIconFrame class="image-placement-card-preview__action" decorative>
			<DotsHorizontal />
		</CircularIconFrame>
		<CircularIconFrame class="image-placement-card-preview__action" decorative>
			<X />
		</CircularIconFrame>
	</span>
</div>

<style lang="scss">
	@use "./ImagePlacementCardPreview.scss";
</style>
