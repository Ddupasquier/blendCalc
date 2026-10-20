<script lang="ts">
	import PrivilegedActionBadge from "$lib/components/common/badges/PrivilegedActionBadge/PrivilegedActionBadge.svelte";
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
	import { updateFoodImagePlacement } from "$lib/utils/food/images/foodImagePlacement";
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
	const placementHasChanged = () =>
		draftPlacement.cropX !== savedPlacement.cropX ||
		draftPlacement.cropY !== savedPlacement.cropY ||
		draftPlacement.cropZoom !== savedPlacement.cropZoom ||
		draftPlacement.rotationDegrees !== savedPlacement.rotationDegrees ||
		draftPlacement.fitMode !== savedPlacement.fitMode ||
		draftPlacement.placementVersion !== savedPlacement.placementVersion ||
		draftPlacement.placementMethod !== savedPlacement.placementMethod ||
		draftPlacement.suggestionVersion !== savedPlacement.suggestionVersion ||
		draftPlacement.suggestionConfidence !== savedPlacement.suggestionConfidence;

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
	});

	const savePlacement = async () => {
		const imageAsset = food?.image;
		const sourceReference = imageAsset?.sourceReference;
		if (!sourceReference || saveRequestInFlight) return;
		if (!placementHasChanged()) {
			placementError = "";
			placementMessage = "This card image placement is already saved.";
			return;
		}

		saveRequestInFlight = true;
		savingPlacement = true;
		placementMessage = "";
		placementError = "";
		const placementToSave = { ...draftPlacement };
		const foodId = food?.fdcId;
		try {
			const image = await updateFoodImagePlacement({
				source: imageAsset.source,
				sourceReference,
				role: imageAsset.role,
				imageUrl: imageAsset.imageUrl,
				baseRevision: imageAsset.placementRevision ?? 0,
				...placementToSave,
			});
			await onImagePlacementSave?.(image, foodId);
			placementMessage = "Your card image placement is saved.";
		} catch (error) {
			console.error("[image placement] Save failed", error);
			placementError = getUserFacingErrorMessage(error, {
				fallback:
					"We couldn't save this image placement. Restore the default or try again.",
				network:
					"We couldn't connect while saving. Check your connection and try again.",
				timeout: "Saving took too long. Check your connection and try again.",
			});
		} finally {
			saveRequestInFlight = false;
			savingPlacement = false;
		}
	};
	const saveForAccount = async (action: "personal" | "reset" | "suggest") => {
		const image = food?.image;
		if (!image?.assetId || saveRequestInFlight) return;
		const foodId = food?.fdcId;
		const requestImageKey = imageKey;
		saveRequestInFlight = true;
		savingPlacement = true;
		placementMessage = "";
		placementError = "";
		try {
			const result = await savePersonalImagePlacement(image, action, {
				...draftPlacement,
			});
			if (
				result.status === "personal_saved" ||
				result.status === "personal_reset"
			) {
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
					result.status === "personal_saved"
						? "Saved for your account. Everyone else’s view stays the same."
						: "You’re using the shared placement again.";
			} else if (imageKey !== requestImageKey) {
				return;
			} else if (result.status === "pending") {
				placementMessage =
					"Suggestion sent. It can be shared after enough trusted contributors agree or a moderator approves it.";
			} else if (result.status === "published") {
				placementMessage =
					"Enough contributors agreed. The shared placement is updated; refresh to see it.";
			} else if (result.status === "already_submitted") {
				placementMessage =
					"You’ve already suggested a placement for this version of the image.";
			} else if (result.status === "unchanged") {
				placementMessage = "This is already the shared placement.";
			} else {
				placementError =
					result.status === "locked"
						? "A moderator has locked the shared placement. You can still save your own view."
						: result.status === "stale"
							? "This image changed. Refresh before trying again."
							: result.status === "restricted"
								? "Shared suggestions are paused for your account. You can still save your own placement."
								: action === "personal"
									? "You’ve reached your saved-placement limit. Use shared placement on an older image to make room."
									: "You’ve reached a suggestion limit. Try another day or wait for pending suggestions to be reviewed.";
			}
		} catch (error) {
			if (imageKey !== requestImageKey) return;
			placementError = getUserFacingErrorMessage(error, {
				fallback: "We couldn’t save your placement. Please try again.",
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

{#snippet placementSummaryEnd()}
	{#if canPublishPlacement}<PrivilegedActionBadge />{/if}
{/snippet}

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
			onChange={(value) => {
				draftPlacement = value;
				placementMessage = "";
				placementError = "";
			}}
		/>
		<form
			class="product-image-panel__placement-save"
			onsubmit={handlePlacementSubmit}
		>
			<RoundedActionButton
				type="submit"
				variant="primary"
				fullWidth
				busy={savingPlacement}
			>
				{savingPlacement ? "Saving image placement…" : "Save for me"}
			</RoundedActionButton>
			<p>This changes your cards only. Sharing a suggestion is optional.</p>
			<RoundedActionButton
				type="button"
				fullWidth
				disabled={savingPlacement}
				onclick={() => void saveForAccount("reset")}
				>Use shared placement</RoundedActionButton
			>
			<RoundedActionButton
				type="button"
				fullWidth
				disabled={savingPlacement || food?.image?.communityPlacementLocked}
				onclick={() => void saveForAccount("suggest")}
				>Suggest for everyone</RoundedActionButton
			>
			{#if food?.image?.communityPlacementLocked}<p>
					A moderator has locked the shared placement. You can still save your
					own view.
				</p>{/if}
			{#if canPublishPlacement}
				<CollapsibleSection
					title="Moderator controls"
					summaryEnd={placementSummaryEnd}
				>
					<p>
						Publishing changes everyone’s cards and requires authenticator
						verification.
					</p>
					<RoundedActionButton
						type="button"
						fullWidth
						disabled={savingPlacement}
						onclick={() => void savePlacement()}
						>Publish shared placement</RoundedActionButton
					>
					<a
						href={`${resolve("/profile/privileged-tools/image-placement")}?image=${food?.image?.assetId}`}
						>Review suggestions, history and image lock</a
					>
				</CollapsibleSection>
			{/if}
			{#if placementMessage}
				<StatusMessage tone="success" message={placementMessage} />
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
