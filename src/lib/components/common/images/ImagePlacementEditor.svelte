<script lang="ts">
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton.svelte";
	import ImagePlacementCardPreview from "$lib/components/common/images/ImagePlacementCardPreview.svelte";
	import type {
		ImagePlacementEditorProps,
		ImagePlacementValue,
	} from "$lib/components/common/images/types";

	let {
		imageUrl,
		alt,
		value,
		title = "Image placement",
		description = "Adjust how the image appears in ingredient cards.",
		mode = "card-and-full",
		editable = true,
		onChange,
		onReset,
	}: ImagePlacementEditorProps = $props();

	const updateValue = (patch: Partial<ImagePlacementValue>) => {
		onChange?.({
			...value,
			...patch,
		});
	};
</script>

<section class="image-placement-editor" aria-label={title}>
	<div class="image-placement-editor__copy">
		<strong>{title}</strong>
		{#if description}
			<p>{description}</p>
		{/if}
	</div>

	<div class="image-placement-editor__previews" data-mode={mode}>
		<ImagePlacementCardPreview {imageUrl} {alt} {value} ariaLabel="Card icon preview" />

		{#if mode === "card-and-full"}
			<figure class="image-placement-editor__full-preview">
				<img src={imageUrl} {alt} />
				<figcaption>Nutrition page shows the full image.</figcaption>
			</figure>
		{/if}
	</div>

	{#if editable}
		<div class="image-placement-editor__controls">
			<label>
				<span>Horizontal focus</span>
				<input
					type="range"
					min="0"
					max="100"
					step="1"
					value={value.cropX}
					oninput={(event) =>
						updateValue({ cropX: Number(event.currentTarget.value) })}
				/>
			</label>
			<label>
				<span>Vertical focus</span>
				<input
					type="range"
					min="0"
					max="100"
					step="1"
					value={value.cropY}
					oninput={(event) =>
						updateValue({ cropY: Number(event.currentTarget.value) })}
				/>
			</label>
			<label>
				<span>Zoom</span>
				<input
					type="range"
					min="1"
					max="4"
					step="0.05"
					value={value.cropZoom}
					oninput={(event) =>
						updateValue({ cropZoom: Number(event.currentTarget.value) })}
				/>
			</label>
			{#if onReset}
				<RoundedActionButton variant="neutral" onclick={onReset}>
					Reset image placement
				</RoundedActionButton>
			{/if}
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

	.image-placement-editor__previews {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: $app-horizontal-control-gap;
		align-items: center;
	}

	.image-placement-editor__previews[data-mode="card-only"] {
		grid-template-columns: auto;
	}

	.image-placement-editor__full-preview {
		display: grid;
		gap: $app-gap-xs;
		min-width: 0;
		margin: 0;
	}

	.image-placement-editor__full-preview img {
		width: 100%;
		max-height: $ingredient-nutrition-product-image-max-height;
		object-fit: contain;
		background: $ingredient-surface-soft;
		border: $app-border-divider;
		border-radius: $ingredient-radius-card;
	}

	.image-placement-editor__full-preview figcaption {
		color: $ingredient-text-muted;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-bold;
	}

	.image-placement-editor__controls {
		display: grid;
		gap: $app-vertical-stack-gap;
	}

	.image-placement-editor__controls label {
		display: grid;
		gap: $app-gap-xs;
		color: $ingredient-text-muted;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-bold;
	}

	.image-placement-editor__controls input[type="range"] {
		width: 100%;
		accent-color: $ingredient-accent-primary;
	}
</style>
