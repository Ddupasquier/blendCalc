<script lang="ts">
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import {
		getCatalogFieldLabel,
		getCatalogHealthStatusLabel,
		getCatalogResponsibleGroupLabel,
	} from "$lib/utils/moderation/catalogHealthMessages";
	import type { FoodWarningFollowUpListProps } from "./types";

	let { followUps }: FoodWarningFollowUpListProps = $props();

	const followUpCount = $derived(
		followUps.productCorrections.length + followUps.policyReviews.length,
	);
	const formatFieldList = (fields: string[]) =>
		fields.map(getCatalogFieldLabel).join(", ");
</script>

{#if followUpCount > 0}
	<CollapsibleSection
		title="Warning follow-up work"
		badge={String(followUpCount)}
		surface="panel"
		open
	>
		<div class="food-warning-follow-up-list">
			{#each followUps.productCorrections as correction (correction.id)}
				<article class="food-warning-follow-up-list__item">
					<header>
						<div>
							<strong>{correction.productName}</strong>
							<span>{correction.barcode}</span>
						</div>
						<TextBadge
							label={correction.status === "linked"
								? "Correction submitted"
								: "Correction needed"}
							tone="warning"
						/>
					</header>
					<p>
						A confirmed warning report needs evidence-backed updates to
						{formatFieldList(correction.affectedFieldPaths)}.
					</p>
					<a
						href={`/profile/privileged-tools/catalog-review-work/products/${encodeURIComponent(correction.sharedProductId)}`}
					>
						Review product and correction status
					</a>
				</article>
			{/each}

			{#each followUps.policyReviews as reviewCase (reviewCase.id)}
				<article class="food-warning-follow-up-list__item">
					<header>
						<div>
							<strong>{reviewCase.productName}</strong>
							<span
								>{reviewCase.barcode ??
									reviewCase.sourceKey ??
									"Source unavailable"}</span
							>
						</div>
						<TextBadge
							label={getCatalogHealthStatusLabel(reviewCase.status)}
							tone="warning"
						/>
					</header>
					<p>
						{reviewCase.caseType === "rule_review"
							? "The food-warning rule needs an evidence review."
							: "The source mapping needs an evidence-backed correction."}
					</p>
					<p class="food-warning-follow-up-list__owner">
						Owner: {getCatalogResponsibleGroupLabel(
							reviewCase.responsibleGroup,
						)}
					</p>
				</article>
			{/each}
		</div>
	</CollapsibleSection>
{/if}

<style lang="scss">
	@use "./FoodWarningFollowUpList.scss";
</style>
