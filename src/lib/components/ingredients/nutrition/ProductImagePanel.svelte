<script lang="ts">
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton.svelte";
	import AssetAttribution from "$lib/components/common/display/AssetAttribution.svelte";
	import ImagePlacementEditor from "$lib/components/common/images/ImagePlacementEditor.svelte";
	import ProductImageFrame from "$lib/components/common/images/ProductImageFrame.svelte";
	import { getStoredImagePlacement } from "$lib/utils/food/images/imagePlacement";
	import type { ImagePlacementValue } from "$lib/utils/food/images/types";
	import {
		getFoodImageAltText,
		pickFoodFullImageUrl,
	} from "$lib/utils/food/images/foodImages";
	import { updateFoodImagePlacement } from "$lib/utils/food/images/foodImagePlacement";
	import type { ProductImagePanelProps } from "./types";

	let {
		food,
		canAdjustImagePlacement = false,
		onImagePlacementSave,
	}: ProductImagePanelProps = $props();

	const imageUrl = $derived(pickFoodFullImageUrl(food?.image));
	const imageAlt = $derived(
		getFoodImageAltText({
			foodName: food?.description ?? "Ingredient",
			role: food?.image?.role,
		}),
	);
	let imageFailed = $state(false);
	let lastImageUrl = $state("");
	let lastImageKey = $state("");
	let draftPlacement = $state<ImagePlacementValue>(getStoredImagePlacement());
	let savingPlacement = $state(false);
	let placementMessage = $state("");
	let placementError = $state("");

	const savedPlacement = $derived<ImagePlacementValue>(getStoredImagePlacement({
		cropX: food?.image?.cropX ?? 50,
		cropY: food?.image?.cropY ?? 50,
		cropZoom: food?.image?.cropZoom ?? 1,
		fitMode: food?.image?.fitMode,
		placementVersion: food?.image?.placementVersion,
	}));
	const imageKey = $derived(
		[
			food?.image?.source ?? "",
			food?.image?.sourceReference ?? "",
			food?.image?.role ?? "",
		].join(":"),
	);
	const canEditPlacement = $derived(
		canAdjustImagePlacement && Boolean(food?.image?.sourceReference),
	);
	const hasPlacementChanges = $derived(
		draftPlacement.cropX !== savedPlacement.cropX ||
			draftPlacement.cropY !== savedPlacement.cropY ||
			draftPlacement.cropZoom !== savedPlacement.cropZoom ||
			draftPlacement.fitMode !== savedPlacement.fitMode ||
			draftPlacement.placementVersion !== savedPlacement.placementVersion,
	);

	$effect(() => {
		if (imageUrl !== lastImageUrl) {
			lastImageUrl = imageUrl;
			imageFailed = false;
		}
	});

	$effect(() => {
		if (imageKey === lastImageKey) return;
		lastImageKey = imageKey;
		draftPlacement = { ...savedPlacement };
		placementMessage = "";
		placementError = "";
	});

	const savePlacement = async () => {
		if (!food?.image?.sourceReference || savingPlacement) return;

		savingPlacement = true;
		placementMessage = "";
		placementError = "";
		try {
			const image = await updateFoodImagePlacement({
				source: food.image.source,
				sourceReference: food.image.sourceReference,
				role: food.image.role,
				...draftPlacement,
			});
			await onImagePlacementSave?.(image, food?.fdcId);
			placementMessage = "Image placement saved.";
		} catch (error) {
			placementError =
				error instanceof Error
					? error.message
					: "Image placement could not be saved.";
		} finally {
			savingPlacement = false;
		}
	};
</script>

{#if imageUrl && !imageFailed}
	<section class="product-image-panel">
		<ProductImageFrame
			src={imageUrl}
			alt={imageAlt}
			onError={() => (imageFailed = true)}
		/>
		<AssetAttribution
			attributionText={food?.image?.attributionText}
			licenseName={food?.image?.licenseName}
			licenseUrl={food?.image?.licenseUrl}
		/>

		{#if canEditPlacement}
			<div class="product-image-panel__placement">
				<ImagePlacementEditor
					imageUrl={imageUrl}
					alt={imageAlt}
					title="Card image placement"
					description="Adjust how this image appears in ingredient cards."
					mode="card-only"
					value={draftPlacement}
					privileged
					onChange={(value) => {
						draftPlacement = value;
						placementMessage = "";
						placementError = "";
					}}
				/>
				<RoundedActionButton
					variant="primary"
					fullWidth
					busy={savingPlacement}
					disabled={!hasPlacementChanges}
					privileged
					onclick={savePlacement}
				>
					Save image placement
				</RoundedActionButton>
				{#if placementMessage}
					<p class="product-image-panel__message">{placementMessage}</p>
				{/if}
				{#if placementError}
					<p class="product-image-panel__error">{placementError}</p>
				{/if}
			</div>
		{/if}
	</section>
{/if}

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.product-image-panel {
		display: grid;
		gap: $app-vertical-stack-gap;
		width: 100%;
		margin: 0;
	}

	.product-image-panel__placement {
		display: grid;
		gap: $app-vertical-stack-gap;
	}

	.product-image-panel__message,
	.product-image-panel__error {
		margin: 0;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-bold;
	}

	.product-image-panel__message {
		color: $ingredient-accent-primary;
	}

	.product-image-panel__error {
		color: $ingredient-status-error-text;
	}
</style>
