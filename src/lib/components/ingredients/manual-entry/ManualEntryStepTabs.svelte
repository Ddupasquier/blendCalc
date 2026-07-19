<script lang="ts">
	import type {
		ManualEntryStepTabsProps,
	} from "$lib/components/ingredients/manual-entry/formTypes";

	let {
		steps,
		activeStep,
		onSelect,
	}: ManualEntryStepTabsProps = $props();

	const activeIndex = $derived(
		Math.max(
			0,
			steps.findIndex((step) => step.id === activeStep),
		),
	);
</script>

<nav class="manual-entry-tabs" aria-label="Manual ingredient steps">
	{#each steps as step, index}
		<button
			type="button"
			aria-current={step.id === activeStep ? "step" : undefined}
			class:manual-entry-tabs__step--active={index <= activeIndex}
			class:manual-entry-tabs__step--current={step.id === activeStep}
			onclick={() => onSelect(step.id)}
		>
			<span aria-hidden="true"></span>
			<small>{step.label}</small>
		</button>
	{/each}
</nav>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.manual-entry-tabs {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: $app-gap-xs;
		padding: $app-gap-xs;
		margin-block: $app-vertical-stack-gap;
	}

	button {
		display: grid;
		gap: $app-gap-xs;
		align-items: center;
		padding: 0;
		color: $ingredient-text-muted;
		font-family: $app-font-family-interface;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-medium;
		background: transparent;
		border: 0;
		cursor: pointer;

		&:focus-visible {
			outline: $app-focus-outline;
			outline-offset: $app-focus-outline-offset;
		}
	}

	span {
		display: block;
		width: 100%;
		height: 0.22rem;
		border-radius: $ingredient-radius-pill;
		background: $ingredient-surface-control;
		transition:
			background-color 160ms ease,
			opacity 160ms ease;
	}

	.manual-entry-tabs__step--active span {
		background: $ingredient-accent-primary;
	}

	.manual-entry-tabs__step--current {
		color: $ingredient-accent-primary;
	}
</style>
