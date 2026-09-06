<script lang="ts">
	import { onDestroy, untrack } from "svelte";
	import AssetAttribution from "$lib/components/common/display/AssetAttribution/AssetAttribution.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import PhotoUploadInput from "$lib/components/common/forms/PhotoUploadInput/PhotoUploadInput.svelte";
	import ImagePlacementEditor from "$lib/components/common/images/ImagePlacementEditor/ImagePlacementEditor.svelte";
	import ProductImageFrame from "$lib/components/common/images/ProductImageFrame/ProductImageFrame.svelte";
	import type { ProductImageEvidenceInputProps } from "./types";
	import {
		createFullImagePlacement,
		getStoredImagePlacement,
	} from "$lib/utils/food/images/imagePlacement";
	import { pickFoodFullImageUrl } from "$lib/utils/food/images/foodImages";
	import { prepareSelectedImagePreview } from "$lib/utils/food/images/selectedImagePreview.client";

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
		uploadStatus = undefined,
		uploadProgress = null,
		onFrontPhotoChange,
		onPlacementChange,
		onPlacementProcessingStateChange,
	}: ProductImageEvidenceInputProps = $props();

	let selectedPreviewUrl = $state("");
	let isPreparingPreview = $state(false);
	let previewPreparationFailed = $state(false);
	let replacingTrustedImage = $state(false);
	let lastPreparedPhoto = $state<File | null>(null);
	let activePreviewController: AbortController | null = null;
	let activePreparedUrl = "";

	const clearActivePreview = () => {
		activePreviewController?.abort();
		activePreviewController = null;
		if (activePreparedUrl) URL.revokeObjectURL(activePreparedUrl);
		activePreparedUrl = "";
	};

	$effect(() => {
		const selectedPhoto = frontPhoto;
		if (selectedPhoto === lastPreparedPhoto) return;
		lastPreparedPhoto = selectedPhoto;
		untrack(() => {
			clearActivePreview();
			selectedPreviewUrl = "";
			isPreparingPreview = Boolean(selectedPhoto);
			previewPreparationFailed = false;
			if (!selectedPhoto) return;

			onPlacementChange(createFullImagePlacement());
			const controller = new AbortController();
			activePreviewController = controller;
			void prepareSelectedImagePreview(selectedPhoto, controller.signal)
				.then((previewBlob) => {
					if (controller.signal.aborted) return;
					activePreparedUrl = URL.createObjectURL(previewBlob);
					selectedPreviewUrl = activePreparedUrl;
				})
				.catch(() => {
					if (!controller.signal.aborted) previewPreparationFailed = true;
				})
				.finally(() => {
					if (!controller.signal.aborted) isPreparingPreview = false;
				});
		});
	});

	onDestroy(clearActivePreview);

	const trustedImageUrl = $derived(pickFoodFullImageUrl(trustedImage));
	const showPhotoInput = $derived(
		!trustedImageUrl ||
			requireFreshPhoto ||
			replacingTrustedImage ||
			Boolean(frontPhoto),
	);
	const photoInputRequired = $derived(
		required && (!trustedImageUrl || requireFreshPhoto),
	);
	const previewUrl = $derived(
		selectedPreviewUrl || (!frontPhoto ? trustedImageUrl : ""),
	);
	const resolvedUploadStatus = $derived(
		isPreparingPreview
			? "preparing"
			: (uploadStatus ?? (frontPhoto ? "ready" : undefined)),
	);
	const useExistingProductImage = () => {
		onFrontPhotoChange(null);
		onPlacementChange(getStoredImagePlacement(trustedImage));
		replacingTrustedImage = false;
	};
</script>

<section class="product-image-evidence" aria-labelledby="product-image-title">
	<div>
		<strong id="product-image-title">Product image</strong>
		{#if trustedImageUrl && !requireFreshPhoto && !showPhotoInput}
			<p>
				Using the existing trusted product image and its saved placement.
				Replace it only when the package image has changed.
			</p>
		{:else if trustedImageUrl && !requireFreshPhoto}
			<p>
				Choose a current front-package photo only if you want moderators to
				review a replacement image.
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
	{#if trustedImageUrl && !requireFreshPhoto}
		<RoundedActionButton
			variant="outline"
			fullWidth
			onclick={() => {
				if (showPhotoInput) useExistingProductImage();
				else replacingTrustedImage = true;
			}}
		>
			{showPhotoInput ? "Use existing product image" : "Replace product image"}
		</RoundedActionButton>
	{/if}
	{#if isPreparingPreview}
		<p class="product-image-evidence__preview-status" role="status">
			Preparing the photo preview. You can keep working while it loads.
		</p>
	{:else if previewPreparationFailed}
		<p class="product-image-evidence__preview-status" role="alert">
			Preview isn't available in this browser. Your original photo is still
			selected, and you can keep completing the form.
		</p>
	{/if}

	{#if previewUrl}
		<ProductImageFrame src={previewUrl} alt="Full product package preview" />
		<ImagePlacementEditor
			imageUrl={previewUrl}
			alt="Product package preview"
			{foodName}
			{brandName}
			{category}
			title="Card image preview"
			description={trustedImageUrl && !selectedPreviewUrl
				? "Trusted images use the saved placement."
				: "Drag the image in the card preview or use the controls below."}
			editable={Boolean(selectedPreviewUrl)}
			smartPlacementSource={selectedPreviewUrl || previewUrl}
			{onPlacementProcessingStateChange}
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

	{#if showPhotoInput}
		<PhotoUploadInput
			id="custom-product-front-photo"
			name="custom-product-front-photo"
			prompt="Front of package"
			description="Show the complete package front with the product name and brand readable."
			photoCount={1}
			files={frontPhoto ? [frontPhoto] : []}
			capture="environment"
			required={photoInputRequired}
			status={resolvedUploadStatus}
			progress={uploadProgress}
			onFilesChange={(files) => onFrontPhotoChange(files[0] ?? null)}
		/>
	{/if}
</section>

<style lang="scss">
	@use "./ProductImageEvidenceInput.scss";
</style>
