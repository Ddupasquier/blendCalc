<script lang="ts">
	import { onMount, tick } from "svelte";
	import Check from "$lib/assets/icons/Check/Check.svelte";
	import ChevronDown from "$lib/assets/icons/ChevronDown/ChevronDown.svelte";
	import type { SelectFieldProps } from "./types";

	let {
		id,
		name = id,
		class: className = "",
		label,
		labelVisibility = "visible",
		ariaLabel,
		ariaDescribedBy,
		ariaInvalid = false,
		value = $bindable(""),
		options,
		helper,
		required = false,
		disabled = false,
		layout = "stacked",
		size = "default",
		width = "full",
		element = $bindable<HTMLButtonElement | null>(null),
		onValueChange,
	}: SelectFieldProps = $props();

	let rootElement = $state<HTMLDivElement | null>(null);
	let listboxElement = $state<HTMLDivElement | null>(null);
	let open = $state(false);
	let placement = $state<"top" | "bottom">("bottom");
	let popoverSupported = $state(false);
	let activeIndex = $state(-1);
	let validationInvalid = $state(false);
	let typeaheadQuery = "";
	let typeaheadTimer: number | null = null;

	const helperId = $derived(helper ? `${id}-helper` : undefined);
	const labelId = $derived(label ? `${id}-label` : undefined);
	const listboxId = $derived(`${id}-listbox`);
	const describedBy = $derived(
		[ariaDescribedBy, helperId].filter(Boolean).join(" ") || undefined,
	);
	const rootClass = $derived(
		["select-field", className].filter(Boolean).join(" "),
	);
	const visibleOptions = $derived(options.filter((option) => !option.hidden));
	const selectedOption = $derived(
		options.find((option) => option.value === value) ?? null,
	);
	const selectedVisibleIndex = $derived(
		visibleOptions.findIndex((option) => option.value === value),
	);
	const effectiveInvalid = $derived(ariaInvalid || validationInvalid);

	const isPopoverOpen = () =>
		Boolean(listboxElement?.matches?.(":popover-open"));

	function removePositionListeners() {
		window.removeEventListener("resize", syncListboxPosition);
		window.removeEventListener("scroll", syncListboxPosition, true);
	}

	function syncListboxPosition() {
		if (!open || !element || !listboxElement) return;
		const triggerRect = element.getBoundingClientRect();
		listboxElement.style.setProperty(
			"--select-field-trigger-left",
			`${triggerRect.left}px`,
		);
		listboxElement.style.setProperty(
			"--select-field-trigger-top",
			`${triggerRect.top}px`,
		);
		listboxElement.style.setProperty(
			"--select-field-trigger-bottom",
			`${triggerRect.bottom}px`,
		);
		listboxElement.style.setProperty(
			"--select-field-trigger-width",
			`${triggerRect.width}px`,
		);
		const panelHeight = listboxElement.getBoundingClientRect().height;
		const roomBelow = window.innerHeight - triggerRect.bottom;
		placement =
			roomBelow >= panelHeight || roomBelow >= triggerRect.top ? "bottom" : "top";
	}

	const scrollActiveOptionIntoView = () => {
		if (!listboxElement || activeIndex < 0) return;
		const activeOption = listboxElement.querySelector<HTMLElement>(
			`[data-option-index="${activeIndex}"]`,
		);
		activeOption?.scrollIntoView?.({ block: "nearest" });
	};

	const findEnabledIndex = (start: number, direction: 1 | -1) => {
		if (visibleOptions.length === 0) return -1;
		let index = start;
		for (let attempt = 0; attempt < visibleOptions.length; attempt += 1) {
			index = (index + direction + visibleOptions.length) % visibleOptions.length;
			if (!visibleOptions[index]?.disabled) return index;
		}
		return -1;
	};

	const setActiveIndex = async (index: number) => {
		activeIndex = index;
		await tick();
		scrollActiveOptionIntoView();
	};

	const showListbox = async () => {
		if (disabled || open) return;
		const selectedIndex =
			selectedVisibleIndex >= 0 && !visibleOptions[selectedVisibleIndex]?.disabled
				? selectedVisibleIndex
				: findEnabledIndex(-1, 1);
		activeIndex = selectedIndex;
		open = true;
		placement = "bottom";
		await tick();
		if (!listboxElement) return;
		if (
			popoverSupported &&
			typeof listboxElement.showPopover === "function" &&
			!isPopoverOpen()
		) {
			try {
				listboxElement.showPopover();
			} catch {}
		}
		syncListboxPosition();
		window.addEventListener("resize", syncListboxPosition);
		window.addEventListener("scroll", syncListboxPosition, true);
		scrollActiveOptionIntoView();
	};

	const hideListbox = ({ restoreFocus = false } = {}) => {
		if (!open) return;
		removePositionListeners();
		if (
			popoverSupported &&
			typeof listboxElement?.hidePopover === "function" &&
			isPopoverOpen()
		) {
			listboxElement.hidePopover();
		}
		open = false;
		activeIndex = -1;
		if (restoreFocus) element?.focus({ preventScroll: true });
	};

	const chooseOption = (index: number) => {
		const option = visibleOptions[index];
		if (!option || option.disabled) return;
		value = option.value;
		validationInvalid = false;
		onValueChange?.(value);
		hideListbox({ restoreFocus: true });
	};

	const moveActiveOption = (direction: 1 | -1) => {
		const start = activeIndex >= 0 ? activeIndex : direction === 1 ? -1 : 0;
		const nextIndex = findEnabledIndex(start, direction);
		if (nextIndex >= 0) void setActiveIndex(nextIndex);
	};

	const handleTypeahead = (key: string) => {
		if (typeaheadTimer !== null) window.clearTimeout(typeaheadTimer);
		typeaheadQuery += key.toLocaleLowerCase();
		typeaheadTimer = window.setTimeout(() => {
			typeaheadQuery = "";
			typeaheadTimer = null;
		}, 500);
		const matchIndex = visibleOptions.findIndex(
			(option) =>
				!option.disabled &&
				option.label.toLocaleLowerCase().startsWith(typeaheadQuery),
		);
		if (matchIndex >= 0) void setActiveIndex(matchIndex);
	};

	const handleTriggerKeydown = (event: KeyboardEvent) => {
		if (disabled) return;
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			if (!open) {
				void showListbox();
				return;
			}
			moveActiveOption(event.key === "ArrowDown" ? 1 : -1);
			return;
		}
		if (event.key === "Home" && open) {
			event.preventDefault();
			void setActiveIndex(findEnabledIndex(-1, 1));
			return;
		}
		if (event.key === "End" && open) {
			event.preventDefault();
			void setActiveIndex(findEnabledIndex(0, -1));
			return;
		}
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			if (open && activeIndex >= 0) chooseOption(activeIndex);
			else void showListbox();
			return;
		}
		if (event.key === "Escape" && open) {
			event.preventDefault();
			hideListbox();
			return;
		}
		if (event.key === "Tab" && open) {
			hideListbox();
			return;
		}
		if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
			if (!open) void showListbox();
			handleTypeahead(event.key);
		}
	};

	onMount(() => {
		popoverSupported = Boolean(
			typeof CSS !== "undefined" &&
				CSS.supports?.("selector(:popover-open)") &&
				typeof HTMLElement.prototype.showPopover === "function",
		);
		const handleDocumentPointerDown = (event: PointerEvent) => {
			if (!open || rootElement?.contains(event.target as Node)) return;
			hideListbox();
		};
		document.addEventListener("pointerdown", handleDocumentPointerDown);
		return () => {
			document.removeEventListener("pointerdown", handleDocumentPointerDown);
			removePositionListeners();
			if (typeaheadTimer !== null) window.clearTimeout(typeaheadTimer);
		};
	});
</script>

{#snippet control()}
	<div class="select-field__control">
		<select
			id={`${id}-native`}
			class="select-field__native"
			{name}
			{value}
			{required}
			{disabled}
			tabindex="-1"
			aria-hidden="true"
			oninvalid={(event) => {
				event.preventDefault();
				validationInvalid = true;
				element?.focus({ preventScroll: true });
				void showListbox();
			}}
		>
			{#each options as option (option.value)}
				<option
					value={option.value}
					disabled={option.disabled}
					hidden={option.hidden}
				>{option.label}</option>
			{/each}
		</select>
		<button
			bind:this={element}
			{id}
			type="button"
			class="select-field__trigger"
			role="combobox"
			aria-label={ariaLabel}
			aria-labelledby={ariaLabel ? undefined : labelId}
			aria-describedby={describedBy}
			aria-controls={listboxId}
			aria-expanded={open}
			aria-haspopup="listbox"
			aria-activedescendant={open && activeIndex >= 0
				? `${id}-option-${activeIndex}`
				: undefined}
			aria-invalid={effectiveInvalid || undefined}
			aria-required={required || undefined}
			data-placeholder={selectedOption?.placeholder || !selectedOption || undefined}
			{disabled}
			onclick={() => (open ? hideListbox() : void showListbox())}
			onkeydown={handleTriggerKeydown}
		>
			<span class="select-field__value">{selectedOption?.label ?? "Choose an option"}</span>
			<span class="select-field__icon" aria-hidden="true" data-open={open}>
				<ChevronDown size={16} strokeWidth={2.4} />
			</span>
		</button>
		{#if open}
			<div
				bind:this={listboxElement}
				id={listboxId}
				class="select-field__listbox"
				popover={popoverSupported ? "manual" : undefined}
				role="listbox"
				data-placement={placement}
				aria-label={ariaLabel ?? label ?? "Options"}
			>
				{#each visibleOptions as option, index (option.value)}
					<button
						id={`${id}-option-${index}`}
						data-option-index={index}
						type="button"
						class="select-field__option"
						class:select-field__option--active={index === activeIndex}
						role="option"
						aria-selected={option.value === value}
						tabindex="-1"
						disabled={option.disabled}
						onpointermove={() => {
							if (!option.disabled) activeIndex = index;
						}}
						onclick={() => chooseOption(index)}
					>
						<span>{option.label}</span>
						{#if option.value === value}
							<span class="select-field__check" aria-hidden="true">
								<Check size={16} strokeWidth={2.5} />
							</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
	{#if helper}
		<small id={helperId} class="select-field__helper">{helper}</small>
	{/if}
{/snippet}

<div
	bind:this={rootElement}
	class={rootClass}
	data-layout={layout}
	data-size={size}
	data-width={width}
	data-open={open}
>
	{#if label}
		<label
			id={labelId}
			for={id}
			class="select-field__label"
			class:select-field__label--sr-only={labelVisibility === "sr-only"}
		>
			{label}
		</label>
	{/if}
	{@render control()}
</div>

<style lang="scss">
	@use "./SelectField.scss";
</style>
