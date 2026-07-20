<script lang="ts">
	import { onDestroy } from "svelte";
	import AssetAttribution from "$lib/components/common/display/AssetAttribution.svelte";
	import ImagePlacementEditor from "$lib/components/common/images/ImagePlacementEditor.svelte";
	import type { ProductImageEvidenceInputProps } from "$lib/components/ingredients/manual-entry/formTypes";
	import { createFullImagePlacement } from "$lib/utils/food/images/imagePlacement";
	import { pickFoodFullImageUrl } from "$lib/utils/food/images/foodImages";

	let {
		trustedImage,
		frontPhoto,
		placement,
		required = false,
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
			mode="card-and-full"
			editable={!trustedImageUrl && Boolean(objectUrl)}
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
