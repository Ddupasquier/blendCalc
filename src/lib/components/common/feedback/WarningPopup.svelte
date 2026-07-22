<script lang="ts">
	import WarningTriangle from "$lib/assets/icons/WarningTriangle.svelte";

	let {
		message,
		open = true,
		tone = "warning",
	}: {
		message: string;
		open?: boolean;
		tone?: "warning" | "error";
	} = $props();
</script>

{#if open && message}
	<div
		class="warning-popup warning-popup--{tone}"
		role={tone === "error" ? "alert" : "status"}
		aria-live="polite"
	>
		<span class="warning-popup__icon" aria-hidden="true">
			<WarningTriangle size={16} />
		</span>
		<span>{message}</span>
	</div>
{/if}

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.warning-popup {
		display: flex;
		align-items: center;
		gap: $app-gap-sm;
		width: 100%;
		padding: $app-status-padding-y $app-status-padding-x;
		color: $app-shell-text-primary;
		background: $app-status-warning-bg;
		border-radius: $app-shell-radius-pill;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-medium;
		line-height: 1.25;
	}

	.warning-popup--error {
		background: $app-status-error-bg;
	}

	.warning-popup__icon {
		display: inline-flex;
		flex: 0 0 auto;
		color: $app-status-warning-icon;
	}

	.warning-popup--error .warning-popup__icon {
		color: $app-status-error-icon;
	}
</style>
