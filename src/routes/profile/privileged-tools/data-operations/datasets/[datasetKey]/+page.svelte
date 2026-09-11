<script lang="ts">
	import { goto } from "$app/navigation";
	import DatasetImportEvidenceReview from "$lib/components/moderation/DatasetImportEvidenceReview/DatasetImportEvidenceReview.svelte";
	import PrivilegedToolWorkspaceView from "$lib/components/moderation/PrivilegedToolWorkspaceView/PrivilegedToolWorkspaceView.svelte";
	import ProfilePage from "../../../../+page.svelte";
	import type { DatasetImportEvidencePageProps } from "./types";

	let { data, form }: DatasetImportEvidencePageProps = $props();
	const closeAction = () => {
		void goto("/profile/privileged-tools/data-operations", {
			replaceState: true,
		});
	};
</script>

<ProfilePage />
<PrivilegedToolWorkspaceView
	id="profile-dataset-import-evidence"
	title="Record dataset evidence"
	subtitle="Verify the exact release, import completion time, and source-file checksum before clearing this operational finding."
	informationKey="data-operations"
	guide={{
		tone: data.workspace.actionRequired ? "attention" : "clear",
		title: data.workspace.actionRequired
			? "Complete the missing import evidence"
			: "This dataset evidence is complete",
		description: data.workspace.actionRequired
			? "Enter only evidence from the completed import or its retained log. Preview validates the release and shows the exact fields that would change; applying records those fields and reruns the health check."
			: "The canonical import time and SHA-256 are already recorded. Nothing else needs to be approved on this screen.",
		completion:
			"The canonical dataset has both an import completion time and exact SHA-256, and the owning health finding no longer appears in Data operations.",
		count: data.workspace.actionRequired ? 1 : 0,
		countLabel: "dataset evidence finding requiring action",
	}}
	onClose={closeAction}
>
	<DatasetImportEvidenceReview workspace={data.workspace} {form} />
</PrivilegedToolWorkspaceView>
