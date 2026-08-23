<script lang="ts">
	import { enhance } from "$app/forms";
	import type { SubmitFunction } from "@sveltejs/kit";
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import {
		getCatalogHealthRepairItemLabel,
		getCatalogHealthRepairReasonLabel,
	} from "$lib/utils/moderation/catalogHealthRepair";
	import {
		getCatalogFieldLabel,
		getCatalogIssueCodeLabel,
		getCatalogIssueReasonLabel,
	} from "$lib/utils/moderation/catalogHealthMessages";
	import type { CatalogProductRepairControlsProps } from "./types";

	let { issues, form = null }: CatalogProductRepairControlsProps = $props();
	let pendingOccurrenceKey = $state<string | null>(null);

	const repairableIssues = $derived(
		issues.filter((issue) => issue.automatedRepairAllowed && issue.automatedRepairKey),
	);
	const formatRepairItemLabel = (itemKey: string) => {
		const genericLabel = getCatalogHealthRepairItemLabel(itemKey);
		return genericLabel === itemKey ? getCatalogFieldLabel(itemKey) : genericLabel;
	};
	const resultForIssue = (occurrenceKey: string) =>
		form?.catalogRepairOccurrenceKey === occurrenceKey
			? form.catalogRepairResult
			: undefined;
	const errorForIssue = (occurrenceKey: string) =>
		form?.catalogRepairOccurrenceKey === occurrenceKey
			? form.catalogRepairError
			: undefined;
	const enhanceRepair: SubmitFunction = ({ formData, cancel }) => {
		if (pendingOccurrenceKey) {
			cancel();
			return;
		}
		pendingOccurrenceKey = String(formData.get("occurrenceKey") ?? "");
		return async ({ update }) => {
			try {
				await update({ reset: false });
			} finally {
				pendingOccurrenceKey = null;
			}
		};
	};
</script>

{#if repairableIssues.length > 0}
	<CollapsibleSection
		title="Safe catalog repairs"
		badge={`${repairableIssues.length}`}
		open
		surface="panel"
	>
		<div class="catalog-product-repairs">
			<StatusMessage
				tone="info"
				message="These repairs use exact evidence already stored by blendCalc to reconnect source records or restore missing catalog history. They never guess, invent changes, or replace current product values."
			/>

			{#each repairableIssues as issue (issue.occurrenceKey)}
				{@const repairResult = resultForIssue(issue.occurrenceKey)}
				<article class="catalog-product-repairs__item">
					<header>
						<strong>{getCatalogIssueCodeLabel(issue.issueCode)}</strong>
						<TextBadge label="Safe repair available" tone="info" />
					</header>
					<p>{getCatalogIssueReasonLabel(issue.sourceReason)}</p>

					{#if errorForIssue(issue.occurrenceKey)}
						<StatusMessage tone="danger" message={errorForIssue(issue.occurrenceKey)} />
					{/if}

					{#if repairResult?.mode === "dry_run"}
						<StatusMessage
							tone={repairResult.candidateCount > 0 ? "success" : "warning"}
							title={repairResult.candidateCount > 0
								? "Exact evidence found"
								: "No safe changes found"}
							message={repairResult.candidateCount > 0
								? `${repairResult.candidateCount} ${repairResult.candidateCount === 1 ? "safe change is" : "safe changes are"} ready. ${repairResult.unresolvedCount > 0 ? `${repairResult.unresolvedCount} still need stronger evidence.` : "Nothing remains uncertain in this repair."}`
								: "The product was left unchanged because the stored evidence could not prove a safe repair."}
						/>

						{#if repairResult.items.length > 0}
							<ul class="catalog-product-repairs__results" aria-label="Safe repair check results">
								{#each repairResult.items as item (`${item.itemKey}:${item.reasonCode}`)}
									<li>
										<strong>{formatRepairItemLabel(item.itemKey)}</strong>
										<span>{getCatalogHealthRepairReasonLabel(item.reasonCode)}</span>
									</li>
								{/each}
							</ul>
						{/if}

						{#if repairResult.candidateCount > 0}
							<form method="POST" action="?/runCatalogRepair" use:enhance={enhanceRepair}>
								<input type="hidden" name="occurrenceKey" value={issue.occurrenceKey} />
								<input type="hidden" name="mode" value="apply" />
								<input type="hidden" name="dryRunId" value={repairResult.runId} />
								<ActionButton
									type="submit"
									variant="success"
									fullWidth
									busy={pendingOccurrenceKey === issue.occurrenceKey}
									disabled={pendingOccurrenceKey !== null}
								>Apply safe repair</ActionButton>
							</form>
						{:else}
							<form method="POST" action="?/runCatalogRepair" use:enhance={enhanceRepair}>
								<input type="hidden" name="occurrenceKey" value={issue.occurrenceKey} />
								<input type="hidden" name="mode" value="dry_run" />
								<ActionButton
									type="submit"
									variant="secondary"
									fullWidth
									busy={pendingOccurrenceKey === issue.occurrenceKey}
									disabled={pendingOccurrenceKey !== null}
								>Check again</ActionButton>
							</form>
						{/if}
					{:else}
						<form method="POST" action="?/runCatalogRepair" use:enhance={enhanceRepair}>
							<input type="hidden" name="occurrenceKey" value={issue.occurrenceKey} />
							<input type="hidden" name="mode" value="dry_run" />
							<ActionButton
								type="submit"
								variant="secondary"
								fullWidth
								busy={pendingOccurrenceKey === issue.occurrenceKey}
								disabled={pendingOccurrenceKey !== null}
							>Check repair</ActionButton>
						</form>
					{/if}
				</article>
			{/each}
		</div>
	</CollapsibleSection>
{/if}

<style lang="scss">
	@use "./CatalogProductRepairControls.scss";
</style>
