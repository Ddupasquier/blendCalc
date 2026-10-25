<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { enhance } from "$app/forms";
	import ProfilePage from "../../+page.svelte";
	import PrivilegedToolWorkspaceView from "$lib/components/moderation/PrivilegedToolWorkspaceView/PrivilegedToolWorkspaceView.svelte";
	import ImagePlacementReviewList from "$lib/components/moderation/ImagePlacementReviewList/ImagePlacementReviewList.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import type { ImagePlacementReviewPageProps } from "./types";
	let { data, form }: ImagePlacementReviewPageProps = $props();
	let changingAutomation = $state(false);
	let contributorAction = $state("restrict");
	let contributorEnabled = $state("true");
</script>

<ProfilePage />
<PrivilegedToolWorkspaceView
	id="image-placement-review"
	title="Food image placement"
	subtitle="Review disputed placements, protect shared images, and undo changes. Personal adjustments never wait here."
	informationKey="image-placement"
	feedbackMessage={form?.error ?? form?.success}
	feedbackTone={form?.error ? "danger" : "success"}
	guide={{
		tone: data.workspace.pendingImages ? "attention" : "clear",
		title: `${data.workspace.pendingImages} ${data.workspace.pendingImages === 1 ? "image" : "images"} awaiting review`,
		description:
			"Similar suggestions are grouped. Small, uncontested adjustments can publish after three eligible contributors agree. New accounts do not count toward automatic approval.",
		completion:
			"Review a group once, reject unsupported suggestions, or lock a placement that should stay put. The first 25 images and first 10 groups per image are shown; resolved groups leave the queue.",
		count: data.workspace.pendingImages,
		countLabel: "images with pending placement suggestions",
	}}
	onClose={() =>
		void goto(resolve("/profile/privileged-tools"), { replace: true })}
>
	{#snippet sidebar()}
		<form
			method="POST"
			action="?/review"
			use:enhance={() => {
				changingAutomation = true;
				return async ({ update }) => {
					try {
						await update();
					} finally {
						changingAutomation = false;
					}
				};
			}}
		>
			<input type="hidden" name="action" value="automation" />
			<input
				type="hidden"
				name="enabled"
				value={String(!data.workspace.automationEnabled)}
			/>
			<p>
				Automatic publishing is {data.workspace.automationEnabled
					? "on"
					: "paused"}. Changing this affects future agreement checks; pending
				groups can still be reviewed below.
			</p>
			<RoundedActionButton type="submit" fullWidth busy={changingAutomation}
				>{data.workspace.automationEnabled
					? "Pause automatic publishing"
					: "Enable automatic publishing"}</RoundedActionButton
			>
		</form>
		<form method="POST" action="?/review" use:enhance>
			<TextField
				id="placement-contributor-id"
				name="userId"
				label="Contributor account ID"
				required
				maxlength={36}
				helper="Use the account ID from Account access or a proposal’s contributor controls."
			/>
			<SelectField
				id="placement-contributor-action"
				name="action"
				label="Control"
				value={contributorAction}
				options={[
					{ value: "restrict", label: "Shared-suggestion restriction" },
					{ value: "trust", label: "Trusted status" },
				]}
				onValueChange={(value) => (contributorAction = value)}
			/>
			<SelectField
				id="placement-contributor-enabled"
				name="enabled"
				label="Setting"
				value={contributorEnabled}
				options={[
					{ value: "true", label: "Enable" },
					{ value: "false", label: "Remove" },
				]}
				onValueChange={(value) => (contributorEnabled = value)}
			/>
			<RoundedActionButton type="submit" fullWidth
				>Update contributor</RoundedActionButton
			>
		</form>
	{/snippet}
	<ImagePlacementReviewList workspace={data.workspace} />
</PrivilegedToolWorkspaceView>
