<script lang="ts">
	import { onDestroy } from "svelte";
	import AssetAttribution from "$lib/components/common/display/AssetAttribution/AssetAttribution.svelte";
	import PhotoUploadInput from "$lib/components/common/forms/PhotoUploadInput/PhotoUploadInput.svelte";
	import ImagePlacementEditor from "$lib/components/common/images/ImagePlacementEditor/ImagePlacementEditor.svelte";
	import ProductImageFrame from "$lib/components/common/images/ProductImageFrame/ProductImageFrame.svelte";
	import type { ProductImageEvidenceInputProps } from "./types";
	import { createFullImagePlacement } from "$lib/utils/food/images/imagePlacement";
	import { pickFoodFullImageUrl } from "$lib/utils/food/images/foodImages";

	let {
		trustedImage,
		frontPhoto,
		placement,
		foodName = "Product name",
		brandName = "",
		category = "Ingredient category",
		required = false,
		requireFreshPhoto = false,
		description = "",
		onFrontPhotoChange,
		onPlacementChange,
	}: ProductImageEvidenceInputProps = $props();

	let objectUrl = $state("");
	let lastFile = $state<File | null>(null);

	$effect(() => {
		if (frontPhoto === lastFile) return;
		if (objectUrl) URL.revokeObjectURL(objectUrl);
		lastFile = frontPhoto;
		objectUrl = frontPhoto ? URL.createObjectURL(frontPhoto) : "";
		if (frontPhoto) onPlacementChange(createFullImagePlacement());
	});

	onDestroy(() => {
		if (objectUrl) URL.revokeObjectURL(objectUrl);
	});

	const trustedImageUrl = $derived(pickFoodFullImageUrl(trustedImage));
	const previewUrl = $derived(objectUrl || trustedImageUrl);
</script>

<section class="product-image-evidence" aria-labelledby="product-image-title">
	<div>
		<strong id="product-image-title">Product image</strong>
		{#if trustedImageUrl && !requireFreshPhoto}
			<p>
				Using a trusted DB/API image. User photo upload is hidden so moderation
				does not need to review a duplicate image.
			</p>
		{:else if trustedImageUrl}
			<p>
				Add a current front package photo so the moderator can compare this
				correction with the existing product.
			</p>
		{:else}
			<p>
				{description ||
					"Add a front package photo if this product does not already have a trusted image. It stays private until a moderator approves it."}
			</p>
		{/if}
	</div>

	{#if previewUrl}
		<ProductImageFrame src={previewUrl} alt="Full product package preview" />
		<ImagePlacementEditor
			imageUrl={previewUrl}
			alt="Product package preview"
			{foodName}
			{brandName}
			{category}
			title="Card image preview"
			description={trustedImageUrl && !objectUrl
				? "Trusted images use the saved placement."
				: "Drag the image in the card preview or use the controls below."}
			editable={Boolean(objectUrl)}
			smartPlacementSource={frontPhoto ?? previewUrl}
			value={placement}
			onChange={onPlacementChange}
		/>
		{#if trustedImage}
			<AssetAttribution
				attributionText={trustedImage.attributionText}
				licenseName={trustedImage.licenseName}
				licenseUrl={trustedImage.licenseUrl}
			/>
		{/if}
	{/if}

	{#if !trustedImageUrl || requireFreshPhoto}
		<PhotoUploadInput
			id="custom-product-front-photo"
			name="custom-product-front-photo"
			prompt="Front of package"
			description="Show the complete package front with the product name and brand readable."
			photoCount={1}
			files={frontPhoto ? [frontPhoto] : []}
			capture="environment"
			{required}
			onFilesChange={(files) => onFrontPhotoChange(files[0] ?? null)}
		/>
	{/if}
</section>

<style lang="scss">
	@use "./ProductImageEvidenceInput.scss";
</style>
