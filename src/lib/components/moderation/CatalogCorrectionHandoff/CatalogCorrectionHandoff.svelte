<script lang="ts">
	import { enhance } from "$app/forms";
	import type { SubmitFunction } from "@sveltejs/kit";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import RoundedActionLink from "$lib/components/common/buttons/RoundedActionLink/RoundedActionLink.svelte";
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import { getCatalogFieldLabel } from "$lib/utils/moderation/catalogHealthMessages";
	import type { CatalogCorrectionHandoffProps } from "./types";

	let {
		handoff,
		returnPath,
		allowConflictResolution = false,
	}: CatalogCorrectionHandoffProps = $props();
	let pendingConflictId = $state<string | null>(null);
	let resolutionNotes = $state<Record<string, string>>({});
	const activeFindings = $derived(
		handoff.findings.filter((finding) => finding.status !== "resolved"),
	);
	const submittedFindings = $derived(
		activeFindings.filter(
			(finding) => finding.status === "correction_submitted",
		),
	);
	const correctionAlreadyPending = $derived(
		submittedFindings.length > 0 || handoff.pendingSubmissionId !== null,
	);
	const correctionHref = $derived(
		handoff.applicationFoodId === null
			? null
			: `/ingredients/fridge/nutrition/${handoff.applicationFoodId}/correct-information?actions=hide&returnTo=${encodeURIComponent(returnPath)}`,
	);
	const enhanceResolution: SubmitFunction = ({ formData, cancel }) => {
		if (pendingConflictId) {
			cancel();
			return;
		}
		pendingConflictId = String(formData.get("conflictId") ?? "");
		return async ({ update }) => {
			try {
				await update();
			} finally {
				pendingConflictId = null;
			}
		};
	};
</script>

{#if activeFindings.length > 0}
	<section
		class="catalog-correction-handoff"
		aria-labelledby="catalog-correction-handoff-title"
	>
		<header>
			<div>
				<span>Correction workflow</span>
				<h2 id="catalog-correction-handoff-title">
					{correctionAlreadyPending
						? "A correction is already waiting for review"
						: "Start the exact catalog correction"}
				</h2>
			</div>
			<TextBadge
				label={`${activeFindings.length} ${activeFindings.length === 1 ? "finding" : "findings"}`}
				tone="warning"
			/>
		</header>

		<ul aria-label="Findings requiring a catalog correction">
			{#each activeFindings as finding (finding.id)}
				<li>
					<strong>{finding.label}</strong>
					<span>
						{finding.detail ??
							finding.affectedFieldPaths.map(getCatalogFieldLabel).join(", ")}
					</span>
					<small>
						{finding.status === "correction_submitted"
							? "A pending submission is linked to this exact finding. Do not create a duplicate."
							: "No correction submission is linked yet."}
					</small>
					{#if finding.evidence.length > 0}
						<dl class="catalog-correction-handoff__evidence">
							{#each finding.evidence as evidence}
								<div>
									<dt>{evidence.source}</dt>
									<dd>{evidence.value}</dd>
								</div>
							{/each}
						</dl>
					{/if}
					{#if allowConflictResolution && finding.type === "catalog_conflict" && finding.status === "needs_correction" && !correctionAlreadyPending}
						<form
							method="POST"
							action="?/resolveConflictWithoutCorrection"
							use:enhance={enhanceResolution}
						>
							<input type="hidden" name="conflictId" value={finding.id} />
							<header>
								<strong
									>Or keep the current value and close this conflict</strong
								>
								<span>
									Use this only when the current value is better supported. The
									product stays unchanged, this conflict leaves the queue, and
									API readiness is recalculated. Other blockers may still keep
									it withheld.
								</span>
							</header>
							<TextField
								id={`conflict-resolution-note-${finding.id}`}
								name="resolutionNote"
								label="Why is the current value better supported?"
								placeholder="Name the source and explain why it outweighs the conflicting observation."
								maxlength={2000}
								multiline
								rows={3}
								oninput={(event) =>
									(resolutionNotes = {
										...resolutionNotes,
										[finding.id]: event.currentTarget.value,
									})}
								required
							/>
							<ActionButton
								type="submit"
								variant="success"
								size="small"
								busy={pendingConflictId === finding.id}
								disabled={pendingConflictId !== null ||
									!resolutionNotes[finding.id]?.trim()}
							>
								Keep current value and resolve conflict
							</ActionButton>
						</form>
					{/if}
				</li>
			{/each}
		</ul>

		{#if correctionAlreadyPending}
			<div class="catalog-correction-handoff__outcome" data-tone="info">
				<strong>What happens next</strong>
				<p>
					Review the pending submission before creating more correction work.
					Approval creates a new revision and rechecks every finding. Rejection
					keeps the current product unchanged and leaves unresolved findings
					available for a better correction.
				</p>
				<RoundedActionLink
					href="/profile/privileged-tools/product-submissions"
					variant="primary"
					fullWidth
				>
					Review linked submission
				</RoundedActionLink>
			</div>
		{:else if correctionHref}
			<div class="catalog-correction-handoff__outcome">
				<strong>What happens if you submit a correction?</strong>
				<p>
					The prefilled form changes nothing immediately. Submitting creates one
					pending, evidence-backed correction and links every matching finding.
					Approval applies only the reviewed changes; rejection leaves the
					current catalog product unchanged.
				</p>
				<RoundedActionLink href={correctionHref} variant="primary" fullWidth>
					Open prefilled correction
				</RoundedActionLink>
			</div>
		{:else}
			<div class="catalog-correction-handoff__outcome" data-tone="warning">
				<strong>Correction cannot start yet</strong>
				<p>
					This product has no valid application food ID, so the existing
					correction form cannot load it. Nothing has changed; Data operations
					must restore the product identity first.
				</p>
			</div>
		{/if}
	</section>
{/if}

<style lang="scss">
	@use "./CatalogCorrectionHandoff.scss";
</style>
