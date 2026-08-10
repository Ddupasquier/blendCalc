<script lang="ts">
	import WarningPopup from "$lib/components/common/feedback/WarningPopup/WarningPopup.svelte";
	import ManualEntryStepTabs from "$lib/components/ingredients/manual-entry/ManualEntryStepTabs/ManualEntryStepTabs.svelte";
	import ManualEntryToggle from "$lib/components/ingredients/manual-entry/ManualEntryToggle/ManualEntryToggle.svelte";
	import type { ManualEntryStepId } from "$lib/components/ingredients/manual-entry/formTypes";
	import { animatedDetails } from "$lib/utils/animation/animatedDetails";
	import type { ManualEntryFormShellProps } from "./types";

	let {
		inline = true,
		activeStep,
		steps,
		saving = false,
		lookingUpBarcode = false,
		stepWarningMessage = "",
		stepWarningStep = null,
		children,
		onSelectStep,
		onDetailsElement = () => {},
		onBodyElement = () => {},
	}: ManualEntryFormShellProps = $props();

	let detailsElement = $state<HTMLDetailsElement | null>(null);
	let bodyElement = $state<HTMLFieldSetElement | null>(null);
	const shellId = $props.id();
	const stepPanelId = `${shellId}-step-panel`;
	const stepTabIdPrefix = `${shellId}-step-tab`;

	$effect(() => {
		onDetailsElement(detailsElement);
	});

	$effect(() => {
		onBodyElement(bodyElement);
	});

	const handleSelectStep = (step: string) => {
		onSelectStep(step as ManualEntryStepId);
	};
</script>

<details
	class="custom-ingredient__manual"
	class:custom-ingredient__manual--sheet={!inline}
	open={!inline}
	bind:this={detailsElement}
	use:animatedDetails
>
	<summary
		class="custom-ingredient__manual-toggle"
		class:custom-ingredient__manual-toggle--sheet-hidden={!inline}
		aria-hidden={!inline}
	>
		<ManualEntryToggle />
	</summary>

	<fieldset
		bind:this={bodyElement}
		class="custom-ingredient__body"
		disabled={saving || lookingUpBarcode}
		aria-busy={saving || lookingUpBarcode}
	>
		{#if inline}
			<header class="custom-ingredient__header">
				<h2>Enter Manually</h2>
			</header>
		{/if}

		<ManualEntryStepTabs
			{steps}
			{activeStep}
			panelId={stepPanelId}
			tabIdPrefix={stepTabIdPrefix}
			onSelect={handleSelectStep}
		/>

		<div
			id={stepPanelId}
			class="custom-ingredient__step-panel"
			role="tabpanel"
			aria-labelledby={`${stepTabIdPrefix}-${activeStep}`}
		>
			<WarningPopup
				open={Boolean(stepWarningMessage && stepWarningStep === activeStep)}
				message={stepWarningMessage}
				tone="error"
			/>

			{@render children()}
		</div>
	</fieldset>
</details>

<style lang="scss">
	@use "./ManualEntryFormShell.scss";
</style>
