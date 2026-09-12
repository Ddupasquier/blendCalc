<script lang="ts">
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import RoundedActionLink from "$lib/components/common/buttons/RoundedActionLink/RoundedActionLink.svelte";
	import { getCatalogResolutionActionLabel } from "$lib/utils/moderation/catalogHealthMessages";
	import type { CatalogDataOperationsWorkListProps } from "./types";

	let {
		actionCount,
		actionSubjects,
		actionSubjectsTruncated,
	}: CatalogDataOperationsWorkListProps = $props();
	const numberFormatter = new Intl.NumberFormat();
	const formatNumber = (value: number) => numberFormatter.format(value);
	const getSubjectTypeLabel = (subjectType: string) => {
		switch (subjectType) {
			case "shared_product":
				return "Catalog product";
			case "nutrient_mapping":
				return "Nutrient identity";
			case "generic_food_dataset":
				return "Dataset";
			case "product_data_source":
				return "Product source";
			case "food_preference":
				return "Food-warning policy";
			default:
				return "Data operation";
		}
	};
	const getDestinationLabel = (subjectType: string) => {
		if (subjectType === "nutrient_mapping") return "Review nutrient identity";
		if (subjectType === "generic_food_dataset") {
			return "Record dataset evidence";
		}
		return "Open product readiness";
	};
</script>

<section
	class="catalog-data-operations-work-list"
	aria-labelledby="catalog-data-operations-required-work-title"
>
	<header class="catalog-data-operations-work-list__heading">
		<h2 id="catalog-data-operations-required-work-title">Required work</h2>
		<p>
			Each card is one deduplicated subject. Global health metrics live on the
			Admin tools dashboard.
		</p>
	</header>
	{#if actionCount === null || actionSubjects === null}
		<article class="catalog-data-operations-work-list__card">
			<header>
				<strong>Queue status unavailable</strong>
				<TextBadge label="Unknown" tone="warning" />
			</header>
			<p>
				Return to the privileged-tools dashboard and refresh before treating
				this queue as clear.
			</p>
		</article>
	{:else if actionCount === 0}
		<article class="catalog-data-operations-work-list__card" data-clear="true">
			<header>
				<strong>No tracked operator work</strong>
				<TextBadge label="Clear" tone="success" />
			</header>
			<p>No enabled data-operations issue currently needs a person.</p>
		</article>
	{:else}
		<div class="catalog-data-operations-work-list__items">
			{#each actionSubjects as subject (`${subject.subjectType}:${subject.subjectKey}`)}
				<article
					class="catalog-data-operations-work-list__card"
					data-severity={subject.severity}
				>
					<header>
						<div>
							<span class="catalog-data-operations-work-list__type">
								{getSubjectTypeLabel(subject.subjectType)}
							</span>
							<strong>{subject.displayName}</strong>
							{#if subject.context}<small>{subject.context}</small>{/if}
						</div>
						<TextBadge
							label={`${formatNumber(subject.issueCount)} ${subject.issueCount === 1 ? "finding" : "findings"}`}
							tone="warning"
						/>
					</header>
					<ul aria-label={`Findings for ${subject.displayName}`}>
						{#each subject.issues as issue}
							<li>
								<strong>{issue.summary}</strong>
								<span>
									Next: {getCatalogResolutionActionLabel(
										issue.resolutionAction,
									)}
								</span>
							</li>
						{/each}
					</ul>
					{#if subject.destination}
						<div class="catalog-data-operations-work-list__action">
							<strong>What happens next</strong>
							<p>
								Opening the focused review changes nothing. It shows the
								evidence and enables only supported decisions or repairs.
							</p>
							<RoundedActionLink
								href={subject.destination}
								variant="primary"
								fullWidth
							>
								{getDestinationLabel(subject.subjectType)}
							</RoundedActionLink>
						</div>
					{:else}
						<div
							class="catalog-data-operations-work-list__action"
							data-unavailable="true"
						>
							<strong>Cannot finish this in the app yet</strong>
							<p>{subject.missingPrerequisite}</p>
							<p>
								Nothing changes until that workflow records reviewed evidence.
							</p>
						</div>
					{/if}
				</article>
			{/each}
			{#if actionSubjectsTruncated}
				<p class="catalog-data-operations-work-list__limit" role="status">
					Showing the first {formatNumber(actionSubjects.length)} of {formatNumber(
						actionCount,
					)} named subjects. Finish or repair these first, then refresh for the next
					batch.
				</p>
			{/if}
		</div>
	{/if}
</section>

<style lang="scss">
	@use "./CatalogDataOperationsWorkList.scss";
</style>
