<script lang="ts">
	import PillRow from "$lib/components/common/display/PillRow.svelte";

	type Props = {
		availableOptions: string[];
		disabled?: boolean;
		emptyLabel: string;
		filteredOptions: string[];
		helper: string;
		onAdd: (value: string) => void;
		onRemove: (value: string) => void;
		onSearchChange: (value: string) => void;
		onSelectChange: (value: string) => void;
		searchLabel: string;
		searchValue: string;
		selectedValues: string[];
		selectLabel: string;
		selectValue: string;
		title: string;
	};

	let {
		availableOptions,
		disabled = false,
		emptyLabel,
		filteredOptions,
		helper,
		onAdd,
		onRemove,
		onSearchChange,
		onSelectChange,
		searchLabel,
		searchValue,
		selectedValues,
		selectLabel,
		selectValue,
		title,
	}: Props = $props();

	const addSearchValue = () => {
		onAdd(searchValue);
	};
</script>

<section class="preference-editor-card">
	<div class="preference-editor-card__heading">
		<div>
			<h3>{title}</h3>
			<p>{helper}</p>
		</div>
	</div>

	<div class="preference-add-flow">
		<p class="preference-add-flow__label">Add a saved option or type your own.</p>

		<label class="preference-picker">
			<span>{selectLabel}</span>
			<div class="preference-picker__controls">
				<select
					value={selectValue}
					disabled={disabled}
					onchange={(event) =>
						onSelectChange((event.currentTarget as HTMLSelectElement).value)}
				>
					<option value="">Select an option</option>
					{#each availableOptions as option}
						<option value={option}>{option}</option>
					{/each}
				</select>
				<button
					type="button"
					class="search-add"
					disabled={disabled || !selectValue}
					onclick={() => onAdd(selectValue)}
				>
					Add
				</button>
			</div>
		</label>

		<div class="preference-add-flow__divider" aria-hidden="true">
			<span>or</span>
		</div>

		<label class="preference-search">
			<span>{searchLabel}</span>
			<div class="preference-search__controls">
				<input
					type="search"
					value={searchValue}
					placeholder="Search catalog or add your own"
					disabled={disabled}
					oninput={(event) =>
						onSearchChange((event.currentTarget as HTMLInputElement).value)}
					onkeydown={(event) => {
						if (event.key !== "Enter") return;
						event.preventDefault();
						addSearchValue();
					}}
				/>
				<button
					type="button"
					class="search-add"
					disabled={disabled || !searchValue.trim()}
					onclick={addSearchValue}
				>
					Add
				</button>
			</div>
		</label>
	</div>

	{#if filteredOptions.length}
		<PillRow
			pills={filteredOptions}
			onSelect={(index) => onAdd(filteredOptions[index])}
			removable={false}
		/>
	{/if}

	{#if selectedValues.length}
		<hr class="preference-divider" aria-hidden="true" />
		<PillRow
			pills={selectedValues}
			onRemove={(index) => onRemove(selectedValues[index])}
			preserveOrder
		/>
	{:else}
		<p class="preference-empty">{emptyLabel}</p>
	{/if}
</section>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.preference-divider {
		margin: 0;
		border: 0;
		border-top: $app-border;
		opacity: 0.65;
	}

	.preference-editor-card {
		display: grid;
		gap: $app-gap-sm;
		padding: $app-gap-sm;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-radius-sm;
	}

	.preference-editor-card__heading {
		display: flex;
		justify-content: space-between;
		align-items: start;
		gap: $app-gap-sm;

		h3 {
			margin: 0;
			font-size: $app-font-size-md;
			font-weight: 800;
		}

		p {
			margin: 0.2rem 0 0;
			color: $app-muted;
			font-size: $app-font-size-sm;
			line-height: 1.35;
		}
	}

	.preference-search,
	.preference-picker {
		display: grid;
		gap: 0.4rem;

		span {
			color: $app-muted;
			font-size: $app-font-size-xs;
			font-weight: 900;
			letter-spacing: 0.05em;
			text-transform: uppercase;
		}
	}

	.preference-add-flow {
		display: grid;
		gap: $app-gap-xs;
	}

	.preference-add-flow__label {
		color: $app-muted;
		font-size: $app-font-size-sm;
	}

	.preference-add-flow__divider {
		position: relative;
		display: grid;
		place-items: center;
		margin: -0.1rem 0;

		&::before {
			content: "";
			position: absolute;
			inset-inline: 0;
			top: 50%;
			border-top: $app-border;
			opacity: 0.45;
		}

		span {
			position: relative;
			padding: 0 0.45rem;
			color: $app-muted;
			background: $app-bg;
			font-size: $app-font-size-xs;
			font-weight: 900;
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}
	}

	.preference-picker__controls,
	.preference-search__controls {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: $app-gap-xs;
		align-items: center;
	}

	.search-add {
		width: fit-content;
		min-width: 4rem;
		font-family: $app-button-font-family;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
	}

	.preference-empty {
		color: $app-muted;
		font-size: $app-font-size-sm;
	}
</style>
