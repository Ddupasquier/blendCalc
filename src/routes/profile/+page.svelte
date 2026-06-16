<script lang="ts">
	import { enhance } from "$app/forms";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import type { ActionData, PageData } from "./$types";

	let {
		data,
		form,
	}: {
		data: PageData;
		form: ActionData;
	} = $props();

	const profileValues = $derived({
		displayName: form?.profileValues?.displayName ?? data.profile?.display_name ?? "",
		bio: form?.profileValues?.bio ?? data.profile?.bio ?? "",
	});
	let profilePending = $state(false);
	let avatarPending = $state(false);
	const enhanceProfile = createPendingSubmit(
		(pending) => (profilePending = pending),
	);
	const enhanceAvatar = createPendingSubmit(
		(pending) => (avatarPending = pending),
	);
</script>

<svelte:head>
	<title>Profile · Smoothie Mixer</title>
	<meta name="description" content="Manage your optional Smoothie Mixer profile details." />
</svelte:head>

<div class="profile-page">
	<header class="profile-heading">
		<p class="profile-heading__eyebrow">Account</p>
		<h1>Your profile</h1>
		<p>Your profile is optional. Your login works without completing it.</p>
	</header>

	<section class="profile-card profile-card--identity">
		<div class="avatar-preview" aria-label="Current profile image">
			{#if data.avatarUrl}
				<img src={data.avatarUrl} alt={data.profile?.avatar_alt_text ?? "Your profile"} />
			{:else}
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />
				</svg>
			{/if}
		</div>
		<div>
			<strong>{data.profile?.display_name ?? data.defaultDisplayName}</strong>
			<span>Preferred name</span>
		</div>
	</section>

	<section class="profile-card">
		<div class="profile-card__heading">
			<h2>Profile details</h2>
			<p>Add only what you want other profile features to use later.</p>
		</div>

		{#if form?.profileError}
			<p class="form-message form-message--error" role="alert">{form.profileError}</p>
		{:else if form?.profileSuccess}
			<p class="form-message form-message--success" role="status">{form.profileSuccess}</p>
		{/if}

		<form method="POST" action="?/saveProfile" use:enhance={enhanceProfile} aria-busy={profilePending}>
			<label for="profile-display-name">Preferred name</label>
			<input
				id="profile-display-name"
				name="displayName"
				value={profileValues.displayName}
				maxlength="80"
				autocomplete="name"
				placeholder="What should we call you?"
				required
				disabled={profilePending}
			/>
			<small>This can be your first name, nickname, or any name you prefer. Your email is not shown.</small>

			<label for="profile-bio">Bio</label>
			<textarea
				id="profile-bio"
				name="bio"
				maxlength="300"
				rows="4"
				placeholder="A short note about you"
				disabled={profilePending}
			>{profileValues.bio}</textarea>

			<button class="primary-action" type="submit" disabled={profilePending}>
				{profilePending ? "Saving profile…" : "Save profile"}
			</button>
		</form>
	</section>

	<section class="profile-card">
		<div class="profile-card__heading">
			<h2>Profile image</h2>
			<p>JPEG, PNG, or WebP. Maximum 5 MB. Images remain private to your account.</p>
		</div>

		{#if form?.avatarError}
			<p class="form-message form-message--error" role="alert">{form.avatarError}</p>
		{:else if form?.avatarSuccess}
			<p class="form-message form-message--success" role="status">{form.avatarSuccess}</p>
		{/if}

		<form method="POST" action="?/uploadAvatar" enctype="multipart/form-data" use:enhance={enhanceAvatar} aria-busy={avatarPending}>
			<label for="profile-avatar">Choose image</label>
			<input
				id="profile-avatar"
				name="avatar"
				type="file"
				accept="image/jpeg,image/png,image/webp"
				required
				disabled={avatarPending}
			/>

			<label for="profile-avatar-alt">Image description</label>
			<input
				id="profile-avatar-alt"
				name="avatarAltText"
				maxlength="160"
				value={data.profile?.avatar_alt_text ?? ""}
				placeholder="Example: Dylan smiling"
				disabled={avatarPending}
			/>

			<fieldset class="avatar-policy">
				<legend>Profile image rules</legend>
				<details class="avatar-policy__details">
					<summary>
						<span>Review image rules</span>
						<span class="avatar-policy__chevron" aria-hidden="true">⌄</span>
					</summary>
					<ul>
						{#each data.avatarPolicyItems as item}
							<li>{item}</li>
						{/each}
					</ul>
				</details>
				<label class="check-row">
					<input type="checkbox" name="avatarPolicyAccepted" required disabled={avatarPending} />
					<span>I confirm this image follows the profile image rules. My agreement and upload details will be recorded.</span>
				</label>
				{#if data.requireHumanFace}
					<label class="check-row">
						<input type="checkbox" name="avatarHasHumanFace" required disabled={avatarPending} />
						<span>I confirm this image contains a recognizable human face.</span>
					</label>
				{/if}
			</fieldset>

			<div class="form-actions">
				<button class="primary-action" type="submit" disabled={avatarPending}>
					{avatarPending ? "Saving image…" : "Upload image"}
				</button>
				{#if data.profile?.avatar_path}
					<button class="secondary-action" type="submit" formaction="?/removeAvatar" formnovalidate disabled={avatarPending}>
						{avatarPending ? "Working…" : "Remove image"}
					</button>
				{/if}
			</div>
		</form>
	</section>
</div>

<style lang="scss">
	@use "../../styles/variables" as *;

	.profile-page {
		display: grid;
		gap: $app-gap-md;
	}

	.profile-heading {
		display: grid;
		gap: $app-gap-xs;

		h1 {
			font-family: $app-font-family-display;
			font-size: clamp(1.65rem, 6vw, 2.2rem);
			letter-spacing: -0.035em;
		}

		p:last-child {
			color: $app-muted;
			font-size: $app-font-size-md;
		}
	}

	.profile-heading__eyebrow {
		color: $app-muted;
		font-size: $app-font-size-xs;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.profile-card {
		display: grid;
		gap: $app-gap-md;
		padding: $app-gap-md;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;

		form {
			display: grid;
			gap: $app-gap-sm;
		}

		label,
		legend {
			color: $app-primary;
			font-size: $app-font-size-md;
			font-weight: 800;
		}

		input:not([type="checkbox"]),
		textarea {
			width: 100%;
			padding: 0.65rem 0.75rem;
			color: $app-primary;
			background: $app-bg;
			border: $app-border;
			border-radius: $app-radius-sm;
			font: inherit;
		}

		input[type="file"] {
			font-size: $app-font-size-sm;
		}

		small {
			color: $app-muted;
			font-size: $app-font-size-sm;
		}
	}

	.profile-card--identity {
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;

		div:last-child {
			display: grid;
			min-width: 0;
		}

		strong,
		span {
			overflow-wrap: anywhere;
		}

		span {
			color: $app-muted;
			font-size: $app-font-size-sm;
		}
	}

	.avatar-preview {
		display: grid;
		place-items: center;
		width: 4.5rem;
		height: 4.5rem;
		overflow: hidden;
		color: $app-primary;
		background: $app-accent;
		border: $app-border;
		border-radius: 50%;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}

		svg {
			width: 55%;
			fill: none;
			stroke: currentColor;
			stroke-linecap: round;
			stroke-linejoin: round;
			stroke-width: 1.8;
		}
	}

	.profile-card__heading {
		display: grid;
		gap: $app-gap-xs;

		h2 {
			font-size: $app-font-size-xl;
		}

		p {
			color: $app-muted;
			font-size: $app-font-size-sm;
		}
	}

	.avatar-policy {
		display: grid;
		gap: $app-gap-sm;
		margin-top: $app-gap-xs;
		padding: $app-gap-sm;
		border: $app-border;
		border-radius: $app-radius-sm;
	}

	.avatar-policy__details {
		min-width: 0;
		padding: $app-gap-sm;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-radius-sm;

		summary {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: $app-gap-sm;
			color: $app-primary;
			font-size: $app-font-size-sm;
			font-weight: 800;
			cursor: pointer;
			list-style: none;

			&::-webkit-details-marker {
				display: none;
			}
		}

		ul {
			display: grid;
			gap: 0.15rem;
			margin-top: $app-gap-sm;
			padding-left: 1.15rem;
			color: $app-muted;
			font-size: $app-font-size-sm;
		}

		&[open] .avatar-policy__chevron {
			transform: rotate(180deg);
		}
	}

	.avatar-policy__chevron {
		font-size: $app-font-size-lg;
		line-height: 1;
		transition: transform 160ms ease;
	}

	.check-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: $app-gap-sm;
		align-items: start;

		input {
			margin-top: 0.2rem;
		}
	}

	.form-actions {
		display: flex;
		flex-wrap: wrap;
		gap: $app-gap-sm;
	}

	.primary-action,
	.secondary-action {
		width: fit-content;
		font-family: $app-button-font-family;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
	}

	.primary-action {
		color: $app-btn-text;
		background: $app-btn-bg;

		&:hover {
			background: $app-btn-bg-hover;
		}
	}

	.secondary-action {
		color: $app-primary;
		background: $app-accent;
	}

	.form-message {
		padding: $app-gap-sm;
		border-radius: $app-radius-sm;
		font-size: $app-font-size-sm;
		font-weight: 800;
	}

	.form-message--error {
		background: $app-danger-bg;
	}

	.form-message--success {
		background: $app-success-bg;
	}

	@media (max-width: $app-breakpoint-xs) {
		.form-actions button {
			flex: 1 1 100%;
			width: 100%;
		}
	}
</style>
