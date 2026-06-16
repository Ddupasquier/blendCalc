<!-- Reusable CheckboxGroup component for selecting options -->
<script lang="ts">
    const {
        options = [],
        selected = [],
        onChange = () => {},
    } = $props<{
        options?: { id: string | number; label: string }[];
        selected?: (string | number)[];
        onChange?: (selected: (string | number)[]) => void;
    }>();

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
    @use "../../../styles/variables" as *;

    .checkbox-group {
        display: flex;
        flex-wrap: wrap;
        gap: $app-gap-sm;
    }

    .checkbox-item {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        min-height: $app-control-height-sm;
        padding: 0.32rem 0.62rem;
        color: $app-primary;
        background: $app-section-bg;
        border: $app-border;
        border-radius: $app-radius-pill;
        font-size: $app-font-size-md;
        font-family: $app-button-font-family;
        font-weight: $app-button-font-weight;
        line-height: $app-button-line-height;
        cursor: pointer;
        transition:
            background 0.15s,
            border-color 0.15s,
            color 0.15s;

        &:hover {
            border-color: $app-accent;
            background: $app-accent;
        }

        &.selected {
            color: $app-btn-text;
            background: $app-primary;
            border-color: $app-primary;
        }
    }

    input {
        position: relative;
        display: inline-grid;
        flex: 0 0 auto;
        place-content: center;
        width: 0.85rem;
        height: 0.85rem;
        margin: 0;
        appearance: none;
        color: $app-primary;
        background: $app-section-bg;
        border: 1.5px solid currentColor;
        border-radius: 0.22rem;
        transition:
            background 0.15s,
            border-color 0.15s,
            color 0.15s;

        &::before {
            content: "";
            width: 0.28rem;
            height: 0.5rem;
            border: solid currentColor;
            border-width: 0 0.14rem 0.14rem 0;
            transform: rotate(45deg) scale(0);
            transform-origin: center;
            transition: transform 0.12s ease;
        }

        &:checked::before {
            transform: rotate(45deg) scale(1);
        }

        .selected & {
            color: $app-primary;
            background: $app-btn-text;
            border-color: $app-btn-text;
        }
    }
</style>
