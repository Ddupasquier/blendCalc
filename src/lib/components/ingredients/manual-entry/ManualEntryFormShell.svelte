<script lang="ts">
	import WarningPopup from "$lib/components/common/feedback/WarningPopup.svelte";
	import ManualEntryStepTabs from "$lib/components/ingredients/manual-entry/ManualEntryStepTabs.svelte";
	import ManualEntryToggle from "$lib/components/ingredients/manual-entry/ManualEntryToggle.svelte";
	import type {
		ManualEntryFormShellProps,
		ManualEntryStepId,
	} from "$lib/components/ingredients/manual-entry/formTypes";

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
	@use "../../../../styles/variables" as *;

	.custom-ingredient__manual {
		overflow: hidden;
		background: transparent;
		border: 0;
		border-radius: 0;
	}

	.custom-ingredient__manual--sheet {
		display: block;
		overflow: visible;
	}

	.custom-ingredient__manual-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: $app-shell-card-padding-compact $app-shell-card-padding;
		list-style: none;
		cursor: pointer;

		&::-webkit-details-marker {
			display: none;
		}
	}

	.custom-ingredient__manual-toggle--sheet-hidden {
		display: none;
	}

	.custom-ingredient__body {
		display: grid;
		gap: $app-gap-md;
		min-width: 0;
		padding: 0;
		margin: 0;
		background: transparent;
		border: 0;
	}

	.custom-ingredient__header {
		display: flex;
		align-items: center;
		gap: $app-gap-sm;

		h2 {
			margin: 0;
			color: $app-shell-text-primary;
			font-family: $app-font-family-interface;
			font-size: $app-font-size-lg;
			font-weight: $app-font-weight-bold;
		}
	}

	.custom-ingredient__step-panel {
		display: grid;
		gap: $app-gap-md;
		min-width: 0;
	}
</style>
