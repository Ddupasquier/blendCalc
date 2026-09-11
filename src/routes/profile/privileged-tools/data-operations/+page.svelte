<script lang="ts">
	import { goto } from "$app/navigation";
	import CatalogDataOperationsDashboard from "$lib/components/moderation/CatalogDataOperationsDashboard/CatalogDataOperationsDashboard.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import PrivilegedToolWorkspaceView from "$lib/components/moderation/PrivilegedToolWorkspaceView/PrivilegedToolWorkspaceView.svelte";
	import ProfilePage from "../../+page.svelte";
	import type { CatalogDataOperationsPageProps } from "./types";

	let { data }: CatalogDataOperationsPageProps = $props();
	const firstActionSubject = $derived(data.actionSubjects?.[0] ?? null);
	const closeAction = () => {
		void goto("/profile/privileged-tools", { replaceState: true });
	};
</script>

<ProfilePage />
<PrivilegedToolWorkspaceView
	id="profile-data-operations-view"
	title="Data operations"
	subtitle="Inspect publication readiness, mappings, revisions, sources, datasets, and policy coverage."
	informationKey="data-operations"
	guide={{
		tone:
			data.actionCount === null
				? "unavailable"
				: data.actionCount > 0
					? "attention"
					: "clear",
		title:
			data.actionCount === null
				? "Confirm the queue status before changing data"
				: data.actionCount > 0
					? `Resolve ${data.actionCount} tracked ${data.actionCount === 1 ? "issue" : "issues"}`
					: "Catalog operations are clear",
		description:
			data.actionCount === null
				? "The exact deduplicated action count could not be read. The diagnostic sections remain available, but do not assume that a missing count means no work."
				: data.actionCount > 0
					? firstActionSubject
						? `Start with ${firstActionSubject.displayName} in Required work. Its card names every finding, the exact next action, and whether that action is available here. Diagnostic totals below can overlap and do not increase this red count.`
						: "The named Required work list could not be loaded. Use the broader diagnostic checks to investigate, but do not assume the red count is fully explained."
					: "No deduplicated catalog subject currently requires an operator repair. Monitoring and reference details remain available below.",
		completion:
			"Every tracked issue is resolved from reviewed evidence and the red action total returns to zero.",
		count: data.actionCount,
		countLabel: "deduplicated data-operation subjects requiring attention",
	}}
	onClose={closeAction}
>
	{#if data.datasetEvidenceRecorded}
		<StatusMessage
			tone="success"
			title="Dataset evidence recorded"
			message="The import evidence passed its health recheck. The completed dataset finding has been removed from Required work."
		/>
	{/if}
	<CatalogDataOperationsDashboard
		dashboard={data.dashboard}
		catalogMonitor={data.catalogMonitor}
		actionCount={data.actionCount}
		actionSubjects={data.actionSubjects}
		actionSubjectsTruncated={data.actionSubjectsTruncated}
	/>
</PrivilegedToolWorkspaceView>
