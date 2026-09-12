<script lang="ts">
	import { enhance } from "$app/forms";
	import type { SubmitFunction } from "@sveltejs/kit";
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import RoundedActionLink from "$lib/components/common/buttons/RoundedActionLink/RoundedActionLink.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import type { DatasetImportEvidenceReviewProps } from "./types";

	let { workspace, form = null }: DatasetImportEvidenceReviewProps = $props();
	let pending = $state(false);
	let releaseVersion = $state("");
	let importedAt = $state("");
	let sourceFileSha256 = $state("");
	let evidenceReference = $state("");
	let reviewNote = $state("");
	let initializedInputFingerprint = "";

	$effect(() => {
		const values = form?.datasetImportEvidenceValues;
		const fingerprint = [
			workspace.dataset.key,
			values?.releaseVersion ?? "",
			values?.importedAt ?? "",
			values?.sourceFileSha256 ?? "",
			values?.evidenceReference ?? "",
		].join(":");
		if (fingerprint === initializedInputFingerprint) return;
		initializedInputFingerprint = fingerprint;
		releaseVersion = values?.releaseVersion ?? workspace.dataset.version;
		importedAt = values?.importedAt ?? "";
		sourceFileSha256 =
			values?.sourceFileSha256 ?? workspace.dataset.sourceFileSha256 ?? "";
		evidenceReference =
			values?.evidenceReference ??
			workspace.dataset.evidenceReference ??
			workspace.dataset.sourceUrl;
	});

	const preview = $derived(form?.datasetImportEvidencePreview ?? null);
	const canApply = $derived(
		preview?.outcome === "candidate" &&
			preview.willClearFinding &&
			reviewNote.trim().length >= 10,
	);
	const formatNumber = (value: number) => new Intl.NumberFormat().format(value);
	const formatDate = (value: string | null) => {
		if (!value) return "Missing";
		const date = new Date(value);
		return Number.isNaN(date.getTime())
			? "Invalid date"
			: new Intl.DateTimeFormat(undefined, {
					dateStyle: "medium",
					timeStyle: "short",
					timeZone: "UTC",
				}).format(date) + " UTC";
	};
	const formatChecksum = (value: string | null) =>
		value ? `${value.slice(0, 12)}…${value.slice(-12)}` : "Missing";
	const isMissing = (key: "imported_at" | "source_file_sha256") =>
		workspace.missingEvidence.includes(key);

	const enhanceAction: SubmitFunction = ({ cancel }) => {
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

<section class="dataset-evidence" aria-label="Dataset import evidence review">
	{#if form?.datasetImportEvidenceError}
		<StatusMessage tone="danger" message={form.datasetImportEvidenceError} />
	{/if}

	<article class="dataset-evidence__summary">
		<header>
			<div>
				<strong>{workspace.dataset.displayName}</strong>
				<span>{workspace.dataset.sourceDisplayName}</span>
			</div>
			<TextBadge
				label={workspace.actionRequired ? "Evidence missing" : "Complete"}
				tone={workspace.actionRequired ? "warning" : "success"}
			/>
		</header>
		<dl class="dataset-evidence__facts">
			<div>
				<dt>Dataset key</dt>
				<dd>{workspace.dataset.key}</dd>
			</div>
			<div>
				<dt>Release</dt>
				<dd>{workspace.dataset.version}</dd>
			</div>
			<div>
				<dt>Region</dt>
				<dd>{workspace.dataset.regionCode}</dd>
			</div>
			<div>
				<dt>Responsible role</dt>
				<dd>{workspace.responsibleRole}</dd>
			</div>
			<div>
				<dt>Import completed</dt>
				<dd data-missing={workspace.dataset.importedAt === null}>
					{formatDate(workspace.dataset.importedAt)}
				</dd>
			</div>
			<div>
				<dt>SHA-256</dt>
				<dd data-missing={workspace.dataset.sourceFileSha256 === null}>
					{formatChecksum(workspace.dataset.sourceFileSha256)}
				</dd>
			</div>
		</dl>
	</article>

	<CollapsibleSection
		title="Why this evidence is required"
		surface="panel"
		open
	>
		<div class="dataset-evidence__explanation">
			<p>
				The completion time proves when this exact release entered blendCalc.
				The SHA-256 identifies the exact source file and catches a changed or
				corrupted download.
			</p>
			<p>
				The evidence is used for provenance and publication checks. It does not
				approve a license, activate the dataset, alter imported food rows, or
				publish anything by itself.
			</p>
			<dl class="dataset-evidence__facts">
				<div>
					<dt>Imported records</dt>
					<dd>{formatNumber(workspace.dataset.foodCount)} foods</dd>
				</div>
				<div>
					<dt>Nutrition rows</dt>
					<dd>{formatNumber(workspace.dataset.nutrientValueCount)}</dd>
				</div>
				<div>
					<dt>Serving measures</dt>
					<dd>{formatNumber(workspace.dataset.measureCount)}</dd>
				</div>
			</dl>
			<a href={workspace.dataset.sourceUrl} target="_blank" rel="noreferrer">
				Open the official release page
			</a>
			<a href={workspace.dataset.licenseUrl} target="_blank" rel="noreferrer">
				Open the reviewed license
			</a>
		</div>
	</CollapsibleSection>

	{#if !workspace.actionRequired}
		<StatusMessage
			tone="success"
			title="No action needed"
			message="The import completion time and exact source-file checksum are already recorded. Return to Data operations; this finding should no longer be listed."
		/>
		{#if workspace.latestDecision}
			<CollapsibleSection title="Recorded decision" surface="panel">
				<dl class="dataset-evidence__facts">
					<div>
						<dt>Recorded</dt>
						<dd>{formatDate(workspace.latestDecision.recordedAt)}</dd>
					</div>
					<div>
						<dt>Evidence reference</dt>
						<dd>{workspace.latestDecision.evidenceReference}</dd>
					</div>
					<div>
						<dt>Private note</dt>
						<dd>{workspace.latestDecision.reviewNote}</dd>
					</div>
				</dl>
			</CollapsibleSection>
		{/if}
		<RoundedActionLink
			href="/profile/privileged-tools/data-operations"
			variant="primary"
			fullWidth
		>
			Return to Data operations
		</RoundedActionLink>
	{:else if preview?.outcome === "candidate"}
		<article class="dataset-evidence__preview" aria-live="polite">
			<header>
				<div>
					<span>Validated preview</span>
					<h2>This will complete the dataset evidence</h2>
				</div>
				<TextBadge label="Ready to apply" tone="success" />
			</header>
			<ul>
				{#if preview.willRecordImportTime}
					<li>
						Record import completion: {formatDate(preview.proposedImportedAt)}
					</li>
				{/if}
				{#if preview.willRecordChecksum}
					<li>Record SHA-256: {preview.proposedSourceFileSha256}</li>
				{/if}
				<li>Attach evidence reference: {preview.evidenceReference}</li>
				<li>
					Rerun the dataset health check and remove this finding only if it
					passes.
				</li>
			</ul>
			<p>
				Applying will not change the release, license status, activation state,
				or imported food data.
			</p>
		</article>

		<form
			class="dataset-evidence__decision"
			method="POST"
			action="?/applyDatasetImportEvidence"
			use:enhance={enhanceAction}
			aria-busy={pending}
		>
			<input type="hidden" name="previewId" value={preview.previewId} />
			<header class="dataset-evidence__decision-heading">
				<span>Final step</span>
				<h2>Apply the validated evidence</h2>
				<p>
					Apply writes only the missing canonical evidence, preserves an
					immutable audit record, and returns to the refreshed queue. Cancel
					leaves the dataset and queue unchanged; the private validation preview
					remains in the audit.
				</p>
			</header>
			<TextField
				id="dataset-evidence-review-note"
				name="reviewNote"
				label="Why is this evidence trustworthy?"
				placeholder="Name the import log, checksum command, or retained artifact you checked."
				helper="Required private audit note; at least 10 characters."
				minlength={10}
				maxlength={2000}
				multiline
				rows={4}
				disabled={pending}
				oninput={(event) => (reviewNote = event.currentTarget.value)}
				required
			/>
			<div class="dataset-evidence__actions">
				<RoundedActionLink
					href={`/profile/privileged-tools/data-operations/datasets/${encodeURIComponent(workspace.dataset.key)}`}
					variant="outline"
					fullWidth
				>
					Cancel preview and edit
				</RoundedActionLink>
				<ActionButton
					type="submit"
					variant="success"
					fullWidth
					busy={pending}
					disabled={!canApply}
				>
					Apply evidence and finish
				</ActionButton>
			</div>
		</form>
	{:else}
		<form
			class="dataset-evidence__decision"
			method="POST"
			action="?/previewDatasetImportEvidence"
			use:enhance={enhanceAction}
			aria-busy={pending}
		>
			<header class="dataset-evidence__decision-heading">
				<span>Record the evidence</span>
				<h2>Enter the artifacts from this exact import</h2>
				<p>
					Preview validates every field and changes no canonical dataset data.
					You will see the exact result and choose whether to apply it next.
				</p>
			</header>
			<TextField
				id="dataset-release-version"
				name="releaseVersion"
				label="1. Confirm the exact release"
				value={releaseVersion}
				helper={`Must exactly match the stored release: ${workspace.dataset.version}`}
				maxlength={100}
				disabled={pending}
				oninput={(event) => (releaseVersion = event.currentTarget.value)}
				required
			/>
			{#if isMissing("imported_at")}
				<TextField
					id="dataset-imported-at"
					name="importedAt"
					type="datetime-local"
					label="2. When did the import finish? (UTC)"
					value={importedAt}
					helper="Use the completion time from the retained import log, expressed in UTC."
					disabled={pending}
					oninput={(event) => (importedAt = event.currentTarget.value)}
					required
				/>
			{/if}
			{#if isMissing("source_file_sha256")}
				<TextField
					id="dataset-source-file-sha256"
					name="sourceFileSha256"
					label={isMissing("imported_at")
						? "3. What is the source file SHA-256?"
						: "2. What is the source file SHA-256?"}
					value={sourceFileSha256}
					placeholder="64 lowercase hexadecimal characters"
					helper="Copy the SHA-256 calculated from the exact downloaded release file."
					minlength={64}
					maxlength={64}
					disabled={pending}
					oninput={(event) =>
						(sourceFileSha256 = event.currentTarget.value.toLocaleLowerCase())}
					required
				/>
			{/if}
			<TextField
				id="dataset-evidence-reference"
				name="evidenceReference"
				label={`${workspace.missingEvidence.length + 2}. Where can this evidence be verified?`}
				value={evidenceReference}
				type="text"
				placeholder="https://…"
				helper="Use the retained HTTPS import log, release record, or source artifact reference."
				maxlength={500}
				disabled={pending}
				oninput={(event) => (evidenceReference = event.currentTarget.value)}
				required
			/>
			<ActionButton
				type="submit"
				variant="primary"
				fullWidth
				busy={pending}
				disabled={pending ||
					!releaseVersion.trim() ||
					(isMissing("imported_at") && !importedAt) ||
					(isMissing("source_file_sha256") &&
						sourceFileSha256.trim().length !== 64) ||
					!evidenceReference.startsWith("https://")}
			>
				Preview evidence
			</ActionButton>
		</form>
	{/if}
</section>

<style lang="scss">
	@use "./DatasetImportEvidenceReview.scss";
</style>
