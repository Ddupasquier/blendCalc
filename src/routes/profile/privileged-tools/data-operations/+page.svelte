<script lang="ts">
	import { goto } from "$app/navigation";
	import CatalogDataOperationsDashboard from "$lib/components/moderation/CatalogDataOperationsDashboard/CatalogDataOperationsDashboard.svelte";
	import PrivilegedToolRightSheet from "$lib/components/moderation/PrivilegedToolRightSheet/PrivilegedToolRightSheet.svelte";
	import ProfilePage from "../../+page.svelte";
	import type { CatalogDataOperationsPageProps } from "./types";

	let { data }: CatalogDataOperationsPageProps = $props();
	const closeAction = () => {
		void goto("/profile/privileged-tools", { replaceState: true });
	};
</script>

<ProfilePage />
<PrivilegedToolRightSheet
	id="profile-data-operations-view"
	title="Data operations"
	subtitle="Inspect publication readiness, mappings, revisions, sources, datasets, and policy coverage."
	informationKey="data-operations"
	onClose={closeAction}
>
	<CatalogDataOperationsDashboard
		dashboard={data.dashboard}
		catalogMonitor={data.catalogMonitor}
	/>
</PrivilegedToolRightSheet>
