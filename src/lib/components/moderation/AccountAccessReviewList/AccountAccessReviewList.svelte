<script lang="ts">
	import { enhance } from "$app/forms";
	import { goto } from "$app/navigation";
	import type { SubmitFunction } from "@sveltejs/kit";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import { canModerateTargetRole } from "$lib/utils/moderation/moderation";
	import type { AccountAccessReviewListProps } from "./types";

	let {
		users,
		query,
		totalCount,
		viewerUserId,
		viewerRole,
		searchPath,
		showHeading = false,
	}: AccountAccessReviewListProps = $props();
	let pendingAccountUserId = $state<string | null>(null);
	let searching = $state(false);

	const blockReasonOptions = [
		{
			value: "profile_image_policy_violation",
			label: "Profile image violation",
		},
		{ value: "harassment_or_abuse", label: "Harassment or abuse" },
		{ value: "fraud_or_spam", label: "Fraud or spam" },
		{ value: "terms_violation", label: "Other terms violation" },
	];

	const formatReadableLabel = (value: string) =>
		value
			.replaceAll("_", " ")
			.replace(/^./u, (letter) => letter.toLocaleUpperCase());
	const formatAccountStatus = (value: string) =>
		value === "banned" ? "Blocked" : formatReadableLabel(value);
	const formatProfileImageStatus = (value: string) => {
		if (value === "self_attested") return "Published";
		if (value === "approved") return "Approved";
		if (value === "rejected") return "Removed";
		return "Not added";
	};
	const formatCatalogSharingSuspensionDate = (value: string) =>
		new Intl.DateTimeFormat("en", {
			month: "short",
			day: "numeric",
			year: "numeric",
			timeZone: "UTC",
		}).format(new Date(value));
	const formatAccountResultCount = () => {
		const accountLabel = totalCount === 1 ? "account" : "accounts";
		return query
			? `${users.length} of ${totalCount} ${accountLabel} shown`
			: `${totalCount} ${accountLabel}`;
	};

	const submitAccountSearch = async (event: SubmitEvent) => {
		event.preventDefault();
		if (searching) return;

		searching = true;
		const form = event.currentTarget as HTMLFormElement;
		const searchQuery = String(new FormData(form).get("q") ?? "").trim();
		const href = searchQuery
			? `${searchPath}?q=${encodeURIComponent(searchQuery)}`
			: searchPath;

		try {
			await goto(href, { keepFocus: true, noScroll: true });
		} finally {
			searching = false;
		}
	};

	const clearAccountSearch = () => {
		if (!searching) void goto(searchPath, { keepFocus: true, noScroll: true });
	};

	const enhanceAccountAction: SubmitFunction = ({ formData, cancel }) => {
		if (pendingAccountUserId) {
			cancel();
			return;
		}

		pendingAccountUserId = String(formData.get("targetUserId") ?? "");
		return async ({ update }) => {
			try {
				await update({ reset: false });
			} finally {
				pendingAccountUserId = null;
			}
		};
	};
</script>

<section
	class="account-access"
	aria-labelledby={showHeading ? "account-access-title" : undefined}
	aria-label={showHeading ? undefined : "Account access"}
>
	{#if showHeading}
		<header class="account-access__heading">
			<h2 id="account-access-title">Account access</h2>
			<p>
				Find an account, then open only the details or access controls you need.
			</p>
		</header>
	{/if}

	<form
		class="account-access__search"
		method="GET"
		role="search"
		onsubmit={submitAccountSearch}
	>
		<TextField
			id="moderation-account-search"
			name="q"
			label="Search accounts"
			labelVisibility="sr-only"
			type="search"
			value={query}
			placeholder="Name, email, user ID, role..."
			autocomplete="off"
			disabled={searching}
		/>
		<div class="account-access__search-actions">
			<ActionButton type="submit" size="small" busy={searching}
				>Search</ActionButton
			>
			{#if query}
				<ActionButton
					type="button"
					variant="ghost"
					size="small"
					disabled={searching}
					onclick={clearAccountSearch}>Clear</ActionButton
				>
			{/if}
		</div>
		<p class="account-access__result-count" aria-live="polite">
			{formatAccountResultCount()}
		</p>
	</form>

	<div class="account-access__list">
		{#each users as user (user.id)}
			<article class="account-access__account">
				<CollapsibleSection
					title={user.displayName}
					badge={formatAccountStatus(user.status)}
					surface="panel"
					tone={user.status === "banned" ? "danger" : "neutral"}
				>
					<div class="account-access__details">
						{#if user.avatarUrl}
							<img
								class="account-access__avatar"
								src={user.avatarUrl}
								alt={`${user.displayName}'s profile`}
							/>
						{/if}
						<dl class="account-access__facts">
							<div>
								<dt>Email</dt>
								<dd>{user.email}</dd>
							</div>
							<div>
								<dt>Role</dt>
								<dd>{user.role ? formatReadableLabel(user.role) : "Member"}</dd>
							</div>
							<div>
								<dt>Profile image</dt>
								<dd>{formatProfileImageStatus(user.avatarModerationStatus)}</dd>
							</div>
							<div>
								<dt>Rejected public submissions</dt>
								<dd>{user.moderatorRejectedSubmissionCount}</dd>
							</div>
						</dl>

						{#if user.catalogSharingSuspendedUntil}
							<p class="account-access__suspension">
								Public product sharing is paused until
								{formatCatalogSharingSuspensionDate(
									user.catalogSharingSuspendedUntil,
								)}.
							</p>
						{/if}
						{#if user.publicReason}
							<p class="account-access__public-reason">
								Reason shown to the user: {user.publicReason}
							</p>
						{/if}

						{#if user.id === viewerUserId}
							<p class="account-access__restriction">
								This is your account, so its access cannot be changed here.
							</p>
						{:else if user.role === "admin" || user.role === "developer"}
							<p class="account-access__restriction">
								{user.role === "admin" ? "Admin" : "Developer"} accounts cannot be
								blocked here.
							</p>
						{:else if !canModerateTargetRole(viewerRole, user.role)}
							<p class="account-access__restriction">
								Only an admin or developer can change access for another
								privileged account.
							</p>
						{/if}

						{#if user.id !== viewerUserId && canModerateTargetRole(viewerRole, user.role)}
							{#if user.status === "banned"}
								<form
									method="POST"
									action="?/unban"
									use:enhance={enhanceAccountAction}
									aria-busy={pendingAccountUserId === user.id}
								>
									<input type="hidden" name="targetUserId" value={user.id} />
									<ActionButton
										type="submit"
										variant="secondary"
										fullWidth
										busy={pendingAccountUserId === user.id}
										disabled={pendingAccountUserId !== null}
										>Restore access</ActionButton
									>
								</form>
							{:else}
								<CollapsibleSection title="Access controls" surface="panel">
									<form
										class="account-access__block-form"
										method="POST"
										action="?/ban"
										use:enhance={enhanceAccountAction}
										aria-busy={pendingAccountUserId === user.id}
									>
										<input type="hidden" name="targetUserId" value={user.id} />
										<SelectField
											id={`account-ban-reason-${user.id}`}
											name="reason"
											label="Reason"
											value="profile_image_policy_violation"
											options={blockReasonOptions}
											helper="This explanation is emailed to the user."
											required
											disabled={pendingAccountUserId !== null}
										/>
										<ActionButton
											type="submit"
											variant="danger"
											fullWidth
											busy={pendingAccountUserId === user.id}
											disabled={pendingAccountUserId !== null}
											>Block account</ActionButton
										>
									</form>
								</CollapsibleSection>
							{/if}
						{/if}
					</div>
				</CollapsibleSection>
			</article>
		{:else}
			<div class="account-access__empty">
				<strong>No accounts found</strong>
				<p>Try a different name, email address, user ID, role, or status.</p>
			</div>
		{/each}
	</div>
</section>

<style lang="scss">
	@use "./AccountAccessReviewList.scss";
</style>
