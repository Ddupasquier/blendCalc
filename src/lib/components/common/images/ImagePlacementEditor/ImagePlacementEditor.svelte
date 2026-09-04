<script lang="ts">
	import { onDestroy } from "svelte";
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
	import {
		getUserFacingErrorMessage,
		isAbortError,
	} from "$lib/utils/errors/userFacingErrors";
	import { readSmartImagePlacementDiagnostic } from "$lib/utils/food/images/smartImagePlacementDiagnostics";

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
		warningFrameTone = null,
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
	let activeSuggestionController: AbortController | null = null;
	let activeSuggestionSource: Blob | string | null = null;
	let suggestionRunId = 0;
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

	const stopSuggestion = ({ announce = false } = {}) => {
		if (!activeSuggestionController) return;
		suggestionRunId += 1;
		activeSuggestionController.abort();
		activeSuggestionController = null;
		activeSuggestionSource = null;
		suggestingPlacement = false;
		onPlacementProcessingStateChange?.(false);
		if (announce) {
			suggestionMessage =
				"Automatic placement stopped. The full photo is still ready to use.";
			suggestionError = "";
		}
	};
	const beginManualEdit = () => {
		placementEditRevision += 1;
		stopSuggestion();
		clearSuggestionFeedback();
	};
	const updateCustomValue = (patch: Partial<ImagePlacementValue>) => {
		beginManualEdit();
		onChange?.(
			constrainCardImagePlacement({
				...createCustomImagePlacement(value, previewGeometry.effectiveZoom),
				...patch,
				fitMode: "custom",
			}),
		);
	};

	const handlePreviewChange = (nextValue: ImagePlacementValue) => {
		beginManualEdit();
		onChange?.(constrainCardImagePlacement(nextValue));
	};

	const selectFitMode = (fitMode: Exclude<ImageFitMode, "custom">) => {
		beginManualEdit();
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

	const formatZoom = (zoom: number) =>
		`${zoom.toFixed(2).replace(/\.00$/, "")}×`;
	const clearSuggestionFeedback = () => {
		suggestionMessage = "";
		suggestionError = "";
	};
	const restoreDefault = () => {
		beginManualEdit();
		onChange?.(createFullImagePlacement());
	};
	const rotateClockwise = () => {
		beginManualEdit();
		onChange?.(rotateImagePlacement(value));
	};
	const suggestPlacement = async ({ automatic = false } = {}) => {
		if (!previewGeometry.ready || suggestingPlacement) return;
		const startingEditRevision = placementEditRevision;
		const placementSource = smartPlacementSource;
		const abortController = new AbortController();
		const runId = ++suggestionRunId;
		activeSuggestionController = abortController;
		activeSuggestionSource = placementSource;
		suggestingPlacement = true;
		onPlacementProcessingStateChange?.(true);
		suggestionProgress = 0;
		clearSuggestionFeedback();

		try {
			const { suggestImagePlacement } =
				await import("$lib/utils/food/images/smartImagePlacement.client");
			const { isConfidentAutomaticImagePlacementSuggestion } =
				await import("$lib/utils/food/images/smartImagePlacement");
			const suggestion = await suggestImagePlacement({
				image: smartPlacementSource,
				geometry: previewGeometry,
				productName: foodName,
				brandName,
				signal: abortController.signal,
				onProgress: ({ progress }) => {
					if (runId === suggestionRunId) suggestionProgress = progress;
				},
			});
			if (runId !== suggestionRunId || abortController.signal.aborted) return;
			if (!suggestion) {
				suggestionError =
					"We couldn't confidently place this photo, so the full image is still showing. You can adjust it by hand or try again.";
				return;
			}
			if (
				automatic &&
				(startingEditRevision !== placementEditRevision ||
					placementSource !== smartPlacementSource)
			)
				return;
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
			if (runId !== suggestionRunId || isAbortError(error)) return;
			if (!(error instanceof DOMException && error.name === "TimeoutError"))
				console.error(
					"[image placement] Automatic placement failed",
					readSmartImagePlacementDiagnostic(error),
				);
			suggestionError = getUserFacingErrorMessage(error, {
				fallback:
					"We couldn't check this photo automatically. You can still position it by hand or try again.",
				network:
					"We couldn't load this photo for automatic placement. Check your connection or adjust it by hand.",
				timeout:
					"Automatic placement took too long. Try again, or position the photo by hand.",
			});
		} finally {
			if (runId === suggestionRunId) {
				activeSuggestionController = null;
				activeSuggestionSource = null;
				suggestingPlacement = false;
				onPlacementProcessingStateChange?.(false);
			}
		}
	};

	$effect(() => {
		const placementSource = smartPlacementSource;
		if (
			activeSuggestionController &&
			activeSuggestionSource !== placementSource
		) {
			stopSuggestion();
		}
		if (
			!automaticallyPlaceNewImage ||
			!editable ||
			!previewGeometry.ready ||
			suggestingPlacement ||
			lastAutomaticallyProcessedSource === placementSource
		)
			return;

		lastAutomaticallyProcessedSource = placementSource;
		void suggestPlacement({ automatic: true });
	});

	onDestroy(() => stopSuggestion());
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
			{warningFrameTone}
			interactive={editable}
			{instructionsId}
			onChange={handlePreviewChange}
			onGeometryChange={(geometry) => (previewGeometry = geometry)}
		/>
		{#if editable}
			<p id={instructionsId}>
				Drag left to shift the image, or drag right to return it. Pinch to zoom,
				or use the controls below.
			</p>
		{/if}
	</div>

	{#if editable}
		<div class="image-placement-editor__controls">
			<div class="image-placement-editor__automatic-controls">
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
				{#if suggestingPlacement}
					<p role="status" aria-live="polite">
						The full photo is ready now. You can keep editing or save while
						placement finishes.
					</p>
					<RoundedActionButton
						variant="neutral"
						fullWidth
						onclick={() => stopSuggestion({ announce: true })}
					>
						Stop automatic placement
					</RoundedActionButton>
				{/if}
			</div>
			{#if suggestionMessage || suggestionError}
				{#if suggestionMessage}
					<StatusMessage tone="success" message={suggestionMessage} />
				{/if}
				{#if suggestionError}
					<StatusMessage tone="danger" message={suggestionError} />
				{/if}
			{/if}
			<div
				class="image-placement-editor__presets"
				role="group"
				aria-label="Image fit"
			>
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
					{#if !previewGeometry.ready}<small
							>Available after the image loads</small
						>{/if}
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
									(CARD_IMAGE_PLACEMENT_MAX_X - CARD_IMAGE_PLACEMENT_MIN_X),
						})}
				/>
			</label>
			<label>
				<span>
					Vertical position
					{#if !previewGeometry.canMoveY}<small>Centered at this zoom</small
						>{/if}
				</span>
				<RangeInput
					id="image-placement-vertical-position"
					min={0}
					max={100}
					step={1}
					value={value.cropY}
					disabled={!previewGeometry.canMoveY}
					ariaLabel="Vertical image position"
					onValueChange={(nextValue) => updateCustomValue({ cropY: nextValue })}
				/>
			</label>
			<label>
				<span
					>Zoom <output>{formatZoom(previewGeometry.effectiveZoom)}</output
					></span
				>
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
