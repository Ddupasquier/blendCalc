<script lang="ts">
	import { goto } from "$app/navigation";
	import CatalogDataOperationsDashboard from "$lib/components/moderation/CatalogDataOperationsDashboard/CatalogDataOperationsDashboard.svelte";
	import PrivilegedToolWorkspaceView from "$lib/components/moderation/PrivilegedToolWorkspaceView/PrivilegedToolWorkspaceView.svelte";
	import ProfilePage from "../../+page.svelte";
	import type { CatalogDataOperationsPageProps } from "./types";

	let { data }: CatalogDataOperationsPageProps = $props();
	const datasetImportEvidenceCount = $derived(
		data.dashboard.datasets.filter(
			(dataset) =>
				dataset.importEnabled &&
				(dataset.importedAt === null || !dataset.checksumRecorded),
		).length,
	);
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
					? datasetImportEvidenceCount === data.actionCount &&
						datasetImportEvidenceCount > 0
						? "Start with Dataset import evidence in Required work. The diagnostic totals below are broader, can overlap, and do not increase this red count."
						: "Start in Required work, then use the broader diagnostic checks to locate supporting evidence. Diagnostic totals can overlap and do not increase this red count."
					: "No deduplicated catalog subject currently requires an operator repair. Monitoring and reference details remain available below.",
		completion:
			"Every tracked issue is resolved from reviewed evidence and the red action total returns to zero.",
		count: data.actionCount,
		countLabel: "deduplicated data-operation subjects requiring attention",
	}}
	onClose={closeAction}
>
	<CatalogDataOperationsDashboard
		dashboard={data.dashboard}
		catalogMonitor={data.catalogMonitor}
		actionCount={data.actionCount}
	/>
</PrivilegedToolWorkspaceView>
