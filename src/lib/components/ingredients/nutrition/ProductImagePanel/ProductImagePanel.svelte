<script lang="ts">
	import CheckboxField from "$lib/components/common/forms/CheckboxField/CheckboxField.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import AssetAttribution from "$lib/components/common/display/AssetAttribution/AssetAttribution.svelte";
	import ImagePlacementEditor from "$lib/components/common/images/ImagePlacementEditor/ImagePlacementEditor.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import ProductImageFrame from "$lib/components/common/images/ProductImageFrame/ProductImageFrame.svelte";
	import { getCardImagePlacement } from "$lib/utils/food/images/imagePlacement";
	import type { ImagePlacementValue } from "$lib/utils/food/images/types";
	import {
		getFoodImageAltText,
		pickFoodFullImageUrl,
	} from "$lib/utils/food/images/foodImages";
	import { getFoodWarningFrameTone } from "$lib/utils/ingredients/ingredientListUi";
	import { getUserFacingErrorMessage } from "$lib/utils/errors/userFacingErrors";
	import { getCanonicalFoodDescription } from "$lib/utils/food/records/foodRecords";
	import type { ProductImagePanelProps } from "./types";
	import { page } from "$app/state";
	import { resolve } from "$app/paths";
	import { isModerationAppRole } from "$lib/utils/moderation/moderation";
	import { savePersonalImagePlacement } from "$lib/utils/food/images/personalImagePlacement";

	let {
		food,
		mode = "all",
		placementPresentation = "collapse",
		canAdjustImagePlacement = false,
		onImagePlacementSave,
	}: ProductImagePanelProps = $props();
	const showImage = $derived(mode !== "details");
	const showPlacementEditor = $derived(mode !== "summary");

	const imageUrl = $derived(pickFoodFullImageUrl(food?.image));
	const foodName = $derived(
		food ? getCanonicalFoodDescription(food) : "Ingredient",
	);
	const warningFrameTone = $derived(
		food ? getFoodWarningFrameTone(food) : null,
	);
	const imageAlt = $derived(
		getFoodImageAltText({
			foodName,
			role: food?.image?.role,
		}),
	);
	let imageFailed = $state(false);
	let lastImageUrl = $state("");
	let lastImageKey = $state("");
	let draftPlacement = $state<ImagePlacementValue>(getCardImagePlacement());
	let savingPlacement = $state(false);
	let saveRequestInFlight = false;
	let placementMessage = $state("");
	let placementError = $state("");
	let suggestionWarning = $state("");
	let suggestForEveryone = $state(false);
	const suggestionCheckboxId = $props.id();

	const savedPlacement = $derived<ImagePlacementValue>(
		getCardImagePlacement({
			cropX: food?.image?.cropX,
			cropY: food?.image?.cropY,
			cropZoom: food?.image?.cropZoom,
			rotationDegrees: food?.image?.rotationDegrees,
			fitMode: food?.image?.fitMode,
			placementVersion: food?.image?.placementVersion,
			placementMethod: food?.image?.placementMethod,
			suggestionVersion: food?.image?.suggestionVersion,
			suggestionConfidence: food?.image?.suggestionConfidence,
			suggestionAcceptedAt: food?.image?.suggestionAcceptedAt,
			cropSource: food?.image?.cropSource,
			approvedBy: food?.image?.approvedBy,
			approvedAt: food?.image?.approvedAt,
		}),
	);
	const imageKey = $derived(
		[
			food?.image?.assetId ?? "",
			food?.image?.source ?? "",
			food?.image?.sourceReference ?? "",
			food?.image?.role ?? "",
			food?.image?.imageUrl ?? "",
		].join(":"),
	);
	const canEditPlacement = $derived(
		canAdjustImagePlacement && Boolean(food?.image?.assetId),
	);
	const canPublishPlacement = $derived(
		isModerationAppRole(page.data.authUser?.role ?? null),
	);

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
		suggestionWarning = "";
		suggestForEveryone = false;
	});

	const suggestionIssue = (status: string) => {
		if (status === "locked") return "This image isn’t accepting suggestions.";
		if (status === "restricted")
			return "Suggestions aren’t available for your account.";
		if (status === "stale")
			return "The shared image changed. Refresh before suggesting again.";
		if (status === "limit_reached")
			return "You’ve reached the suggestion limit. Try again later.";
		return "We couldn’t send your suggestion. Please try again.";
	};

	const saveForAccount = async (action: "personal" | "reset") => {
		const image = food?.image;
		if (!image?.assetId || saveRequestInFlight) return;
		const foodId = food?.fdcId;
		const requestImageKey = imageKey;
		const placementToSave = { ...draftPlacement };
		const shouldSuggest = action === "personal" && suggestForEveryone;
		saveRequestInFlight = true;
		savingPlacement = true;
		placementMessage = "";
		placementError = "";
		suggestionWarning = "";
		try {
			const result = await savePersonalImagePlacement(
				image,
				action,
				placementToSave,
			);
			if (
				result.status !== "personal_saved" &&
				result.status !== "personal_reset"
			) {
				if (imageKey === requestImageKey) {
					placementError =
						result.status === "limit_reached"
							? "You’ve reached your saved-image limit. Reset an older image to make room."
							: "We couldn’t save this adjustment. Refresh and try again.";
				}
				return;
			}
			const updated = {
				...image,
				...result.placement,
				sharedPlacement: result.sharedPlacement,
				placementRevision: result.revision,
				communityPlacementLocked: result.locked,
				personalPlacement: result.status === "personal_saved",
			};
			await onImagePlacementSave?.(updated, foodId);
			if (imageKey !== requestImageKey) return;
			draftPlacement = getCardImagePlacement(updated);
			placementMessage =
				action === "reset" ? "Reset to the shared image." : "Saved.";
			if (action === "reset") suggestForEveryone = false;
			if (!shouldSuggest) return;

			// Keep the original revision: saving privately must not vote on a newer shared image.
			try {
				const suggestion = await savePersonalImagePlacement(
					image,
					"suggest",
					placementToSave,
				);
				if (imageKey !== requestImageKey) return;
				if (
					["pending", "published", "already_submitted", "unchanged"].includes(
						suggestion.status,
					)
				) {
					suggestForEveryone = false;
					placementMessage =
						suggestion.status === "unchanged"
							? "Saved. This already matches the shared image."
							: "Saved. Thanks for suggesting an improvement.";
				} else {
					suggestionWarning = `Your adjustment is saved. ${suggestionIssue(suggestion.status)}`;
				}
			} catch {
				if (imageKey === requestImageKey) {
					suggestionWarning =
						"Your adjustment is saved, but we couldn’t send the suggestion. Save again to retry.";
				}
			}
		} catch (error) {
			if (imageKey !== requestImageKey) return;
			placementError = getUserFacingErrorMessage(error, {
				fallback: "We couldn’t save your adjustment. Please try again.",
			});
		} finally {
			saveRequestInFlight = false;
			savingPlacement = false;
		}
	};

	const handlePlacementSubmit = (event: SubmitEvent) => {
		event.preventDefault();
		void saveForAccount("personal");
	};
</script>

{#snippet placementEditor()}
	<div class="product-image-panel__placement-content">
		<ImagePlacementEditor
			{imageUrl}
			alt={imageAlt}
			{foodName}
			brandName={food?.brandOwner ?? ""}
			category={food?.foodCategory ?? "Ingredient"}
			title="Card image placement"
			description="Drag the image in the card preview or use the controls below."
			showIntro={placementPresentation !== "flat"}
			{warningFrameTone}
			value={draftPlacement}
			editable={!savingPlacement}
			showRestoreDefault={false}
			onChange={(value) => {
				draftPlacement = value;
				placementMessage = "";
				placementError = "";
				suggestionWarning = "";
			}}
		/>
		<form
			class="product-image-panel__placement-save"
			onsubmit={handlePlacementSubmit}
		>
			<CheckboxField
				id={suggestionCheckboxId}
				checked={suggestForEveryone}
				disabled={savingPlacement || food?.image?.communityPlacementLocked}
				onchange={(event) => (suggestForEveryone = event.currentTarget.checked)}
				>Suggest this adjustment for everyone</CheckboxField
			>
			{#if food?.image?.communityPlacementLocked}
				<p>
					Suggestions are closed for this image. You can still adjust your own
					view.
				</p>
			{/if}
			<RoundedActionButton
				type="submit"
				variant="primary"
				fullWidth
				busy={savingPlacement}
			>
				{savingPlacement ? "Saving…" : "Save"}
			</RoundedActionButton>
			<div class="product-image-panel__placement-links">
				<RoundedActionButton
					type="button"
					variant="link"
					disabled={savingPlacement}
					onclick={() => void saveForAccount("reset")}
					>Reset to shared image</RoundedActionButton
				>
				{#if canPublishPlacement}
					<a
						href={`${resolve("/profile/privileged-tools/image-placement")}?image=${food?.image?.assetId}`}
						>Review image</a
					>
				{/if}
			</div>
			{#if placementMessage}
				<StatusMessage tone="success" message={placementMessage} />
			{/if}
			{#if suggestionWarning}
				<StatusMessage tone="warning" message={suggestionWarning} />
			{/if}
			{#if placementError}
				<StatusMessage tone="danger" message={placementError} />
			{/if}
		</form>
	</div>
{/snippet}

{#if imageUrl && !imageFailed}
	{#if showImage}
		<section class="product-image-panel">
			<ProductImageFrame
				src={imageUrl}
				alt={imageAlt}
				loading="eager"
				fetchPriority="high"
				rotationDegrees={savedPlacement.rotationDegrees}
				onError={() => (imageFailed = true)}
			/>
			<AssetAttribution
				attributionText={food?.image?.attributionText}
				licenseName={food?.image?.licenseName}
				licenseUrl={food?.image?.licenseUrl}
			/>
		</section>
	{/if}

	{#if showPlacementEditor && canEditPlacement}
		<section class="product-image-panel">
			{#if placementPresentation === "flat"}
				{@render placementEditor()}
			{:else}
				<CollapsibleSection
					title="Adjust card image placement"
					class="product-image-panel__placement"
				>
					{@render placementEditor()}
				</CollapsibleSection>
			{/if}
		</section>
	{/if}
{/if}

<style lang="scss">
	@use "./ProductImagePanel.scss";
</style>
