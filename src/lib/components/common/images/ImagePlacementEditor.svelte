<script lang="ts">
	import PrivilegedActionBadge from "$lib/components/common/badges/PrivilegedActionBadge.svelte";
	import PillButton from "$lib/components/common/buttons/PillButton.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton.svelte";
	import ImagePlacementCardPreview from "$lib/components/common/images/ImagePlacementCardPreview.svelte";
	import type {
		ImagePlacementEditorProps,
	} from "$lib/components/common/images/types";
	import {
		createCustomImagePlacement,
		createFillImagePlacement,
		createFullImagePlacement,
		EMPTY_IMAGE_PLACEMENT_GEOMETRY,
		IMAGE_PLACEMENT_MAX_ZOOM,
	} from "$lib/utils/food/images/imagePlacement";
	import type {
		ImageFitMode,
		ImagePlacementGeometry,
		ImagePlacementValue,
	} from "$lib/utils/food/images/types";

	let {
		imageUrl,
		alt,
		value,
		title = "Image placement",
		description = "Adjust how the image appears in ingredient cards.",
		mode = "card-and-full",
		editable = true,
		privileged = false,
		onChange,
	}: ImagePlacementEditorProps = $props();

	const editorId = $props.id();
	const instructionsId = `${editorId}-instructions`;
	let previewGeometry = $state<ImagePlacementGeometry>({
		...EMPTY_IMAGE_PLACEMENT_GEOMETRY,
	});
	const activeFitMode = $derived<ImageFitMode>(
		value.placementVersion <= 1 ? "custom" : value.fitMode,
	);

	const updateCustomValue = (patch: Partial<ImagePlacementValue>) => {
		onChange?.({
			...createCustomImagePlacement(value, previewGeometry.effectiveZoom),
			...patch,
			fitMode: "custom",
		});
	};

	const selectFitMode = (fitMode: ImageFitMode) => {
		if (fitMode === "contain") {
			onChange?.(createFullImagePlacement());
			return;
		}
		if (fitMode === "cover") {
			onChange?.(createFillImagePlacement(previewGeometry.coverZoom));
			return;
		}
		onChange?.(
			createCustomImagePlacement(value, previewGeometry.effectiveZoom),
		);
	};

	const formatZoom = (zoom: number) => `${zoom.toFixed(2).replace(/\.00$/, "")}×`;
	const restoreDefault = () => onChange?.(createFullImagePlacement());
</script>

<section class="image-placement-editor" aria-label={title}>
	<div class="image-placement-editor__copy">
		<strong class="image-placement-editor__title">
			<span>{title}</span>
			{#if privileged}
				<PrivilegedActionBadge />
			{/if}
		</strong>
		{#if description}
			<p>{description}</p>
		{/if}
	</div>

	<div class="image-placement-editor__editing-preview">
		<ImagePlacementCardPreview
			{imageUrl}
			{alt}
			{value}
			ariaLabel="Interactive card image preview"
			size="editor"
			interactive={editable}
			{instructionsId}
			onChange={(nextValue) => onChange?.(nextValue)}
			onGeometryChange={(geometry) => (previewGeometry = geometry)}
		/>
		{#if editable}
			<p id={instructionsId}>
				Drag to reposition. Pinch or scroll over the preview to zoom.
			</p>
		{/if}
	</div>

	<div class="image-placement-editor__previews" data-mode={mode}>
		<figure class="image-placement-editor__actual-preview">
			<ImagePlacementCardPreview
				{imageUrl}
				{alt}
				{value}
				ariaLabel="Actual ingredient card image preview"
			/>
			<figcaption>Actual card size</figcaption>
		</figure>

		{#if mode === "card-and-full"}
			<figure class="image-placement-editor__full-preview">
				<img src={imageUrl} {alt} />
				<figcaption>Nutrition page shows the full image.</figcaption>
			</figure>
		{/if}
	</div>

	{#if editable}
		<div class="image-placement-editor__controls">
			<div class="image-placement-editor__presets" role="group" aria-label="Image fit">
				<PillButton
					pressed={activeFitMode === "contain"}
					variant={activeFitMode === "contain" ? "primary" : "neutral"}
					{privileged}
					onclick={() => selectFitMode("contain")}
				>
					Full image
				</PillButton>
				<PillButton
					pressed={activeFitMode === "cover"}
					variant={activeFitMode === "cover" ? "primary" : "neutral"}
					disabled={!previewGeometry.ready}
					{privileged}
					onclick={() => selectFitMode("cover")}
				>
					Fill circle
				</PillButton>
				<PillButton
					pressed={activeFitMode === "custom"}
					variant={activeFitMode === "custom" ? "primary" : "neutral"}
					{privileged}
					onclick={() => selectFitMode("custom")}
				>
					Custom
				</PillButton>
			</div>
			<label>
				<span>
					Horizontal position
					{#if !previewGeometry.canMoveX}<small>Centered at this zoom</small>{/if}
				</span>
				<input
					type="range"
					min="0"
					max="100"
					step="1"
					value={value.cropX}
					disabled={!previewGeometry.canMoveX}
					oninput={(event) =>
						updateCustomValue({ cropX: Number(event.currentTarget.value) })}
				/>
			</label>
			<label>
				<span>
					Vertical position
					{#if !previewGeometry.canMoveY}<small>Centered at this zoom</small>{/if}
				</span>
				<input
					type="range"
					min="0"
					max="100"
					step="1"
					value={value.cropY}
					disabled={!previewGeometry.canMoveY}
					oninput={(event) =>
						updateCustomValue({ cropY: Number(event.currentTarget.value) })}
				/>
			</label>
			<label>
				<span>Zoom <output>{formatZoom(previewGeometry.effectiveZoom)}</output></span>
				<input
					type="range"
					min="1"
					max={IMAGE_PLACEMENT_MAX_ZOOM}
					step="0.05"
					value={previewGeometry.effectiveZoom}
					oninput={(event) =>
						updateCustomValue({ cropZoom: Number(event.currentTarget.value) })}
				/>
			</label>
			<RoundedActionButton variant="neutral" {privileged} onclick={restoreDefault}>
				Restore default
			</RoundedActionButton>
		</div>
	{/if}
</section>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.image-placement-editor {
		display: grid;
		gap: $app-vertical-stack-gap;
		padding: $ingredient-card-padding;
		background: $ingredient-surface-card;
		border: $app-border-divider;
		border-radius: $ingredient-radius-card;
	}

	.image-placement-editor__copy p {
		margin: $app-gap-xs 0 0;
		color: $ingredient-text-muted;
		font-size: $app-font-size-sm;
		line-height: 1.35;
	}

	.image-placement-editor__editing-preview {
		display: grid;
		justify-items: center;
		gap: $app-gap-sm;
	}

	.image-placement-editor__editing-preview p {
		margin: 0;
		color: $ingredient-text-muted;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-medium;
		text-align: center;
	}

	.image-placement-editor__title {
		display: inline-flex;
		align-items: center;
		gap: $app-gap-xs;
		min-width: 0;
	}

	.image-placement-editor__previews {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: $app-horizontal-control-gap;
		align-items: center;
	}

	.image-placement-editor__previews[data-mode="card-only"] {
		grid-template-columns: auto;
	}

	.image-placement-editor__actual-preview,
	.image-placement-editor__full-preview {
		display: grid;
		gap: $app-gap-xs;
		min-width: 0;
		margin: 0;
	}

	.image-placement-editor__actual-preview {
		justify-items: center;
	}

	.image-placement-editor__full-preview {
		width: 100%;
	}

	.image-placement-editor__full-preview img {
		width: 100%;
		max-height: $ingredient-nutrition-product-image-max-height;
		object-fit: contain;
		background: $ingredient-surface-soft;
		border: $app-border-divider;
		border-radius: $ingredient-radius-card;
	}

	.image-placement-editor__actual-preview figcaption,
	.image-placement-editor__full-preview figcaption {
		color: $ingredient-text-muted;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-bold;
	}

	.image-placement-editor__controls {
		display: grid;
		gap: $app-vertical-stack-gap;
	}

	.image-placement-editor__presets {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: $app-gap-sm;
	}

	.image-placement-editor__controls label {
		display: grid;
		gap: $app-gap-xs;
		color: $ingredient-text-muted;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-bold;
	}

	.image-placement-editor__controls label > span {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: $app-gap-sm;
	}

	.image-placement-editor__controls small,
	.image-placement-editor__controls output {
		color: $ingredient-text-muted;
		font: inherit;
	}

	.image-placement-editor__controls input[type="range"] {
		width: 100%;
		accent-color: $ingredient-accent-primary;
	}

	.image-placement-editor__controls input[type="range"]:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	@media (max-width: $app-breakpoint-xs) {
		.image-placement-editor__presets {
			grid-template-columns: 1fr;
		}
	}
</style>
