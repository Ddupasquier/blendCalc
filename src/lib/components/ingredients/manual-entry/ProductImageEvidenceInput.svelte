<script lang="ts">
	import { onDestroy } from "svelte";
	import ImagePlacementEditor from "$lib/components/common/images/ImagePlacementEditor.svelte";
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
		<ImagePlacementEditor
			imageUrl={previewUrl}
			alt="Product package preview"
			title="Card image preview"
			description={trustedImageUrl
				? "Trusted images use the saved placement."
				: "Adjust how the package image appears in ingredient cards."}
			mode="card-only"
			editable={!trustedImageUrl && Boolean(objectUrl)}
			value={{ cropX, cropY, cropZoom }}
			onChange={(value) => {
				onCropXChange(value.cropX);
				onCropYChange(value.cropY);
				onCropZoomChange(value.cropZoom);
			}}
			onReset={() => {
				onCropXChange(50);
				onCropYChange(50);
				onCropZoomChange(1);
			}}
		/>
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
	{/if}
</section>
