<script lang="ts">
	import Crown from "$lib/assets/icons/Crown/Crown.svelte";
	import ProfileSettingsSheetLauncher from "$lib/components/profile/ProfileSettingsSheetLauncher/ProfileSettingsSheetLauncher.svelte";
	import {
		getAvailableProfilePrivilegedToolCount,
		getProfilePrivilegedToolTitle,
	} from "$lib/utils/moderation/profilePrivilegedTools";
	import type { ProfilePrivilegedToolsLauncherProps } from "./types";

	let { access, onOpen }: ProfilePrivilegedToolsLauncherProps = $props();
	const title = $derived(getProfilePrivilegedToolTitle(access.role));
	const availableToolCount = $derived(
		getAvailableProfilePrivilegedToolCount(access.permissions),
	);
	const summary = $derived(access.reviewSummary);

	const description = $derived(
		summary.identityVerificationRequired
			? `Verify your identity to use ${availableToolCount} protected tools`
			: summary.unavailable
			? `${availableToolCount} tools available · review counts unavailable`
			: summary.totalPendingReviews === 0
				? `${availableToolCount} tools available · no reviews waiting`
				: summary.totalPendingReviews === 1
					? `${availableToolCount} tools available · 1 review waiting`
					: `${availableToolCount} tools available · ${summary.totalPendingReviews} reviews waiting`,
	);
</script>

<ProfileSettingsSheetLauncher
	{title}
	{description}
	controls="profile-privileged-tools-sheet"
	variant="privileged"
	actionRequiredCount={summary.totalPendingReviews ?? 0}
	actionRequiredLabel="reviews requiring attention"
	{onOpen}
>
	{#snippet icon()}<Crown />{/snippet}
</ProfileSettingsSheetLauncher>
