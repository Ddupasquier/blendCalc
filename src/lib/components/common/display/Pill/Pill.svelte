<script lang="ts">
	import CustomBadge from "../CustomBadge/CustomBadge.svelte";
	import type { PillProps } from "./types";

    let {
        label,
        onRemove,
		onRename,
        onSelect,
		removable = true,
        active = false,
        custom = false,
		disabled = false,
	}: PillProps = $props();
</script>

<span
    class="pill {active ? 'active' : ''}"
    class:custom
    role="button"
    tabindex="0"
    onclick={() => !disabled && onSelect?.()}
	aria-disabled={disabled}
    onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
            if (!disabled) onSelect?.();
        }
    }}
>
    <span class="pill-label" title={label}>{label}</span>
    {#if custom}
        <CustomBadge />
    {/if}
	{#if onRename}
		<button
			class="pill-action pill-rename"
			aria-label={`Rename ${label}`}
			disabled={disabled}
			tabindex="-1"
			type="button"
			onclick={(e) => {
				e.stopPropagation();
				if (!disabled) onRename();
			}}
		>✎</button>
	{/if}
	{#if removable && onRemove}
		<button
			class="pill-action pill-remove"
			aria-label={`Remove ${label}`}
			disabled={disabled}
			tabindex="-1"
			type="button"
			onclick={(e) => {
				e.stopPropagation();
				if (!disabled) onRemove();
			}}>&times;</button
		>
	{/if}
</span>

<style lang="scss">
	@use "./Pill.scss";
</style>
