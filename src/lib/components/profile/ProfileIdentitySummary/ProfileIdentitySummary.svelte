<script lang="ts">
	import User from "$lib/assets/icons/User/User.svelte";
	import CircularMediaFrame from "$lib/components/common/images/CircularMediaFrame/CircularMediaFrame.svelte";
	import type { ProfileIdentitySummaryProps } from "./types";

	let {
		avatarUrl,
		avatarAltText,
		displayName,
		bio,
	}: ProfileIdentitySummaryProps = $props();
</script>

<section class="profile-identity-summary" aria-label="Current profile">
	<CircularMediaFrame
		class="profile-identity-summary__avatar"
		label="Current profile image"
	>
		{#if avatarUrl}
			<img src={avatarUrl} alt={avatarAltText ?? "Your profile"} />
		{:else}
			<User class="profile-identity-summary__avatar-icon" />
		{/if}
	</CircularMediaFrame>
	<div class="profile-identity-summary__copy">
		<strong>{displayName}</strong>
		{#if bio}
			<p>{bio}</p>
		{:else}
			<span>No bio added</span>
		{/if}
	</div>
</section>

<style lang="scss">
	@use "./ProfileIdentitySummary.scss";
</style>
