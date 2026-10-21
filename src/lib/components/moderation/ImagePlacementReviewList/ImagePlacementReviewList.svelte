<script lang="ts">
	import { enhance } from "$app/forms";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import ImagePlacementCardPreview from "$lib/components/common/images/ImagePlacementCardPreview/ImagePlacementCardPreview.svelte";
	import AssetAttribution from "$lib/components/common/display/AssetAttribution/AssetAttribution.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import type { ImagePlacementReviewListProps } from "./types";
	let { workspace }: ImagePlacementReviewListProps = $props();
	let busy = $state(false);
	const submitReview = () => {
		busy = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			try {
				await update();
			} finally {
				busy = false;
			}
		};
	};
</script>

<div class="image-placement-reviews">
	{#each workspace.images as image (image.id)}
		<section
			class="image-placement-reviews__image"
			aria-label={`Placement review for ${image.name}`}
		>
			<h2>{image.name}</h2>
			<p>
				{image.locked
					? "Locked against community changes."
					: "Community suggestions are allowed."} Image revision {image.revision}.
			</p>
			<ImagePlacementCardPreview
				imageUrl={image.imageUrl}
				alt={`Current image for ${image.name}`}
				foodName={image.name}
				value={image.placement}
			/>
			<AssetAttribution
				licenseName={image.licenseName}
				licenseUrl={image.licenseUrl ?? undefined}
				attributionText={image.attributionText ?? undefined}
			/>
			<form method="POST" action="?/review" use:enhance={submitReview}>
				<input type="hidden" name="action" value="lock" /><input
					type="hidden"
					name="imageId"
					value={image.id}
				/>
				<input type="hidden" name="revision" value={image.revision} /><input
					type="hidden"
					name="enabled"
					value={String(!image.locked)}
				/>
				<RoundedActionButton type="submit" disabled={busy}
					>{image.locked
						? "Unlock community placement"
						: "Lock shared placement"}</RoundedActionButton
				>
			</form>
			{#each image.suggestions as suggestion (suggestion.id)}
				<section
					class="image-placement-reviews__proposal"
					aria-label="Grouped placement suggestion"
				>
					<h3>
						{suggestion.votes}
						{suggestion.votes === 1
							? "contributor suggests"
							: "contributors suggest"} this placement
					</h3>
					<p>
						{suggestion.eligibleVotes} count toward automatic approval. Large changes,
						different rotations, competing eligible suggestions and protected images
						need your decision.
					</p>
					<ImagePlacementCardPreview
						imageUrl={image.imageUrl}
						alt={`Suggested placement for ${image.name}`}
						foodName={image.name}
						value={suggestion.placement}
					/>
					<form method="POST" action="?/review" use:enhance={submitReview}>
						<input type="hidden" name="imageId" value={image.id} /><input
							type="hidden"
							name="revision"
							value={image.revision}
						/>
						<input type="hidden" name="suggestionId" value={suggestion.id} />
						<TextField
							id={`review-note-${suggestion.id}`}
							name="note"
							label="Review note (required to reject)"
							maxlength={1000}
							multiline
						/>
						<div class="image-placement-reviews__actions">
							<RoundedActionButton
								type="submit"
								name="action"
								value="approve"
								disabled={busy}>Approve for everyone</RoundedActionButton
							>
							<RoundedActionButton
								type="submit"
								name="action"
								value="reject"
								disabled={busy}>Reject group</RoundedActionButton
							>
						</div>
					</form>
					<CollapsibleSection title="Contributor controls">
						<p>
							Trust only people whose contributions you have checked.
							Restriction stops shared suggestions and excludes their votes;
							personal adjustments still work. Up to ten contributors are shown.
						</p>
						{#each suggestion.contributors as contributor (contributor.id)}
							<div class="image-placement-reviews__contributor">
								<p>Contributor {contributor.id.slice(-8)}</p>
								{#each ["trust", "restrict"] as action (action)}
									<form
										method="POST"
										action="?/review"
										use:enhance={submitReview}
									>
										<input type="hidden" name="action" value={action} /><input
											type="hidden"
											name="userId"
											value={contributor.id}
										/>
										<input
											type="hidden"
											name="enabled"
											value={String(
												action === "trust"
													? !contributor.trusted
													: !contributor.restricted,
											)}
										/>
										<RoundedActionButton type="submit" disabled={busy}
											>{action === "trust"
												? contributor.trusted
													? "Remove trusted status"
													: "Mark as trusted"
												: contributor.restricted
													? "Allow shared suggestions"
													: "Restrict shared suggestions"}</RoundedActionButton
										>
									</form>
								{/each}
							</div>
						{/each}
					</CollapsibleSection>
				</section>
			{:else}<p>No pending suggestions for this image.</p>{/each}
			<CollapsibleSection title="Placement history">
				{#each image.history as entry (entry.revision)}
					<div class="image-placement-reviews__history">
						<p>Revision {entry.revision} · {entry.createdAt}</p>
						{#if entry.canUndo}
							<ImagePlacementCardPreview
								imageUrl={image.imageUrl}
								alt={`Previous placement before revision ${entry.revision}`}
								foodName={image.name}
								value={entry.previous}
							/>
							<form method="POST" action="?/review" use:enhance={submitReview}>
								<input type="hidden" name="action" value="undo" /><input
									type="hidden"
									name="imageId"
									value={image.id}
								/>
								<input type="hidden" name="revision" value={image.revision} />
								<RoundedActionButton type="submit" disabled={busy}
									>Restore previous placement and lock</RoundedActionButton
								>
							</form>
						{/if}
					</div>
				{:else}<p>No shared placement changes recorded yet.</p>{/each}
			</CollapsibleSection>
		</section>
	{:else}<p>No image placements need attention.</p>{/each}
</div>

<style lang="scss">
	@use "./ImagePlacementReviewList.scss";
</style>
