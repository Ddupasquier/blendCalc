<script lang="ts">
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import BottomSheet from "$lib/components/common/sheets/BottomSheet/BottomSheet.svelte";
	import { moderatorActionInformationByAction } from "./moderatorActionInformation";
	import type { ModeratorActionInformationSheetProps } from "./types";

	let {
		open,
		action,
		onClose,
	}: ModeratorActionInformationSheetProps = $props();

	const information = $derived(moderatorActionInformationByAction[action]);
</script>

<BottomSheet
	id={`moderator-action-information-${action}`}
	{open}
	title={information.title}
	titleId={`moderator-action-information-${action}-title`}
	onClose={onClose}
>
	<div class="moderator-action-information">
		<p>{information.purpose}</p>
		<section aria-labelledby={`moderator-action-information-${action}-flow`}>
			<h3 id={`moderator-action-information-${action}-flow`}>Review flow</h3>
			<ol>
				{#each information.reviewSteps as reviewStep}
					<li>{reviewStep}</li>
				{/each}
			</ol>
		</section>
		<section aria-labelledby={`moderator-action-information-${action}-result`}>
			<h3 id={`moderator-action-information-${action}-result`}>What your decision changes</h3>
			<p>{information.decisionEffect}</p>
		</section>
		<section aria-labelledby={`moderator-action-information-${action}-guardrail`}>
			<h3 id={`moderator-action-information-${action}-guardrail`}>Important safeguard</h3>
			<p>{information.guardrail}</p>
		</section>
		<ActionButton type="button" fullWidth onclick={onClose}>Got it</ActionButton>
	</div>
</BottomSheet>

<style lang="scss">
	@use "./ModeratorActionInformationSheet.scss";
</style>
