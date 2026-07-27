<script lang="ts">
	import { enhance } from "$app/forms";
	import type { SubmitFunction } from "@sveltejs/kit";
	import PrivilegedActionBadge from "$lib/components/common/badges/PrivilegedActionBadge/PrivilegedActionBadge.svelte";
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import InputLoadingFrame from "$lib/components/common/forms/InputLoadingFrame/InputLoadingFrame.svelte";
	import ImagePlacementEditor from "$lib/components/common/images/ImagePlacementEditor/ImagePlacementEditor.svelte";
	import type { ImagePlacementValue } from "$lib/utils/food/images/types";
	import { formatDocumentTitle } from "$lib/config/pageMetadata";
	import type { PageData } from "./$types";
	import type { ModerationPageProps } from "./types";

	let { data, form }: ModerationPageProps = $props();
	let pendingTargetUserId = $state<string | null>(null);
	let searching = $state(false);
	let imageCropBySubmission = $state<Record<string, ImagePlacementValue>>({});

	const getImageCrop = (
		submission: PageData["productSubmissions"][number],
	) => imageCropBySubmission[submission.id] ?? submission.imageCrop;

	const setImageCrop = (
		submission: PageData["productSubmissions"][number],
		value: ImagePlacementValue,
	) => {
		imageCropBySubmission = {
			...imageCropBySubmission,
			[submission.id]: value,
		};
	};

	const hasAccountModerationAction = (
		user: PageData["users"][number],
	) => user.status === "banned" || (
		user.id !== data.viewerUserId &&
		user.role !== "admin" &&
		!(data.viewerRole === "moderator" && user.role)
	);

	const enhanceModerationAction: SubmitFunction = ({ formData, cancel }) => {
		if (pendingTargetUserId) {
			cancel();
			return;
		}

		pendingTargetUserId = String(
			formData.get("targetUserId") ?? formData.get("submissionId") ?? "",
		);
		return async ({ update }) => {
			try {
				await update();
			} finally {
				pendingTargetUserId = null;
			}
		};
	};
</script>

<svelte:head>
	<title>{formatDocumentTitle("Moderation")}</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="moderation-page">
	<header>
		<p class="eyebrow">{data.viewerRole}</p>
		<h1>Moderation</h1>
		<p>Review profile images and block accounts that violate the community rules.</p>
	</header>

	<section class="account-search" aria-labelledby="account-search-title">
		<div>
			<h2 id="account-search-title">Find an account</h2>
			<p>Search by preferred name, email address, user ID, role, or status.</p>
		</div>
		<form method="GET" role="search" onsubmit={() => (searching = true)}>
			<label for="moderation-search">Account search</label>
			<div class="search-controls">
				<InputLoadingFrame loading={searching} loadingLabel="Searching accounts">
					<input
						id="moderation-search"
						type="search"
						name="q"
						value={data.query}
						placeholder="Name, email, user ID..."
						autocomplete="off"
						disabled={searching}
					/>
				</InputLoadingFrame>
				<button class="search-action" type="submit" disabled={searching}>
					{#if searching}<LoadingSpinner size="small" decorative />{/if}
					Search
				</button>
				{#if data.query}
					<a class="clear-search" href="/moderation">Clear</a>
				{/if}
			</div>
		</form>
		<p class="result-count" aria-live="polite">
			{#if data.query}
				{data.resultCount} of {data.totalCount} accounts shown
			{:else}
				{data.totalCount} accounts
			{/if}
		</p>
	</section>

	{#if form?.moderationError}
		<StatusMessage tone="danger" message={form.moderationError} />
	{:else if form?.moderationWarning}
		<StatusMessage tone="warning" message={form.moderationWarning} />
	{:else if form?.moderationSuccess}
		<StatusMessage tone="success" message={form.moderationSuccess} />
	{/if}

	<section class="product-review" aria-labelledby="product-review-title">
		<div>
			<p class="eyebrow">Shared catalog</p>
			<h2 id="product-review-title">Product submissions</h2>
			<p>Compare the entered values with the package photos before publishing them.</p>
		</div>

		{#if form?.productReviewError}
			<StatusMessage tone="danger" message={form.productReviewError} />
		{:else if form?.productReviewSuccess}
			<StatusMessage tone="success" message={form.productReviewSuccess} />
		{/if}

		<div class="product-review__list">
			{#each data.productSubmissions as submission (submission.id)}
				<article class="product-card">
					<header>
						<div>
							<strong>{submission.productName}</strong>
							{#if submission.brandOwner}<span>{submission.brandOwner}</span>{/if}
						</div>
						<div class="product-card__statuses">
							{#if submission.isQaFixture}<span class="status status--qa">QA fixture</span>{/if}
							{#if submission.updateReview}<span class="status">product update</span>{/if}
							<span class="status">pending</span>
							<PrivilegedActionBadge />
						</div>
					</header>
					<dl>
						<div><dt>Barcode</dt><dd>{submission.barcode}</dd></div>
						<div>
							<dt>Source match</dt>
							<dd>{submission.matchedSource ?? "No verified source"}</dd>
						</div>
						<div><dt>Evidence</dt><dd>{submission.evidenceComplete ? "Complete" : "Incomplete"}</dd></div>
						<div><dt>Detected conflicts</dt><dd>{submission.conflictCount}</dd></div>
					</dl>
					{#if submission.updateReview}
						<section class="product-card__update" aria-label="Proposed catalog update">
							<div>
								<strong>Existing product update</strong>
								<p>
									Compared with blendCalc revision {submission.updateReview.baseRevisionNumber} from the active catalog. Label observed {submission.labelObservedDate}.
								</p>
							</div>
							<ul>
								{#each submission.updateReview.changes as change (change.field)}
									<li>
										<strong>{change.label}</strong>
										<span>{change.previousValue} → {change.submittedValue}</span>
									</li>
								{/each}
							</ul>
							<div>
								<strong>External checks</strong>
								<ul>
									{#each submission.updateReview.sourceChecks as sourceCheck (sourceCheck.source)}
										<li>
											<span>{sourceCheck.source}</span>
											<strong>{sourceCheck.status}</strong>
										</li>
									{/each}
								</ul>
							</div>
						</section>
					{/if}
					{#if submission.externalLookupFailed}
						<p class="product-card__notice">
							We couldn't compare this submission with an outside food database.
							Review the package label carefully.
						</p>
					{/if}
					{#if submission.validationIssues.length > 0}
						<div class="product-card__notice product-card__notice--danger">
							<strong>Review flags</strong>
							<ul>
								{#each submission.validationIssues as issue}<li>{issue}</li>{/each}
							</ul>
						</div>
					{/if}
					{#if submission.isQaFixture}
						<p class="product-card__notice">
							This is a test submission. Use Reject to exercise moderation without publishing fake data.
						</p>
					{/if}
					{#if submission.evidence.length > 0}
						<div class="product-card__evidence" aria-label="Private product evidence">
							{#each submission.evidence as evidence (evidence.key)}
								<a href={evidence.url} target="_blank" rel="noreferrer">
									<img src={evidence.url} alt={evidence.label} />
									<span>{evidence.label}</span>
								</a>
							{/each}
						</div>
					{:else}
						<p class="product-card__notice product-card__notice--danger">
							This older submission has no label evidence and cannot be approved.
						</p>
					{/if}
					{#if submission.frontEvidenceUrl}
							<ImagePlacementEditor
								imageUrl={submission.frontEvidenceUrl}
								alt="Product image preview"
								foodName={submission.productName}
								brandName={submission.brandOwner ?? ""}
								category="Catalog product"
								title="Card image preview"
								description="Drag the image in the card preview or use the controls before approving."
								value={getImageCrop(submission)}
							onChange={(value) => setImageCrop(submission, value)}
						/>
					{/if}
					<details>
						<summary>Review {submission.nutrients.length} nutrition values</summary>
						<ul>
							{#each submission.nutrients as nutrient}
								<li>
									<span>{nutrient.name}</span>
									<strong>{nutrient.value} {nutrient.unit}</strong>
								</li>
							{/each}
						</ul>
					</details>
					<div class="product-card__actions">
						<form method="POST" action="?/approveProduct" use:enhance={enhanceModerationAction}>
							<input type="hidden" name="submissionId" value={submission.id} />
							<input type="hidden" name="imageCropX" value={getImageCrop(submission).cropX} />
							<input type="hidden" name="imageCropY" value={getImageCrop(submission).cropY} />
							<input type="hidden" name="imageCropZoom" value={getImageCrop(submission).cropZoom} />
							<input type="hidden" name="imageFitMode" value={getImageCrop(submission).fitMode} />
							<input type="hidden" name="imagePlacementVersion" value={getImageCrop(submission).placementVersion} />
							<input type="hidden" name="imagePlacementMethod" value={getImageCrop(submission).placementMethod ?? "manual"} />
							<input type="hidden" name="imageSuggestionVersion" value={getImageCrop(submission).suggestionVersion ?? ""} />
							<input type="hidden" name="imageSuggestionConfidence" value={getImageCrop(submission).suggestionConfidence ?? ""} />
							<button
								type="submit"
								disabled={pendingTargetUserId !== null || !submission.evidenceComplete || submission.isQaFixture}
							>
								{#if pendingTargetUserId === submission.id}<LoadingSpinner size="small" decorative />{/if}
								<span>Approve</span>
							</button>
						</form>
						<form method="POST" action="?/rejectProduct" use:enhance={enhanceModerationAction}>
							<input type="hidden" name="submissionId" value={submission.id} />
							<label>
								<span>Rejection reason</span>
								<input name="reviewNote" maxlength="1000" required placeholder="What needs correction?" />
							</label>
							<button class="danger-action" type="submit" disabled={pendingTargetUserId !== null}>
								{#if pendingTargetUserId === submission.id}<LoadingSpinner size="small" decorative />{/if}
								<span>Reject</span>
							</button>
						</form>
					</div>
				</article>
			{:else}
				<p class="empty-results">No products are waiting for review.</p>
			{/each}
		</div>
	</section>

	<section class="account-list" aria-label="User accounts">
		{#each data.users as user (user.id)}
			<article class:account-card--blocked={user.status === "banned"} class="account-card">
				<div class="avatar">
					{#if user.avatarUrl}
						<img src={user.avatarUrl} alt="Profile submitted for moderation" />
					{:else}
						<span aria-hidden="true">—</span>
					{/if}
				</div>
				<div class="account-details">
					<div class="account-title">
						<div>
							<strong>{user.displayName}</strong>
							{#if user.id === data.viewerUserId}
								<span class="current-account">Your account</span>
							{/if}
						</div>
						<span class="status">{user.status}</span>
						{#if hasAccountModerationAction(user)}
							<PrivilegedActionBadge />
						{/if}
					</div>
					<p class="account-email">{user.email}</p>
					<p>Image: {user.avatarModerationStatus}</p>
					{#if user.role}<p>Role: {user.role}</p>{/if}
					{#if user.publicReason}<p>{user.publicReason}</p>{/if}
					{#if user.id === data.viewerUserId}
						<p class="account-note">You cannot moderate your own account.</p>
					{:else if user.role === "admin"}
						<p class="account-note">Admin accounts cannot be blocked here.</p>
					{:else if data.viewerRole === "moderator" && user.role}
						<p class="account-note">Only an admin can moderate another moderator.</p>
					{/if}
				</div>

				{#if user.status === "banned"}
					<form method="POST" action="?/unban" use:enhance={enhanceModerationAction} aria-busy={pendingTargetUserId === user.id}>
						<input type="hidden" name="targetUserId" value={user.id} />
						<button class="secondary-action" type="submit" disabled={pendingTargetUserId !== null}>
							{#if pendingTargetUserId === user.id}<LoadingSpinner size="small" decorative />{/if}
							<span>Restore access</span>
						</button>
					</form>
				{:else if user.id !== data.viewerUserId && user.role !== "admin" && !(data.viewerRole === "moderator" && user.role)}
					<form method="POST" action="?/ban" use:enhance={enhanceModerationAction} aria-busy={pendingTargetUserId === user.id}>
						<input type="hidden" name="targetUserId" value={user.id} />
						<label>
							<span>Reason</span>
							<select name="reason" required disabled={pendingTargetUserId !== null}>
								<option value="profile_image_policy_violation">Profile image violation</option>
								<option value="harassment_or_abuse">Harassment or abuse</option>
								<option value="fraud_or_spam">Fraud or spam</option>
								<option value="terms_violation">Other terms violation</option>
							</select>
							<small>This reason and its plain-language explanation will be emailed to the user.</small>
						</label>
						<button class="danger-action" type="submit" disabled={pendingTargetUserId !== null}>
							{#if pendingTargetUserId === user.id}<LoadingSpinner size="small" decorative />{/if}
							<span>Block account</span>
						</button>
					</form>
				{/if}
			</article>
		{:else}
			<div class="empty-results">
				<strong>No accounts found</strong>
				<p>Try a different preferred name, email address, user ID, role, or status.</p>
			</div>
		{/each}
	</section>
</div>

<style lang="scss">
	@use "./page.scss";
</style>
