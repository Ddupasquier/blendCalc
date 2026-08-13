<script lang="ts">
	import PillButton from "$lib/components/common/buttons/PillButton/PillButton.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import RangeInput from "$lib/components/common/forms/RangeInput/RangeInput.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import ImagePlacementCardPreview from "$lib/components/common/images/ImagePlacementCardPreview/ImagePlacementCardPreview.svelte";
	import type { ImagePlacementEditorProps } from "./types";
	import {
		CARD_IMAGE_PLACEMENT_MAX_X,
		CARD_IMAGE_PLACEMENT_MIN_X,
		constrainCardImagePlacement,
		createCustomImagePlacement,
		createFillImagePlacement,
		createFullImagePlacement,
		EMPTY_IMAGE_PLACEMENT_GEOMETRY,
		IMAGE_PLACEMENT_MAX_ZOOM,
		rotateImagePlacement,
	} from "$lib/utils/food/images/imagePlacement";
	import type {
		ImageFitMode,
		ImagePlacementGeometry,
		ImagePlacementValue,
	} from "$lib/utils/food/images/types";
	import { getUserFacingErrorMessage } from "$lib/utils/errors/userFacingErrors";

	let {
		imageUrl,
		alt,
		value,
		foodName = "Product name",
		brandName = "",
		category = "Ingredient category",
		title = "Image placement",
		description = "Adjust how the image appears in ingredient cards.",
		showIntro = true,
		editable = true,
		showWarningEdge = false,
		smartPlacementSource = imageUrl,
		automaticallyPlaceNewImage = false,
		onPlacementProcessingStateChange,
		onChange,
	}: ImagePlacementEditorProps = $props();

	const editorId = $props.id();
	const instructionsId = `${editorId}-instructions`;
	let previewGeometry = $state<ImagePlacementGeometry>({
		...EMPTY_IMAGE_PLACEMENT_GEOMETRY,
	});
	let suggestingPlacement = $state(false);
	let suggestionProgress = $state(0);
	let suggestionMessage = $state("");
	let suggestionError = $state("");
	let lastAutomaticallyProcessedSource: Blob | string | null = null;
	let placementEditRevision = 0;
	const activeFitMode = $derived<ImageFitMode>(
		value.placementVersion <= 1 ? "custom" : value.fitMode,
	);
	const horizontalShift = $derived(
		Math.max(
			0,
			Math.min(
				100,
				((value.cropX - CARD_IMAGE_PLACEMENT_MIN_X) /
					(CARD_IMAGE_PLACEMENT_MAX_X - CARD_IMAGE_PLACEMENT_MIN_X)) *
					100,
			),
		),
	);

	const updateCustomValue = (patch: Partial<ImagePlacementValue>) => {
		placementEditRevision += 1;
		onChange?.(
			constrainCardImagePlacement({
				...createCustomImagePlacement(value, previewGeometry.effectiveZoom),
				...patch,
				fitMode: "custom",
			}),
		);
	};

	const handlePreviewChange = (nextValue: ImagePlacementValue) => {
		placementEditRevision += 1;
		onChange?.(constrainCardImagePlacement(nextValue));
	};

	const selectFitMode = (fitMode: Exclude<ImageFitMode, "custom">) => {
		placementEditRevision += 1;
		if (fitMode === "contain") {
			onChange?.(createFullImagePlacement(value.rotationDegrees));
			return;
		}
		onChange?.(
			createFillImagePlacement(
				previewGeometry.coverZoom,
				value.rotationDegrees,
			),
		);
	};

	const formatZoom = (zoom: number) => `${zoom.toFixed(2).replace(/\.00$/, "")}×`;
	const clearSuggestionFeedback = () => {
		suggestionMessage = "";
		suggestionError = "";
	};
	const restoreDefault = () => {
		placementEditRevision += 1;
		clearSuggestionFeedback();
		onChange?.(createFullImagePlacement());
	};
	const rotateClockwise = () => {
		placementEditRevision += 1;
		clearSuggestionFeedback();
		onChange?.(rotateImagePlacement(value));
	};
	const suggestPlacement = async ({ automatic = false } = {}) => {
		if (!previewGeometry.ready || suggestingPlacement) return;
		const startingEditRevision = placementEditRevision;
		const placementSource = smartPlacementSource;
		suggestingPlacement = true;
		onPlacementProcessingStateChange?.(true);
		suggestionProgress = 0;
		clearSuggestionFeedback();

		try {
			const { suggestImagePlacement } = await import(
				"$lib/utils/food/images/smartImagePlacement.client"
			);
			const { isConfidentAutomaticImagePlacementSuggestion } = await import(
				"$lib/utils/food/images/smartImagePlacement"
			);
			const suggestion = await suggestImagePlacement({
				image: smartPlacementSource,
				geometry: previewGeometry,
				productName: foodName,
				brandName,
				onProgress: ({ progress }) => {
					suggestionProgress = progress;
				},
			});
			if (!suggestion) {
				suggestionError =
					"We couldn't confidently place this photo, so the full image is still showing. You can adjust it by hand or try again.";
				return;
			}
			if (
				automatic &&
				(
					startingEditRevision !== placementEditRevision ||
					placementSource !== smartPlacementSource
				)
			) return;
			if (
				automatic &&
				!isConfidentAutomaticImagePlacementSuggestion(suggestion)
			) {
				suggestionError =
					"We kept the full image because the product label wasn't clear enough to place automatically. You can adjust it by hand or try again.";
				return;
			}
			onChange?.(constrainCardImagePlacement(suggestion.placement));
			suggestionMessage =
				"We found the product label and placed it in the card. You can fine-tune it before saving.";
		} catch (error) {
			console.error("[image placement] Automatic placement failed", error);
			suggestionError = getUserFacingErrorMessage(error, {
				fallback:
					"We couldn't check this photo automatically. You can still position it by hand or try again.",
				network:
					"We couldn't load this photo for automatic placement. Check your connection or adjust it by hand.",
				timeout:
					"Automatic placement took too long. Try again, or position the photo by hand.",
			});
		} finally {
			suggestingPlacement = false;
			onPlacementProcessingStateChange?.(false);
		}
	};

	$effect(() => {
		const placementSource = smartPlacementSource;
		if (
			!automaticallyPlaceNewImage ||
			!editable ||
			!previewGeometry.ready ||
			suggestingPlacement ||
			lastAutomaticallyProcessedSource === placementSource
		) return;

		lastAutomaticallyProcessedSource = placementSource;
		void suggestPlacement({ automatic: true });
	});
</script>

<section class="image-placement-editor" aria-label={title}>
	{#if showIntro}
		<div class="image-placement-editor__copy">
			<strong class="image-placement-editor__title">
				<span>{title}</span>
			</strong>
			{#if description}
				<p>{description}</p>
			{/if}
		</div>
	{/if}

	<div class="image-placement-editor__editing-preview">
		<ImagePlacementCardPreview
			{imageUrl}
			{alt}
			{value}
			{foodName}
			{category}
			ariaLabel="Interactive card image preview"
			{showWarningEdge}
			interactive={editable}
			{instructionsId}
			onChange={handlePreviewChange}
			onGeometryChange={(geometry) => (previewGeometry = geometry)}
		/>
		{#if editable}
			<p id={instructionsId}>
				Drag left to shift the image, or drag right to return it. Pinch to
				zoom, or use the controls below.
			</p>
		{/if}
	</div>

	{#if editable}
		<div class="image-placement-editor__controls">
			<RoundedActionButton
				variant="soft"
				fullWidth
				busy={suggestingPlacement}
				disabled={!previewGeometry.ready}
				onclick={() => suggestPlacement()}
			>
				{suggestingPlacement
					? `Placing product label ${Math.round(suggestionProgress * 100)}%`
					: "Place automatically"}
			</RoundedActionButton>
			{#if suggestionMessage || suggestionError}
				{#if suggestionMessage}
					<StatusMessage tone="success" message={suggestionMessage} />
				{/if}
				{#if suggestionError}
					<StatusMessage tone="danger" message={suggestionError} />
				{/if}
			{/if}
			<div class="image-placement-editor__presets" role="group" aria-label="Image fit">
				<PillButton
					pressed={activeFitMode === "contain"}
					variant={activeFitMode === "contain" ? "primary" : "neutral"}
					onclick={() => {
						clearSuggestionFeedback();
						selectFitMode("contain");
					}}
				>
					Full image
				</PillButton>
				<PillButton
					pressed={activeFitMode === "cover"}
					variant={activeFitMode === "cover" ? "primary" : "neutral"}
					disabled={!previewGeometry.ready}
					onclick={() => {
						clearSuggestionFeedback();
						selectFitMode("cover");
					}}
				>
					Fill card
				</PillButton>
			</div>
			<div class="image-placement-editor__rotation">
				<span>
					Rotation
					<output>{value.rotationDegrees}°</output>
				</span>
				<RoundedActionButton variant="neutral" onclick={rotateClockwise}>
					Rotate 90° clockwise
				</RoundedActionButton>
			</div>
			<label>
				<span>
					Shift image left
					{#if !previewGeometry.ready}<small>Available after the image loads</small>{/if}
				</span>
				<RangeInput
					id="image-placement-horizontal-shift"
					min={0}
					max={100}
					step={1}
					value={horizontalShift}
					disabled={!previewGeometry.ready}
					ariaLabel="Shift image left"
					onValueChange={(value) =>
						updateCustomValue({
							cropX:
								CARD_IMAGE_PLACEMENT_MIN_X +
								(value / 100) *
									(CARD_IMAGE_PLACEMENT_MAX_X -
										CARD_IMAGE_PLACEMENT_MIN_X),
						})}
				/>
			</label>
			<label>
				<span>
					Vertical position
					{#if !previewGeometry.canMoveY}<small>Centered at this zoom</small>{/if}
				</span>
				<RangeInput
					id="image-placement-vertical-position"
					min={0}
					max={100}
					step={1}
					value={value.cropY}
					disabled={!previewGeometry.canMoveY}
					ariaLabel="Vertical image position"
					onValueChange={(nextValue) =>
						updateCustomValue({ cropY: nextValue })}
				/>
			</label>
			<label>
				<span>Zoom <output>{formatZoom(previewGeometry.effectiveZoom)}</output></span>
				<RangeInput
					id="image-placement-zoom"
					min={1}
					max={IMAGE_PLACEMENT_MAX_ZOOM}
					step={0.05}
					value={previewGeometry.effectiveZoom}
					ariaLabel="Image zoom"
					onValueChange={(nextValue) =>
						updateCustomValue({ cropZoom: nextValue })}
				/>
			</label>
			<RoundedActionButton variant="neutral" onclick={restoreDefault}>
				Restore default
			</RoundedActionButton>
		</div>
	{/if}
</section>

<style lang="scss">
	@use "./ImagePlacementEditor.scss";
</style>
