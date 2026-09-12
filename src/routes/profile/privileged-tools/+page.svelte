<script lang="ts">
	import { goto } from "$app/navigation";
	import BackButton from "$lib/components/common/buttons/BackButton/BackButton.svelte";
	import PrivilegedActionBadge from "$lib/components/common/badges/PrivilegedActionBadge/PrivilegedActionBadge.svelte";
	import ViewBody from "$lib/components/common/view/ViewBody/ViewBody.svelte";
	import ViewFrame from "$lib/components/common/view/ViewFrame/ViewFrame.svelte";
	import ViewHeader from "$lib/components/common/view/ViewHeader/ViewHeader.svelte";
	import ViewTop from "$lib/components/common/view/ViewTop/ViewTop.svelte";
	import ProfilePrivilegedToolsDashboard from "$lib/components/profile/ProfilePrivilegedToolsDashboard/ProfilePrivilegedToolsDashboard.svelte";
	import { APP_NAME } from "$lib/config/brand";
	import { formatDocumentTitle } from "$lib/config/pageMetadata";
	import { getProfilePrivilegedToolTitle } from "$lib/utils/moderation/profilePrivilegedTools";
	import type { ProfilePrivilegedToolsPageProps } from "./types";

	let { data }: ProfilePrivilegedToolsPageProps = $props();
	const title = $derived(getProfilePrivilegedToolTitle(data.access.role));
</script>

<svelte:head>
	<title>{formatDocumentTitle(title)}</title>
	<meta
		name="description"
		content={`Review privileged work and inspect ${APP_NAME} system health.`}
	/>
</svelte:head>

<ViewFrame appShell fullWidth className="profile-privileged-tools-page">
	<ViewTop>
		<div class="profile-privileged-tools-page__heading">
			<BackButton
				label="Back to profile"
				onclick={() => void goto("/profile")}
			/>
			<ViewHeader
				{title}
				subtitle="Review work that needs you, open operational tools, and inspect current system health."
			>
				<PrivilegedActionBadge label={title} />
			</ViewHeader>
		</div>
	</ViewTop>
	<ViewBody scroll>
		<div class="profile-privileged-tools-page__body">
			<ProfilePrivilegedToolsDashboard
				access={data.access}
				diagnostics={data.diagnostics}
				diagnosticsUnavailable={data.diagnosticsUnavailable}
			/>
		</div>
	</ViewBody>
</ViewFrame>

<style lang="scss">
	@use "./page.scss";
</style>
