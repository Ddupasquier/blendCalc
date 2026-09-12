<script lang="ts">
	import Crown from "$lib/assets/icons/Crown/Crown.svelte";
	import ProfileSettingsSheetLauncher from "$lib/components/profile/ProfileSettingsSheetLauncher/ProfileSettingsSheetLauncher.svelte";
	import {
		getAvailableProfilePrivilegedToolCount,
		getProfilePrivilegedToolTitle,
	} from "$lib/utils/moderation/profilePrivilegedTools";
	import type { ProfilePrivilegedToolsLauncherProps } from "./types";

	let { access }: ProfilePrivilegedToolsLauncherProps = $props();
	const title = $derived(getProfilePrivilegedToolTitle(access.role));
	const availableToolCount = $derived(
		getAvailableProfilePrivilegedToolCount(access.permissions),
	);
	const summary = $derived(access.reviewSummary);

	const description = $derived(
		summary.identityVerificationRequired
			? `Verify your identity to use ${availableToolCount} protected tools`
			: summary.unavailable
				? `${availableToolCount} tools available · action counts unavailable`
				: summary.totalActionableItems === 0
					? `${availableToolCount} tools available · no actions waiting`
					: summary.totalActionableItems === 1
						? `${availableToolCount} tools available · 1 action waiting`
						: `${availableToolCount} tools available · ${summary.totalActionableItems} actions waiting`,
	);
</script>

<ProfileSettingsSheetLauncher
	{title}
	{description}
	href="/profile/privileged-tools"
	variant="privileged"
	actionRequiredCount={summary.totalActionableItems ?? 0}
	actionRequiredLabel="privileged actions requiring attention"
>
	{#snippet icon()}<Crown />{/snippet}
</ProfileSettingsSheetLauncher>
