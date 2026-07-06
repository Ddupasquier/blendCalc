<script lang="ts">
	let { label = "Custom" } = $props<{
		label?: string;
	}>();
</script>

<span class="custom-badge">{label}</span>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.custom-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: fit-content;
		max-width: 100%;
		padding: 0.06rem 0.42rem;
		color: $app-btn-text;
		background: $app-custom-strong;
		border: 1px solid $app-custom-strong;
		border-radius: $app-radius-pill;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-heavy;
		line-height: 1.1;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
	}
</style>
