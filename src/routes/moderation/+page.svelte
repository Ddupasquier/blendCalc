<script lang="ts">
	import { enhance } from "$app/forms";
	import type { ActionData, PageData } from "./$types";

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Moderation · Smoothie Mixer</title>
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
		<form method="GET" role="search">
			<label for="moderation-search">Account search</label>
			<div class="search-controls">
				<input
					id="moderation-search"
					type="search"
					name="q"
					value={data.query}
					placeholder="Name, email, user ID..."
					autocomplete="off"
				/>
				<button class="search-action" type="submit">Search</button>
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
					<form method="POST" action="?/unban" use:enhance>
						<input type="hidden" name="targetUserId" value={user.id} />
						<button class="secondary-action" type="submit">Restore access</button>
					</form>
				{:else if user.id !== data.viewerUserId && user.role !== "admin" && !(data.viewerRole === "moderator" && user.role)}
					<form method="POST" action="?/ban" use:enhance>
						<input type="hidden" name="targetUserId" value={user.id} />
						<label>
							<span>Reason</span>
							<select name="reason" required>
								<option value="profile_image_policy_violation">Profile image violation</option>
								<option value="harassment_or_abuse">Harassment or abuse</option>
								<option value="fraud_or_spam">Fraud or spam</option>
								<option value="terms_violation">Other terms violation</option>
							</select>
							<small>This reason and its plain-language explanation will be emailed to the user.</small>
						</label>
						<button class="danger-action" type="submit">Block account</button>
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
	.empty-results {
		padding: $app-gap-md;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;
	}

	.account-search h2 {
		font-size: $app-font-size-lg;
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
		display: inline-grid;
		place-items: center;
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
	}
</style>
