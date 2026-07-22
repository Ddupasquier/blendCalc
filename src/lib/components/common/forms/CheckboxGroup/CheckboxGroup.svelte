<!-- Reusable CheckboxGroup component for selecting options -->
<script lang="ts">
	import type { CheckboxGroupProps } from "./types";

	const {
        options = [],
        selected = [],
		onChange = () => {},
	}: CheckboxGroupProps = $props();

    const toggle = (id: string | number) => {
        const idx = selected.indexOf(id);
        const next =
            idx === -1
                ? [...selected, id]
                : selected.filter((v: string | number) => v !== id);
        onChange(next);
    };
</script>

<div class="checkbox-group">
    {#each options as opt}
        <label class:selected={selected.includes(opt.id)} class="checkbox-item">
            <input
                id={`checkbox-${opt.id}`}
                name={`checkbox-${opt.id}`}
                type="checkbox"
                checked={selected.includes(opt.id)}
                onchange={() => toggle(opt.id)}
            />
            {opt.label}
        </label>
    {/each}
</div>

<style lang="scss">
	@use "./CheckboxGroup.scss";
</style>
