<script lang="ts">
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import NumberInput from "$lib/components/common/forms/NumberInput/NumberInput.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import type { CatalogConflictEvidence } from "$lib/server/moderation/catalogCorrectionHandoff.server";
	import type {
		CatalogConflictDecision,
		CatalogConflictDecisionWorkbenchProps,
	} from "./types";

	let { productId, handoff }: CatalogConflictDecisionWorkbenchProps = $props();
	const findings = $derived(
		handoff.findings.filter(
			(finding) =>
				finding.type === "catalog_conflict" &&
				finding.status === "needs_correction",
		),
	);
	const createInitialDecisions = () =>
		Object.fromEntries(
			handoff.findings
				.filter(
					(finding) =>
						finding.type === "catalog_conflict" &&
						finding.status === "needs_correction",
				)
				.map((finding) => [
					finding.id,
					{
						outcome: "",
						observationIndex: String(finding.evidence[0]?.index ?? ""),
						note: "",
						replacementValue: "",
						evidenceReference: "",
					},
				]),
		);
	let decisions = $state<Record<string, CatalogConflictDecision>>(
		createInitialDecisions(),
	);

	const decisionOptions = [
		{
			value: "",
			label: "Choose what the evidence supports",
			placeholder: true,
		},
		{ value: "keep_current", label: "Keep the stored value" },
		{ value: "use_observation", label: "Use a provider observation" },
		{ value: "use_other", label: "Enter another evidenced value" },
		{
			value: "insufficient_evidence",
			label: "Cannot determine from current evidence",
		},
	] as const;
	const updateDecision = (
		id: string,
		patch: Partial<CatalogConflictDecision>,
	) => {
		decisions = {
			...decisions,
			[id]: { ...decisions[id], ...patch },
		};
	};
	const eligibleProviderEvidence = (finding: (typeof findings)[number]) =>
		finding.evidence.filter(
			(evidence) =>
				evidence.index !== null &&
				evidence.amountPer100g !== null &&
				evidence.redistributionAllowed === true,
		);
	const noteIsValid = (note: string) => note.trim().length >= 20;
	const decisionIsComplete = (finding: (typeof findings)[number]) => {
		const decision = decisions[finding.id];
		if (!decision || !noteIsValid(decision.note)) return false;
		if (decision.outcome === "keep_current")
			return finding.currentValue !== null;
		if (decision.outcome === "insufficient_evidence") return true;
		if (decision.outcome === "use_observation") {
			return eligibleProviderEvidence(finding).some(
				(evidence) => String(evidence.index) === decision.observationIndex,
			);
		}
		if (decision.outcome === "use_other") {
			const value = Number(decision.replacementValue);
			return (
				Number.isFinite(value) &&
				value >= 0 &&
				decision.evidenceReference.trim().length >= 8
			);
		}
		return false;
	};
	const completedCount = $derived(findings.filter(decisionIsComplete).length);
	const serializedDecisions = $derived(
		JSON.stringify(
			findings.map((finding) => {
				const decision = decisions[finding.id];
				return {
					conflictId: finding.id,
					outcome: decision.outcome,
					note: decision.note.trim(),
					...(decision.outcome === "use_observation"
						? { observationIndex: Number(decision.observationIndex) }
						: {}),
					...(decision.outcome === "use_other"
						? {
								replacementValue: Number(decision.replacementValue),
								evidenceReference: decision.evidenceReference.trim(),
							}
						: {}),
				};
			}),
		),
	);
	const dateFormatter = new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
	});
	const formatDate = (value: string | null) => {
		if (!value) return "Date not recorded";
		const date = new Date(value);
		return Number.isNaN(date.getTime())
			? "Date not recorded"
			: dateFormatter.format(date);
	};
	const formatSourceType = (value: string | null) =>
		value ? value.replaceAll("_", " ") : "Source type not recorded";
	const perServingValue = (evidence: CatalogConflictEvidence) => {
		if (evidence.amountPer100g === null || handoff.servingWeightGrams == null)
			return null;
		return `${((evidence.amountPer100g * handoff.servingWeightGrams) / 100).toLocaleString(undefined, { maximumFractionDigits: 3 })} ${evidence.unit ?? ""} per ${handoff.servingWeightGrams.toLocaleString()} g serving`;
	};
	const difference = (
		current: CatalogConflictEvidence | null,
		candidate: CatalogConflictEvidence,
	) => {
		if (
			current?.amountPer100g === null ||
			current?.amountPer100g === undefined ||
			candidate.amountPer100g === null ||
			current.unit !== candidate.unit
		)
			return "Not directly calculable";
		const delta = candidate.amountPer100g - current.amountPer100g;
		const percent =
			current.amountPer100g === 0
				? null
				: (delta / current.amountPer100g) * 100;
		return `${delta >= 0 ? "+" : ""}${delta.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${current.unit ?? ""}${percent === null ? "" : ` (${percent >= 0 ? "+" : ""}${percent.toLocaleString(undefined, { maximumFractionDigits: 1 })}%)`}`;
	};
	const outcomeCopy = (outcome: string) =>
		({
			keep_current:
				"The stored value stays unchanged, this conflict closes, and API readiness is recalculated.",
			use_observation:
				"One correction submission will use the selected provider value. The product stays unchanged until another reviewer approves it.",
			use_other:
				"One correction submission will use your entered value and exact evidence reference. The product stays unchanged until approval.",
			insufficient_evidence:
				"This evidence snapshot leaves the work queue, but the conflict remains recorded and the API stays withheld. New evidence reopens it.",
		})[outcome] ?? "Choose an outcome to see exactly what it will do.";
</script>

{#if findings.length > 0}
	<form
		class="catalog-conflict-workbench"
		method="POST"
		action="?/finishConflictReview"
	>
		<input type="hidden" name="productId" value={productId} />
		<input type="hidden" name="decisions" value={serializedDecisions} />
		<header class="catalog-conflict-workbench__heading">
			<div>
				<span>Catalog conflict review</span>
				<h2>
					Decide the {findings.length} actual {findings.length === 1
						? "conflict"
						: "conflicts"}
				</h2>
				<p>
					Each row is one field-level decision. Nothing changes until you finish
					the entire review.
				</p>
			</div>
			<strong>{completedCount} of {findings.length} decided</strong>
		</header>

		<ol aria-label="Catalog conflicts">
			{#each findings as finding, findingIndex (finding.id)}
				<li class="catalog-conflict-workbench__finding">
					<header>
						<span>Decision {findingIndex + 1} of {findings.length}</span>
						<h3>{finding.fieldLabel}</h3>
						<p>
							All nutrient values are normalized per 100 g so they can be
							compared directly.
						</p>
					</header>

					<div class="catalog-conflict-workbench__comparison">
						<article data-current="true">
							<span>Stored value</span>
							{#if finding.currentValue}
								<strong>{finding.currentValue.value}</strong>
								{#if perServingValue(finding.currentValue)}<small
										>{perServingValue(finding.currentValue)}</small
									>{/if}
								<dl>
									<div>
										<dt>Source</dt>
										<dd>{finding.currentValue.source}</dd>
									</div>
									<div>
										<dt>Observed</dt>
										<dd>{formatDate(finding.currentValue.observedAt)}</dd>
									</div>
									<div>
										<dt>Type</dt>
										<dd>{formatSourceType(finding.currentValue.sourceType)}</dd>
									</div>
									<div>
										<dt>Public API rights</dt>
										<dd>
											{finding.currentValue.redistributionAllowed === true
												? "Allowed"
												: finding.currentValue.redistributionAllowed === false
													? "Not allowed"
													: "Not recorded"}
										</dd>
									</div>
								</dl>
							{:else}
								<strong>Stored value unavailable</strong>
								<small>Do not choose “keep stored value.”</small>
							{/if}
						</article>

						{#each finding.evidence as evidence}
							<article>
								<span>Provider observation</span>
								<strong>{evidence.value}</strong>
								{#if perServingValue(evidence)}<small
										>{perServingValue(evidence)}</small
									>{/if}
								<dl>
									<div>
										<dt>Source</dt>
										<dd>{evidence.source}</dd>
									</div>
									<div>
										<dt>Observed</dt>
										<dd>{formatDate(evidence.observedAt)}</dd>
									</div>
									<div>
										<dt>Difference</dt>
										<dd>{difference(finding.currentValue, evidence)}</dd>
									</div>
									<div>
										<dt>Public API rights</dt>
										<dd>
											{evidence.redistributionAllowed === true
												? "Allowed"
												: evidence.redistributionAllowed === false
													? "Not allowed"
													: "Not recorded"}
										</dd>
									</div>
								</dl>
								{#if evidence.sourceUrl}<a
										href={evidence.sourceUrl}
										target="_blank"
										rel="noreferrer">Open provider documentation</a
									>{/if}
							</article>
						{/each}
					</div>

					<div class="catalog-conflict-workbench__decision">
						<SelectField
							id={`conflict-outcome-${finding.id}`}
							label={`What should happen to ${finding.fieldLabel}?`}
							options={decisionOptions.map((option) => ({
								...option,
								disabled:
									(option.value === "keep_current" && !finding.currentValue) ||
									(option.value === "use_observation" &&
										eligibleProviderEvidence(finding).length === 0),
							}))}
							value={decisions[finding.id].outcome}
							onValueChange={(value) =>
								updateDecision(finding.id, { outcome: value })}
							required
						/>
						<p class="catalog-conflict-workbench__outcome-copy">
							{outcomeCopy(decisions[finding.id].outcome)}
						</p>

						{#if decisions[finding.id].outcome === "use_observation"}
							<SelectField
								id={`conflict-observation-${finding.id}`}
								label="Which provider value should replace the stored value?"
								options={eligibleProviderEvidence(finding).map((evidence) => ({
									value: String(evidence.index),
									label: `${evidence.value} — ${evidence.source}`,
								}))}
								value={decisions[finding.id].observationIndex}
								onValueChange={(value) =>
									updateDecision(finding.id, { observationIndex: value })}
								required
							/>
						{:else if decisions[finding.id].outcome === "use_other"}
							<label
								class="catalog-conflict-workbench__number-label"
								for={`conflict-value-${finding.id}`}
							>
								<span
									>Replacement value per 100 g ({finding.currentValue?.unit ??
										"stored unit"})</span
								>
								<NumberInput
									id={`conflict-value-${finding.id}`}
									class="catalog-conflict-workbench__number-input"
									placeholder="Enter the evidenced value"
									min={0}
									value={decisions[finding.id].replacementValue}
									onValueChange={(value) =>
										updateDecision(finding.id, { replacementValue: value })}
								/>
							</label>
							<TextField
								id={`conflict-reference-${finding.id}`}
								label="Exact evidence reference"
								placeholder="Label photo, standard, record ID, or documentation URL"
								value={decisions[finding.id].evidenceReference}
								oninput={(event) =>
									updateDecision(finding.id, {
										evidenceReference: event.currentTarget.value,
									})}
								maxlength={500}
								required
							/>
						{/if}

						{#if decisions[finding.id].outcome}
							<TextField
								id={`conflict-note-${finding.id}`}
								label={decisions[finding.id].outcome === "keep_current"
									? "Why is the stored value better supported?"
									: decisions[finding.id].outcome === "insufficient_evidence"
										? "What evidence is missing or inconclusive?"
										: "Why does this evidence support the replacement?"}
								placeholder="Name the specific source and explain this field-level decision."
								value={decisions[finding.id].note}
								oninput={(event) =>
									updateDecision(finding.id, {
										note: event.currentTarget.value,
									})}
								minlength={20}
								maxlength={2000}
								multiline
								rows={3}
								required
							/>
						{/if}
					</div>
				</li>
			{/each}
		</ol>

		<footer class="catalog-conflict-workbench__finish">
			<div>
				<strong>{completedCount} of {findings.length} decisions complete</strong
				>
				<span
					>Finishing records every outcome together, recalculates readiness, and
					opens the next product.</span
				>
			</div>
			<ActionButton
				type="submit"
				variant="success"
				disabled={completedCount !== findings.length}
			>
				Finish product review
			</ActionButton>
		</footer>
	</form>
{/if}

<style lang="scss">
	@use "./CatalogConflictDecisionWorkbench.scss";
</style>
