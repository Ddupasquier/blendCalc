<script lang="ts">
	import type { Snippet } from "svelte";
	import BackButton from "$lib/components/common/buttons/BackButton.svelte";
	import WarningPopup from "$lib/components/common/feedback/WarningPopup.svelte";
	import ManualEntryStepTabs from "$lib/components/ingredients/manual-entry/ManualEntryStepTabs.svelte";
	import ManualEntryToggle from "$lib/components/ingredients/manual-entry/ManualEntryToggle.svelte";
	import type {
		ManualEntryStep,
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
		onBack,
		onSelectStep,
		onDetailsElement = () => {},
		onBodyElement = () => {},
	}: {
		inline?: boolean;
		activeStep: ManualEntryStepId;
		steps: ManualEntryStep[];
		saving?: boolean;
		lookingUpBarcode?: boolean;
		stepWarningMessage?: string;
		stepWarningStep?: ManualEntryStepId | null;
		children: Snippet;
		onBack: () => void;
		onSelectStep: (step: ManualEntryStepId) => void;
		onDetailsElement?: (element: HTMLDetailsElement | null) => void;
		onBodyElement?: (element: HTMLFieldSetElement | null) => void;
	} = $props();

	let detailsElement = $state<HTMLDetailsElement | null>(null);
	let bodyElement = $state<HTMLFieldSetElement | null>(null);

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
				<BackButton
					class="custom-ingredient__back"
					label="Back"
					onclick={onBack}
				/>
				<h2>Enter Manually</h2>
			</header>
		{/if}

		<ManualEntryStepTabs
			{steps}
			{activeStep}
			onSelect={handleSelectStep}
		/>

		<WarningPopup
			open={Boolean(stepWarningMessage && stepWarningStep === activeStep)}
			message={stepWarningMessage}
			tone="error"
		/>

		{@render children()}
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
		padding: $ingredient-card-padding-compact $ingredient-card-padding;
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
		gap: $app-vertical-stack-gap;
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
			color: $ingredient-text-primary;
			font-family: $app-font-family-interface;
			font-size: $app-font-size-lg;
			font-weight: $app-font-weight-bold;
		}
	}
</style>
