<script lang="ts">
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import BottomSheet from "$lib/components/common/sheets/BottomSheet/BottomSheet.svelte";
	import { privilegedToolInformationByTool } from "./privilegedToolInformation";
	import type { PrivilegedToolInformationSheetProps } from "./types";

	let { open, action, onClose }: PrivilegedToolInformationSheetProps = $props();

	const information = $derived(privilegedToolInformationByTool[action]);
</script>

<BottomSheet
	id={`privileged-tool-information-${action}`}
	{open}
	title={information.title}
	titleId={`privileged-tool-information-${action}-title`}
	{onClose}
>
	<div class="privileged-tool-information">
		<p>{information.purpose}</p>
		<section aria-labelledby={`privileged-tool-information-${action}-flow`}>
			<h3 id={`privileged-tool-information-${action}-flow`}>Review flow</h3>
			<ol>
				{#each information.reviewSteps as reviewStep}
					<li>{reviewStep}</li>
				{/each}
			</ol>
		</section>
		<section aria-labelledby={`privileged-tool-information-${action}-result`}>
			<h3 id={`privileged-tool-information-${action}-result`}>
				What your decision changes
			</h3>
			<p>{information.decisionEffect}</p>
		</section>
		<section
			aria-labelledby={`privileged-tool-information-${action}-guardrail`}
		>
			<h3 id={`privileged-tool-information-${action}-guardrail`}>
				Important safeguard
			</h3>
			<p>{information.guardrail}</p>
		</section>
		<ActionButton type="button" fullWidth onclick={onClose}>Got it</ActionButton
		>
	</div>
</BottomSheet>

<style lang="scss">
	@use "./PrivilegedToolInformationSheet.scss";
</style>
