<script lang="ts">
	import { enhance } from "$app/forms";
	import type { SubmitFunction } from "@sveltejs/kit";
	import PrivilegedActionBadge from "$lib/components/common/badges/PrivilegedActionBadge/PrivilegedActionBadge.svelte";
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import InputLoadingFrame from "$lib/components/common/forms/InputLoadingFrame/InputLoadingFrame.svelte";
	import ImagePlacementEditor from "$lib/components/common/images/ImagePlacementEditor.svelte";
	import type { ImagePlacementValue } from "$lib/utils/food/images/types";
	import { APP_NAME } from "$lib/config/brand";
	import type { ActionData, PageData } from "./$types";

	let { data, form }: { data: PageData; form: ActionData } = $props();
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
	<title>Moderation · {APP_NAME}</title>
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
		<p class="message message--error" role="alert">{form.moderationError}</p>
	{:else if form?.moderationWarning}
		<p class="message message--warning" role="status">{form.moderationWarning}</p>
	{:else if form?.moderationSuccess}
		<p class="message message--success" role="status">{form.moderationSuccess}</p>
	{/if}

	<section class="product-review" aria-labelledby="product-review-title">
		<div>
			<p class="eyebrow">Shared catalog</p>
			<h2 id="product-review-title">Product submissions</h2>
			<p>Compare the entered values with the package photos before publishing them.</p>
		</div>

		{#if form?.productReviewError}
			<p class="message message--error" role="alert">{form.productReviewError}</p>
		{:else if form?.productReviewSuccess}
			<p class="message message--success" role="status">{form.productReviewSuccess}</p>
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
							An outside source could not be checked. Review the label carefully.
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
							title="Public image preview"
							description="Adjust what appears in ingredient cards before approving."
							value={getImageCrop(submission)}
							privileged
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
							<button
								type="submit"
								disabled={pendingTargetUserId !== null || !submission.evidenceComplete || submission.isQaFixture}
							>
								<PrivilegedActionBadge />
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
								<PrivilegedActionBadge />
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
							<PrivilegedActionBadge />
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
							<PrivilegedActionBadge />
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
	@use "../../styles/variables" as *;

	.moderation-page,
	.account-list,
	header,
	.account-search,
	.product-review,
	.product-review__list,
	.account-details,
	form,
	label {
		display: grid;
		gap: $app-gap-sm;
		min-width: 0;
	}

	.moderation-page {
		width: 100%;
		max-width: 100%;
	}

	header h1 {
		font-family: $app-font-family-display;
		font-size: clamp(1.8rem, 7vw, 2.4rem);
	}

	header > p:last-child,
	.account-details p,
	.account-search p,
	.empty-results p {
		color: $app-muted;
	}

	.eyebrow {
		font-size: $app-font-size-xs;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.account-search,
	.product-review,
	.empty-results {
		padding: $app-gap-md;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;
	}

	.product-review h2,
	.account-search h2 {
		font-size: $app-font-size-lg;
	}

	.product-review {
		padding: $app-gap-md;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;
	}

	.product-card {
		display: grid;
		gap: $app-gap-sm;
		min-width: 0;
		padding: $app-gap-md;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-radius;

		header,
		dl > div,
		li {
			display: flex;
			justify-content: space-between;
			gap: $app-gap-sm;
		}

		header > div {
			display: grid;
			min-width: 0;
		}

		dl {
			display: grid;
			gap: $app-gap-xs;
			margin: 0;
		}

		dt {
			font-weight: 800;
		}

		dd {
			min-width: 0;
			margin: 0;
			overflow-wrap: anywhere;
		}

		ul {
			display: grid;
			gap: $app-gap-xs;
			max-height: 16rem;
			margin: $app-gap-sm 0 0;
			padding: 0;
			overflow: auto;
			list-style: none;
		}
	}

	.product-card__actions {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: $app-gap-sm;
		align-items: end;

		form:last-child {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			gap: $app-gap-xs;
			align-items: end;
		}
	}

	.product-card__actions button,
	.account-card form button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: $app-gap-xs;
	}

	.product-card__statuses {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: $app-gap-xs;

		.status {
			padding: 0.2rem 0.45rem;
			background: $app-accent;
			border-radius: $app-radius-pill;
			font-size: $app-font-size-xs;
			font-weight: 800;
			text-transform: capitalize;
		}

		.status--qa {
			color: $app-warning-strong;
			background: $app-warning-bg;
		}
	}

	.product-card__evidence {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: $app-gap-sm;

		a {
			display: grid;
			gap: $app-gap-xs;
			min-width: 0;
			color: $app-primary;
			font-size: $app-font-size-sm;
			font-weight: 800;
			text-decoration: none;
		}

		img {
			width: 100%;
			aspect-ratio: 4 / 3;
			object-fit: cover;
			background: $app-section-bg;
			border: $app-border;
			border-radius: $app-radius;
		}
	}

	.product-card__notice {
		padding: $app-gap-sm;
		color: $app-warning-strong;
		background: $app-warning-bg;
		border: $app-warning-border;
		border-radius: $app-radius;
		font-size: $app-font-size-sm;
		font-weight: 700;
	}

	.product-card__notice ul {
		display: grid;
		gap: $app-gap-xs;
		margin: $app-gap-xs 0 0;
		padding-left: $app-gap-md;
	}

	.product-card__notice--danger {
		color: $app-warning-strong;
	}

	.product-card__update {
		display: grid;
		gap: $app-gap-sm;
		padding: $app-gap-sm;
		background: $app-accent;
		border: $app-border;
		border-radius: $app-radius;

		p {
			margin: $app-gap-xs 0 0;
			font-size: $app-font-size-sm;
		}

		ul {
			display: grid;
			gap: $app-gap-xs;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		li {
			display: flex;
			flex-wrap: wrap;
			justify-content: space-between;
			gap: $app-gap-xs;
		}

		li span {
			color: $app-muted;
			font-size: $app-font-size-sm;
		}
	}

	.account-search label {
		font-weight: 800;
	}

	.search-controls {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		gap: $app-gap-xs;
		min-width: 0;
	}

	.search-controls input {
		min-width: 0;
		width: 100%;
		padding: 0.7rem;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-radius-sm;
	}

	.search-action,
	.clear-search {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: $app-gap-xs;
		min-width: 0;
		padding-inline: $app-gap-sm;
		border-radius: $app-radius-sm;
		font-family: $app-button-font-family;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
		text-decoration: none;
	}

	.search-action {
		color: $app-btn-text;
		background: $app-primary;
	}

	.clear-search {
		color: $app-primary;
		background: $app-accent;
	}

	.result-count {
		font-size: $app-font-size-sm;
		font-weight: 700;
	}

	.account-card {
		display: grid;
		grid-template-columns: 4.5rem minmax(0, 1fr);
		gap: $app-gap-sm;
		min-width: 0;
		width: 100%;
		max-width: 100%;
		padding: $app-gap-md;
		overflow: hidden;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;

		form {
			grid-column: 1 / -1;
			min-width: 0;
		}
	}

	.account-card--blocked {
		border-color: $app-danger-action;
	}

	.avatar {
		display: grid;
		place-items: center;
		width: 4.5rem;
		height: 4.5rem;
		overflow: hidden;
		background: $app-accent;
		border-radius: $app-radius-sm;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.account-title {
		display: flex;
		flex-wrap: wrap;
		align-items: start;
		justify-content: space-between;
		gap: $app-gap-xs;

		> .status {
			padding: 0.2rem 0.45rem;
			background: $app-accent;
			border-radius: $app-radius-pill;
			font-size: $app-font-size-xs;
			font-weight: 800;
			text-transform: capitalize;
		}

		> div {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			min-width: 0;
			gap: $app-gap-xs;
		}
	}

	.account-title strong,
	.account-email,
	.account-note {
		overflow-wrap: anywhere;
	}

	.current-account {
		padding: 0.15rem 0.4rem;
		color: $app-highlight-text;
		background: $app-highlight;
		border-radius: $app-radius-pill;
		font-size: $app-font-size-xs;
		font-weight: 900;
	}

	.account-note {
		font-weight: 700;
		font-style: italic;
	}

	select {
		min-width: 0;
		width: 100%;
		max-width: 100%;
		padding: 0.6rem;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-radius-sm;
	}

	.danger-action {
		width: 100%;
		color: $app-btn-text;
		background: $app-danger-action;
	}

	.secondary-action {
		width: 100%;
		color: $app-primary;
		background: $app-accent;
	}

	.message {
		padding: $app-gap-sm;
		border-radius: $app-radius-sm;
		font-weight: 700;
	}

	.message--error {
		background: $app-danger-bg;
	}

	.message--success {
		background: $app-success-bg;
	}

	.message--warning {
		background: $app-warning-bg;
	}

	@media (max-width: $app-breakpoint-xs) {
		.product-card__evidence {
			grid-template-columns: 1fr;
		}

		.search-controls {
			grid-template-columns: minmax(0, 1fr) auto;

			.clear-search {
				grid-column: 1 / -1;
			}
		}

		.account-card {
			grid-template-columns: 3.5rem minmax(0, 1fr);
			padding: $app-gap-sm;
		}

		.avatar {
			width: 3.5rem;
			height: 3.5rem;
		}

		.product-card__actions,
		.product-card__actions form:last-child {
			grid-template-columns: 1fr;
		}
	}
</style>
