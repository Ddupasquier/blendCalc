<script lang="ts">
	import { onDestroy } from "svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton.svelte";
	import type { ProductImageEvidenceInputProps } from "$lib/components/ingredients/manual-entry/formTypes";

	let {
		trustedImageUrl = "",
		frontPhoto,
		cropX,
		cropY,
		cropZoom,
		required = false,
		description = "",
		onFrontPhotoChange,
		onCropXChange,
		onCropYChange,
		onCropZoomChange,
	}: ProductImageEvidenceInputProps = $props();

	let objectUrl = $state("");
	let lastFile = $state<File | null>(null);

	$effect(() => {
		if (frontPhoto === lastFile) return;
		if (objectUrl) URL.revokeObjectURL(objectUrl);
		lastFile = frontPhoto;
		objectUrl = frontPhoto ? URL.createObjectURL(frontPhoto) : "";
	});

	onDestroy(() => {
		if (objectUrl) URL.revokeObjectURL(objectUrl);
	});

	const previewUrl = $derived(trustedImageUrl || objectUrl);
	const imageStyle = $derived(
		`--product-image-focus-x: ${cropX}%; --product-image-focus-y: ${cropY}%; --product-image-zoom: ${cropZoom};`,
	);
</script>

<section class="custom-ingredient__image-review" aria-labelledby="product-image-title">
	<div>
		<strong id="product-image-title">Product image</strong>
		{#if trustedImageUrl}
			<p>
				Using a trusted DB/API image. User photo upload is hidden so moderation
				does not need to review a duplicate image.
			</p>
		{:else}
			<p>
				{description ||
					"Add a front package photo if this product does not already have a trusted image. It stays private until a moderator approves it."}
			</p>
		{/if}
	</div>

	{#if previewUrl}
		<div class="custom-ingredient__image-preview" aria-label="Product image preview">
			<img src={previewUrl} alt="Product package preview" style={imageStyle} />
		</div>
	{/if}

	{#if !trustedImageUrl}
		<label class="custom-ingredient__field">
			<span>Front of package</span>
			<input
				id="custom-product-front-photo"
				name="custom-product-front-photo"
				type="file"
				accept="image/jpeg,image/png,image/webp"
				aria-required={required}
				onchange={(event) => onFrontPhotoChange(event.currentTarget.files?.[0] ?? null)}
			/>
		</label>

		{#if objectUrl}
			<div class="custom-ingredient__crop-controls">
				<label>
					<span>Horizontal focus</span>
					<input
						type="range"
						min="0"
						max="100"
						step="1"
						value={cropX}
						oninput={(event) => onCropXChange(Number(event.currentTarget.value))}
					/>
				</label>
				<label>
					<span>Vertical focus</span>
					<input
						type="range"
						min="0"
						max="100"
						step="1"
						value={cropY}
						oninput={(event) => onCropYChange(Number(event.currentTarget.value))}
					/>
				</label>
				<label>
					<span>Zoom</span>
					<input
						type="range"
						min="1"
						max="4"
						step="0.05"
						value={cropZoom}
						oninput={(event) => onCropZoomChange(Number(event.currentTarget.value))}
					/>
				</label>
				<RoundedActionButton
					variant="neutral"
					onclick={() => {
						onCropXChange(50);
						onCropYChange(50);
						onCropZoomChange(1);
					}}
				>
					Reset image crop
				</RoundedActionButton>
			</div>
		{/if}
	{/if}
</section>
