<script lang="ts">
	import PrivilegedActionBadge from "$lib/components/common/badges/PrivilegedActionBadge/PrivilegedActionBadge.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import AssetAttribution from "$lib/components/common/display/AssetAttribution/AssetAttribution.svelte";
	import ImagePlacementEditor from "$lib/components/common/images/ImagePlacementEditor/ImagePlacementEditor.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import ProductImageFrame from "$lib/components/common/images/ProductImageFrame/ProductImageFrame.svelte";
	import { getStoredImagePlacement } from "$lib/utils/food/images/imagePlacement";
	import type { ImagePlacementValue } from "$lib/utils/food/images/types";
	import {
		getFoodImageAltText,
		pickFoodFullImageUrl,
	} from "$lib/utils/food/images/foodImages";
	import { getPrimaryFoodWarning } from "$lib/utils/ingredients/ingredientListUi";
	import { updateFoodImagePlacement } from "$lib/utils/food/images/foodImagePlacement";
	import { getUserFacingErrorMessage } from "$lib/utils/errors/userFacingErrors";
	import type { ProductImagePanelProps } from "./types";

	let {
		food,
		canAdjustImagePlacement = false,
		onImagePlacementSave,
	}: ProductImagePanelProps = $props();

	const imageUrl = $derived(pickFoodFullImageUrl(food?.image));
	const showWarningEdge = $derived(
		Boolean(food && getPrimaryFoodWarning(food)),
	);
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
	let saveRequestInFlight = false;
	let placementMessage = $state("");
	let placementError = $state("");

	const savedPlacement = $derived<ImagePlacementValue>(getStoredImagePlacement({
		cropX: food?.image?.cropX ?? 50,
		cropY: food?.image?.cropY ?? 50,
		cropZoom: food?.image?.cropZoom ?? 1,
		rotationDegrees: food?.image?.rotationDegrees,
		fitMode: food?.image?.fitMode,
		placementVersion: food?.image?.placementVersion,
		placementMethod: food?.image?.placementMethod,
		suggestionVersion: food?.image?.suggestionVersion,
		suggestionConfidence: food?.image?.suggestionConfidence,
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
	const placementHasChanged = () =>
		draftPlacement.cropX !== savedPlacement.cropX ||
		draftPlacement.cropY !== savedPlacement.cropY ||
		draftPlacement.cropZoom !== savedPlacement.cropZoom ||
		draftPlacement.rotationDegrees !== savedPlacement.rotationDegrees ||
		draftPlacement.fitMode !== savedPlacement.fitMode ||
		draftPlacement.placementVersion !== savedPlacement.placementVersion ||
		draftPlacement.placementMethod !== savedPlacement.placementMethod ||
		draftPlacement.suggestionVersion !== savedPlacement.suggestionVersion ||
		draftPlacement.suggestionConfidence !==
			savedPlacement.suggestionConfidence;

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
		const imageAsset = food?.image;
		const sourceReference = imageAsset?.sourceReference;
		if (!sourceReference || saveRequestInFlight) return;
		if (!placementHasChanged()) {
			placementError = "";
			placementMessage = "This card image placement is already saved.";
			return;
		}

		saveRequestInFlight = true;
		savingPlacement = true;
		placementMessage = "";
		placementError = "";
		const placementToSave = { ...draftPlacement };
		const foodId = food?.fdcId;
		try {
			const image = await updateFoodImagePlacement({
				source: imageAsset.source,
				sourceReference,
				role: imageAsset.role,
				...placementToSave,
			});
			await onImagePlacementSave?.(image, foodId);
			placementMessage = "Your card image placement is saved.";
		} catch (error) {
			console.error("[image placement] Save failed", error);
			placementError = getUserFacingErrorMessage(error, {
				fallback:
					"We couldn't save this image placement. Restore the default or try again.",
				network:
					"We couldn't connect while saving. Check your connection and try again.",
				timeout:
					"Saving took too long. Check your connection and try again.",
			});
		} finally {
			saveRequestInFlight = false;
			savingPlacement = false;
		}
	};

	const handlePlacementSubmit = (event: SubmitEvent) => {
		event.preventDefault();
		void savePlacement();
	};
</script>

{#snippet placementSummaryEnd()}
	<PrivilegedActionBadge />
{/snippet}

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
			<CollapsibleSection
				title="Adjust card image placement"
				summaryEnd={placementSummaryEnd}
				class="product-image-panel__placement"
			>
				<div class="product-image-panel__placement-content">
						<ImagePlacementEditor
							imageUrl={imageUrl}
							alt={imageAlt}
							foodName={food?.description ?? "Ingredient"}
							brandName={food?.brandOwner ?? ""}
							category={food?.foodCategory ?? "Ingredient"}
							title="Card image placement"
							description="Drag the image in the card preview or use the controls below."
							{showWarningEdge}
							value={draftPlacement}
						onChange={(value) => {
							draftPlacement = value;
							placementMessage = "";
							placementError = "";
						}}
					/>
					<form
						class="product-image-panel__placement-save"
						onsubmit={handlePlacementSubmit}
					>
						<RoundedActionButton
							type="submit"
							variant="primary"
							fullWidth
							busy={savingPlacement}
						>
							{savingPlacement
								? "Saving image placement…"
								: "Save image placement"}
						</RoundedActionButton>
						{#if placementMessage}
							<StatusMessage tone="success" message={placementMessage} />
						{/if}
						{#if placementError}
							<StatusMessage tone="danger" message={placementError} />
						{/if}
					</form>
				</div>
			</CollapsibleSection>
		{/if}
	</section>
{/if}

<style lang="scss">
	@use "./ProductImagePanel.scss";
</style>
