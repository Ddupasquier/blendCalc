<script lang="ts">
	import { enhance } from "$app/forms";
	import type { SubmitFunction } from "@sveltejs/kit";
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import type { NutrientMappingReviewProps } from "./types";

	let { workspace, form = null }: NutrientMappingReviewProps = $props();
	let pending = $state(false);
	let outcome = $state<"approved" | "excluded">("approved");
	let nutrientSearch = $state("");
	let selectedNutrientId = $state("");
	let initializedMappingId = $state("");

	$effect(() => {
		if (workspace.mapping.id === initializedMappingId) return;
		initializedMappingId = workspace.mapping.id;
		selectedNutrientId = String(workspace.mapping.currentNutrient.nutrientId);
	});

	const resolved = $derived(
		workspace.mapping.reviewStatus !== "pending_review",
	);
	const confidencePercent = $derived(
		`${Math.round(workspace.mapping.confidence * 100)}%`,
	);
	const filteredNutrients = $derived.by(() => {
		const query = nutrientSearch.trim().toLocaleLowerCase();
		const matches = query
			? workspace.compatibleNutrients.filter((nutrient) =>
					[
						nutrient.nutrientName,
						nutrient.nutrientNumber,
						nutrient.nutrientId,
					].some((value) =>
						String(value ?? "")
							.toLocaleLowerCase()
							.includes(query),
					),
				)
			: workspace.compatibleNutrients;
		const boundedMatches = matches.slice(0, 80);
		const selected = workspace.compatibleNutrients.find(
			(nutrient) => String(nutrient.nutrientId) === selectedNutrientId,
		);
		return selected &&
			!boundedMatches.some(
				(nutrient) => nutrient.nutrientId === selected.nutrientId,
			)
			? [selected, ...boundedMatches]
			: boundedMatches;
	});
	const nutrientOptions = $derived(
		filteredNutrients.map((nutrient) => ({
			value: String(nutrient.nutrientId),
			label: `${nutrient.nutrientName} · ${nutrient.defaultUnitName}`,
		})),
	);

	const enhanceDecision: SubmitFunction = ({ cancel }) => {
		if (pending) {
			cancel();
			return;
		}
		pending = true;
		return async ({ update }) => {
			try {
				await update({ reset: false });
			} finally {
				pending = false;
			}
		};
	};
</script>

<section class="nutrient-mapping-review" aria-label="Nutrient mapping review">
	{#if form?.nutrientMappingReviewError}
		<StatusMessage tone="danger" message={form.nutrientMappingReviewError} />
	{:else if form?.nutrientMappingReviewSuccess}
		<StatusMessage tone="success" message={form.nutrientMappingReviewSuccess} />
	{/if}

	<article class="nutrient-mapping-review__summary">
		<header>
			<div>
				<strong
					>{workspace.mapping.sourceNutrientName ??
						workspace.mapping.sourceNutrientKey}</strong
				>
				<span>{workspace.mapping.sourceDisplayName}</span>
			</div>
			<TextBadge
				label={resolved ? "Resolved" : "Needs review"}
				tone={resolved ? "success" : "warning"}
			/>
		</header>
		<dl class="nutrient-mapping-review__facts">
			<div>
				<dt>Provider key</dt>
				<dd>{workspace.mapping.sourceNutrientKey}</dd>
			</div>
			<div>
				<dt>Provider unit</dt>
				<dd>{workspace.mapping.sourceUnitName}</dd>
			</div>
			<div>
				<dt>Suggested nutrient</dt>
				<dd>{workspace.mapping.currentNutrient.nutrientName}</dd>
			</div>
			<div>
				<dt>Suggestion confidence</dt>
				<dd>{confidencePercent}</dd>
			</div>
			<div>
				<dt>Observations</dt>
				<dd>{workspace.mapping.observationCount}</dd>
			</div>
		</dl>
	</article>

	<CollapsibleSection title="Why this needs review" surface="panel">
		<div class="nutrient-mapping-review__explanation">
			<p>
				blendCalc found a possible match, but the provider key is not an exact
				reviewed identity. It stays disabled until evidence confirms what it
				represents.
			</p>
			{#if workspace.mapping.candidateReason}
				<p>{workspace.mapping.candidateReason}</p>
			{/if}
			<p>
				Approving this mapping affects future imports and reprocessing. It does
				not silently rewrite older nutrient records.
			</p>
		</div>
	</CollapsibleSection>

	{#if resolved}
		<StatusMessage
			tone="info"
			title="Review complete"
			message={workspace.mapping.reviewStatus === "approved"
				? "This provider key now has an approved nutrient identity."
				: "This candidate was excluded and remains unavailable to canonical nutrition data."}
		/>
		{#if workspace.latestDecision}
			<CollapsibleSection title="Recorded decision" surface="panel">
				<dl class="nutrient-mapping-review__facts">
					<div>
						<dt>Outcome</dt>
						<dd>{workspace.latestDecision.outcome}</dd>
					</div>
					<div>
						<dt>Review note</dt>
						<dd>{workspace.latestDecision.reviewNote}</dd>
					</div>
					{#if workspace.latestDecision.evidenceReference}
						<div>
							<dt>Evidence</dt>
							<dd>{workspace.latestDecision.evidenceReference}</dd>
						</div>
					{/if}
				</dl>
			</CollapsibleSection>
		{/if}
	{:else}
		<form
			class="nutrient-mapping-review__decision"
			method="POST"
			action="?/reviewNutrientMapping"
			use:enhance={enhanceDecision}
			aria-busy={pending}
		>
			<SelectField
				id="nutrient-mapping-outcome"
				name="outcome"
				label="Decision"
				value={outcome}
				onValueChange={(value) => (outcome = value as "approved" | "excluded")}
				options={[
					{ value: "approved", label: "Approve an exact nutrient identity" },
					{ value: "excluded", label: "Exclude this candidate" },
				]}
				disabled={pending}
				required
			/>

			{#if outcome === "approved"}
				<TextField
					id="nutrient-mapping-search"
					label="Find a compatible nutrient"
					type="search"
					value={nutrientSearch}
					placeholder="Search nutrient name, number, or ID"
					helper="Only nutrients with the same unit or a reviewed conversion are available."
					disabled={pending}
					oninput={(event) => (nutrientSearch = event.currentTarget.value)}
				/>
				<SelectField
					id="nutrient-mapping-selected-nutrient"
					name="selectedNutrientId"
					label="Confirmed nutrient"
					value={selectedNutrientId}
					onValueChange={(value) => (selectedNutrientId = value)}
					options={nutrientOptions}
					disabled={pending || nutrientOptions.length === 0}
					required
				/>
				<TextField
					id="nutrient-mapping-evidence-reference"
					name="evidenceReference"
					label="Evidence reference"
					placeholder="Provider documentation, standard, or reviewed source"
					helper="Record exactly where the nutrient identity was confirmed."
					maxlength={2000}
					disabled={pending}
					required
				/>
			{/if}

			<TextField
				id="nutrient-mapping-review-note"
				name="reviewNote"
				label="Review note"
				placeholder={outcome === "approved"
					? "How does the evidence prove this identity?"
					: "Why should this candidate remain unavailable?"}
				helper="Saved with the private, immutable decision record."
				maxlength={2000}
				multiline
				rows={4}
				disabled={pending}
				required
			/>

			<ActionButton
				type="submit"
				variant={outcome === "approved" ? "success" : "danger"}
				fullWidth
				busy={pending}
				disabled={pending ||
					(outcome === "approved" && nutrientOptions.length === 0)}
			>
				{outcome === "approved"
					? "Approve nutrient mapping"
					: "Exclude candidate"}
			</ActionButton>
		</form>
	{/if}
</section>

<style lang="scss">
	@use "./NutrientMappingReview.scss";
</style>
