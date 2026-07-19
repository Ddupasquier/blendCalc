<script lang="ts">
	import SegmentedControl from "$lib/components/common/buttons/SegmentedControl.svelte";
	import type {
		ManualEntryStepTabsProps,
	} from "$lib/components/ingredients/manual-entry/formTypes";

	let {
		steps,
		activeStep,
		panelId,
		tabIdPrefix,
		onSelect,
	}: ManualEntryStepTabsProps = $props();

	const options = $derived(
		steps.map((step) => ({
			value: step.id,
			label: step.label,
			id: `${tabIdPrefix}-${step.id}`,
			controlsId: panelId,
		})),
	);
</script>

<nav class="manual-entry-tabs" aria-label="Manual ingredient steps">
	<SegmentedControl
		label="Manual ingredient progress"
		{options}
		value={activeStep}
		variant="progress"
		onSelect={(value) => onSelect(value as typeof activeStep)}
	/>
</nav>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.manual-entry-tabs {
		margin-block: $app-vertical-stack-gap;
	}
</style>
