<script lang="ts">
	import Crown from "$lib/assets/icons/Crown/Crown.svelte";
	import ProfileSettingsSheetLauncher from "$lib/components/profile/ProfileSettingsSheetLauncher/ProfileSettingsSheetLauncher.svelte";
	import type { ProfileModeratorActionLauncherProps } from "./types";

	let { summary, onOpen }: ProfileModeratorActionLauncherProps = $props();

	const description = $derived(
		summary.identityVerificationRequired
			? "Verify your identity to view protected reviews"
			: summary.unavailable
			? "Review tools available"
			: summary.totalPendingReviews === 0
				? "No reviews are waiting"
				: summary.totalPendingReviews === 1
					? "1 review is waiting"
					: `${summary.totalPendingReviews} reviews are waiting`,
	);
</script>

<ProfileSettingsSheetLauncher
	title="Moderator actions"
	{description}
	controls="profile-moderator-actions-sheet"
	variant="privileged"
	actionRequiredCount={summary.totalPendingReviews ?? 0}
	actionRequiredLabel="moderator actions requiring review"
	{onOpen}
>
	{#snippet icon()}<Crown />{/snippet}
</ProfileSettingsSheetLauncher>
