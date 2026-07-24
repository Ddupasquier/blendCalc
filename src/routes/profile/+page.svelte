<script lang="ts">
	import { enhance } from "$app/forms";
	import { invalidateAll } from "$app/navigation";
	import User from "$lib/assets/icons/User/User.svelte";
	import RoundedActionLink from "$lib/components/common/buttons/RoundedActionLink/RoundedActionLink.svelte";
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import PhotoUploadInput from "$lib/components/common/forms/PhotoUploadInput/PhotoUploadInput.svelte";
	import NumberInput from "$lib/components/common/forms/NumberInput/NumberInput.svelte";
	import CircularMediaFrame from "$lib/components/common/images/CircularMediaFrame/CircularMediaFrame.svelte";
	import FoodPreferencePicker from "$lib/components/profile/FoodPreferencePicker/FoodPreferencePicker.svelte";
	import { APP_NAME } from "$lib/config/brand";
	import { formatDocumentTitle } from "$lib/config/pageMetadata";
	import {
		getServingSizeDisplayValue,
		type DefaultServingUnit,
	} from "$lib/utils/profile/foodPreferences";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import type {
		PreferenceGroupKey,
		PreferenceGroupMeta,
		ProfilePageProps,
	} from "./types";

	let {
		data,
		form,
	}: ProfilePageProps = $props();

	const profileValues = $derived({
		displayName:
			form?.profileValues?.displayName ??
			data.profile?.display_name ??
			data.defaultDisplayName,
		bio: form?.profileValues?.bio ?? data.profile?.bio ?? "",
	});
	const storedServingUnit = $derived<DefaultServingUnit>(
		data.foodPreferences?.unitSystem === "us" ? "oz" : "g",
	);
	const incomingFoodPreferenceValues = $derived({
		unitSystem:
			form?.foodPreferenceValues?.unitSystem ??
			data.foodPreferences?.unitSystem ??
			"",
		allergens:
			form?.foodPreferenceValues?.allergens ??
			data.foodPreferences?.allergens ??
			[],
		dietaryRestrictions:
			form?.foodPreferenceValues?.dietaryRestrictions ??
			data.foodPreferences?.dietaryRestrictions ??
			[],
		prioritizedNutrientIds:
			form?.foodPreferenceValues?.prioritizedNutrientIds ??
			data.foodPreferences?.prioritizedNutrientIds ??
			[],
		defaultSmoothieServingUnit:
			form?.foodPreferenceValues?.defaultSmoothieServingUnit ?? storedServingUnit,
		defaultSmoothieServingSize:
			form?.foodPreferenceValues?.defaultSmoothieServingSize ??
			getServingSizeDisplayValue(
				data.foodPreferences?.defaultSmoothieServingGrams,
				storedServingUnit,
			),
		sensitiveAcknowledged:
			form?.foodPreferenceValues?.sensitiveAcknowledged ??
			Boolean(data.foodPreferences?.sensitiveAcknowledgedAt),
	});
	const normalizePreferenceValue = (value: string) =>
		value.toLocaleLowerCase().trim().replace(/\s+/g, " ");
	const uniquePreferenceValues = (values: string[]) => {
		const seen = new Set<string>();
		return values.filter((value) => {
			const key = normalizePreferenceValue(value);
			if (!key || seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	};
	const getOptionRows = (optionLabels: string[], selectedValues: string[]) =>
		uniquePreferenceValues([...optionLabels, ...selectedValues]);

	let allergens = $state<string[]>([]);
	let dietaryRestrictions = $state<string[]>([]);
	let lastPreferenceSeed = "";
	const preferenceSeed = $derived(
		JSON.stringify({
			allergens: incomingFoodPreferenceValues.allergens,
			dietaryRestrictions: incomingFoodPreferenceValues.dietaryRestrictions,
		}),
	);

	$effect(() => {
		const seed = preferenceSeed;
		if (seed === lastPreferenceSeed) return;
		lastPreferenceSeed = seed;
		allergens = [...incomingFoodPreferenceValues.allergens];
		dietaryRestrictions = [...incomingFoodPreferenceValues.dietaryRestrictions];
	});

	const preferenceGroupMeta: Record<
		PreferenceGroupKey,
		PreferenceGroupMeta
	> = {
		allergens: {
			title: "Allergens",
			helper: "Adds warnings when metadata suggests a conflict.",
			searchLabel: "Type your own allergen",
			selectLabel: "Common allergens",
		},
		dietaryRestrictions: {
			title: "Dietary restrictions",
			helper: "Warns on possible conflicts. It never prevents adding an item.",
			searchLabel: "Type your own restriction",
			selectLabel: "Common restrictions",
		},
	};
	let preferenceSearch = $state<Record<PreferenceGroupKey, string>>({
		allergens: "",
		dietaryRestrictions: "",
	});
	let preferenceSelect = $state<Record<PreferenceGroupKey, string>>({
		allergens: "",
		dietaryRestrictions: "",
	});

	const readPreferenceGroup = (group: PreferenceGroupKey) => {
		switch (group) {
			case "allergens":
				return allergens;
			case "dietaryRestrictions":
				return dietaryRestrictions;
		}
	};

	const writePreferenceGroup = (group: PreferenceGroupKey, nextValues: string[]) => {
		const uniqueValues = uniquePreferenceValues(nextValues);
		switch (group) {
			case "allergens":
				allergens = uniqueValues;
				return;
			case "dietaryRestrictions":
				dietaryRestrictions = uniqueValues;
				return;
		}
	};

	const removePreferenceValue = (group: PreferenceGroupKey, value: string) => {
		const valueKey = normalizePreferenceValue(value);
		writePreferenceGroup(
			group,
			readPreferenceGroup(group).filter(
				(item) => normalizePreferenceValue(item) !== valueKey,
			),
		);
	};

	const setPreferenceSearch = (group: PreferenceGroupKey, value: string) => {
		preferenceSearch = {
			...preferenceSearch,
			[group]: value,
		};
	};

	const getPreferenceSearch = (group: PreferenceGroupKey) =>
		preferenceSearch[group] ?? "";

	const getOptionPool = (group: PreferenceGroupKey) => {
		switch (group) {
			case "allergens":
				return allergenOptions;
			case "dietaryRestrictions":
				return restrictionOptions;
		}
	};

	const getFilteredOptions = (group: PreferenceGroupKey) => {
		const query = normalizePreferenceValue(getPreferenceSearch(group));
		return getAvailableOptions(group).filter((option) => {
			if (!query) return true;
			return normalizePreferenceValue(option).includes(query);
		});
	};

	const getAvailableOptions = (group: PreferenceGroupKey) => {
		const selected = new Set(readPreferenceGroup(group).map(normalizePreferenceValue));
		return getOptionPool(group).filter(
			(option) => !selected.has(normalizePreferenceValue(option)),
		);
	};

	const addPreferenceValue = (group: PreferenceGroupKey, value: string) => {
		const cleanedValue = value.trim().replace(/\s+/g, " ");
		if (!cleanedValue) {
			return;
		}
		const existingValues = readPreferenceGroup(group);
		if (
			existingValues.some(
				(item) =>
					normalizePreferenceValue(item) === normalizePreferenceValue(cleanedValue),
			)
		) {
			return;
		}
		writePreferenceGroup(group, [...existingValues, cleanedValue]);
		setPreferenceSearch(group, "");
		preferenceSelect = {
			...preferenceSelect,
			[group]: "",
		};
	};

	const setPreferenceSelect = (group: PreferenceGroupKey, value: string) => {
		preferenceSelect = {
			...preferenceSelect,
			[group]: value,
		};
	};

	const getPreferenceSelect = (group: PreferenceGroupKey) =>
		preferenceSelect[group] ?? "";

	const priorityNutrientLabels = $derived(
		incomingFoodPreferenceValues.prioritizedNutrientIds
			.map((nutrientId) =>
				data.priorityNutrientOptions.find((nutrient) => nutrient.id === nutrientId),
			)
			.filter((nutrient) => nutrient !== undefined)
			.map((nutrient) => nutrient.label),
	);
	const suggestedAllergenLabels = $derived(
		data.foodPreferenceOptions.allergens.map((option) => option.label),
	);
	const suggestedRestrictionLabels = $derived(
		data.foodPreferenceOptions.dietaryRestrictions.map((option) => option.label),
	);
	const allergenOptions = $derived(
		getOptionRows(suggestedAllergenLabels, allergens),
	);
	const restrictionOptions = $derived(
		getOptionRows(suggestedRestrictionLabels, dietaryRestrictions),
	);
	const savedPreferenceSummary = $derived([
		incomingFoodPreferenceValues.unitSystem
			? {
					label: "Units",
					value: incomingFoodPreferenceValues.unitSystem === "us" ? "US units" : "Metric",
				}
			: null,
		incomingFoodPreferenceValues.defaultSmoothieServingSize
			? {
					label: "Serving",
					value: `${incomingFoodPreferenceValues.defaultSmoothieServingSize}${incomingFoodPreferenceValues.defaultSmoothieServingUnit}`,
				}
			: null,
		incomingFoodPreferenceValues.allergens.length
			? { label: "Allergens", value: incomingFoodPreferenceValues.allergens.join(", ") }
			: null,
		incomingFoodPreferenceValues.dietaryRestrictions.length
			? {
					label: "Dietary restrictions",
					value: incomingFoodPreferenceValues.dietaryRestrictions.join(", "),
				}
			: null,
		priorityNutrientLabels.length
			? { label: "Priority nutrients", value: priorityNutrientLabels.join(", ") }
			: null,
	].filter((item) => item !== null));
	let profilePending = $state(false);
	let avatarPending = $state(false);
	let foodPreferencesPending = $state(false);
	const foodPreferencesDisabled = $derived(
		foodPreferencesPending || data.foodPreferencesUnavailable,
	);
	const enhanceProfile = createPendingSubmit(
		(pending) => (profilePending = pending),
	);
	const enhanceAvatar = createPendingSubmit(
		(pending) => (avatarPending = pending),
	);
	const enhanceFoodPreferences = createPendingSubmit(
		(pending) => (foodPreferencesPending = pending),
		async (result) => {
			if (result.type !== "success") return;
			if (!result.data?.foodPreferencesSuccess) return;
			await invalidateAll();
		},
	);
</script>

<svelte:head>
	<title>{formatDocumentTitle("Profile")}</title>
	<meta name="description" content={`Manage your optional ${APP_NAME} profile details.`} />
</svelte:head>

<div class="profile-page">
	<header class="profile-heading">
		<p class="profile-heading__eyebrow">Account</p>
		<h1>Your profile</h1>
		<p>Your profile is optional. Your login works without completing it.</p>
	</header>

	<section class="profile-card profile-card--identity">
		<CircularMediaFrame class="avatar-preview" label="Current profile image">
			{#if data.avatarUrl}
				<img src={data.avatarUrl} alt={data.profile?.avatar_alt_text ?? "Your profile"} />
			{:else}
				<User class="avatar-preview__icon" />
			{/if}
		</CircularMediaFrame>
		<div>
			<strong>{data.profile?.display_name ?? data.defaultDisplayName}</strong>
			<span>Preferred name</span>
		</div>
	</section>

	<section class="profile-card profile-card--help">
		<div class="profile-card__heading">
			<h2>Help &amp; tutorial</h2>
			<p>Replay the quick tour whenever you want a refresher.</p>
		</div>
		<RoundedActionLink href="/profile/tutorial">Open quick tutorial</RoundedActionLink>
	</section>

	<section class="profile-card">
		<div class="profile-card__heading">
			<h2>Profile details</h2>
			<p>Add only what you want other profile features to use later.</p>
		</div>

		{#if form?.profileError}
			<p class="form-message form-message--error" role="alert">{form.profileError}</p>
		{:else if form?.profileSuccess}
			<p class="form-message form-message--success" role="status">{form.profileSuccess}</p>
		{/if}

		<form method="POST" action="?/saveProfile" use:enhance={enhanceProfile} aria-busy={profilePending}>
			<label for="profile-display-name">Preferred name</label>
			<input
				id="profile-display-name"
				name="displayName"
				value={profileValues.displayName}
				maxlength="80"
				autocomplete="name"
				placeholder="What should we call you?"
				disabled={profilePending}
			/>
			<small>Use the assigned name or change it to a preferred name. Your email is not shown.</small>

			<label for="profile-bio">Bio</label>
			<textarea
				id="profile-bio"
				name="bio"
				maxlength="300"
				rows="4"
				placeholder="A short note about you"
				disabled={profilePending}
			>{profileValues.bio}</textarea>

			<button class="primary-action" type="submit" disabled={profilePending}>
				{#if profilePending}<LoadingSpinner size="small" decorative />{/if}
				Save profile
			</button>
		</form>
	</section>

	<section class="profile-card">
		<div class="profile-card__heading">
			<h2>Profile image</h2>
			<p>JPEG, PNG, or WebP. Maximum 5 MB. Images remain private to your account.</p>
		</div>

		{#if form?.avatarError}
			<p class="form-message form-message--error" role="alert">{form.avatarError}</p>
		{:else if form?.avatarSuccess}
			<p class="form-message form-message--success" role="status">{form.avatarSuccess}</p>
		{/if}

		<form method="POST" action="?/uploadAvatar" enctype="multipart/form-data" use:enhance={enhanceAvatar} aria-busy={avatarPending}>
			<PhotoUploadInput
				id="profile-avatar"
				name="avatar"
				prompt="Profile photo"
				description="Choose a JPEG, PNG, or WebP portrait up to 5 MB."
				photoCount={1}
				required
				disabled={avatarPending}
			/>

			<label for="profile-avatar-alt">Image description</label>
			<input
				id="profile-avatar-alt"
				name="avatarAltText"
				maxlength="160"
				value={data.profile?.avatar_alt_text ?? ""}
				placeholder="Example: Dylan smiling"
				disabled={avatarPending}
			/>

			<fieldset class="avatar-policy">
				<legend>Profile image rules</legend>
				<details class="avatar-policy__details">
					<summary>
						<span>Review image rules</span>
						<span class="avatar-policy__chevron" aria-hidden="true">⌄</span>
					</summary>
					<ul>
						{#each data.avatarPolicyItems as item}
							<li>{item}</li>
						{/each}
					</ul>
				</details>
				<label class="check-row">
					<input type="checkbox" name="avatarPolicyAccepted" required disabled={avatarPending} />
					<span>I confirm this image follows the profile image rules. My agreement and upload details will be recorded.</span>
				</label>
				{#if data.requireHumanFace}
					<label class="check-row">
						<input type="checkbox" name="avatarHasHumanFace" required disabled={avatarPending} />
						<span>I confirm this image contains a recognizable human face.</span>
					</label>
				{/if}
			</fieldset>

			<div class="form-actions">
				<button class="primary-action" type="submit" disabled={avatarPending}>
					{#if avatarPending}<LoadingSpinner size="small" decorative />{/if}
					Upload image
				</button>
				{#if data.profile?.avatar_path}
					<button class="secondary-action" type="submit" formaction="?/removeAvatar" formnovalidate disabled={avatarPending}>
						{#if avatarPending}<LoadingSpinner size="small" decorative />{/if}
						Remove image
					</button>
				{/if}
			</div>
		</form>
	</section>

	<section class="profile-card">
		<div class="profile-card__heading">
			<h2>Food safety &amp; dietary restrictions</h2>
			<p>Optional settings for safer suggestions and smoother mix planning.</p>
		</div>

		<div class="sensitive-notice">
			<strong>Optional, but important.</strong>
			<span>
				Allergens, dietary restrictions, and nutrient priorities can be
				health-related. If you save them, the app treats them as important
				warnings.
			</span>
		</div>

		{#if form?.foodPreferencesError}
			<p class="form-message form-message--error" role="alert">{form.foodPreferencesError}</p>
		{:else if form?.foodPreferencesSuccess}
			<p class="form-message form-message--success" role="status">{form.foodPreferencesSuccess}</p>
		{/if}
		{#if data.foodPreferencesUnavailable}
			<p class="form-message form-message--warning" role="status">
				Food preference storage is waiting on the latest database migration. Profile details and images still work.
			</p>
		{/if}
		{#if savedPreferenceSummary.length}
			<div class="saved-preferences" aria-label="Saved food preferences">
				<strong>Saved settings</strong>
				<div class="saved-preferences__grid">
					{#each savedPreferenceSummary as item}
						<div class="saved-preferences__item">
							<span>{item.label}</span>
							<p>{item.value}</p>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<form
			method="POST"
			action="?/saveFoodPreferences"
			use:enhance={enhanceFoodPreferences}
			aria-busy={foodPreferencesPending}
		>
			<div class="preference-grid">
				<label>
					<span>Preferred units</span>
					<select
						name="unitSystem"
						value={incomingFoodPreferenceValues.unitSystem}
						disabled={foodPreferencesDisabled}
					>
						<option value="">No preference</option>
						<option value="metric">Metric</option>
						<option value="us">US units</option>
					</select>
				</label>

				<label>
					<span>Default smoothie serving size</span>
					<div class="inline-fields">
						<NumberInput
							name="defaultSmoothieServingSize"
							class="profile-serving-size-input"
							min="0"
							step="0.1"
							value={incomingFoodPreferenceValues.defaultSmoothieServingSize}
							placeholder="Optional"
							disabled={foodPreferencesDisabled}
						/>
						<select
							name="defaultSmoothieServingUnit"
							value={incomingFoodPreferenceValues.defaultSmoothieServingUnit}
							disabled={foodPreferencesDisabled}
						>
							<option value="g">g</option>
							<option value="oz">oz</option>
						</select>
					</div>
				</label>
			</div>

			<input type="hidden" name="allergens" value={allergens.join(", ")} />
			<input
				type="hidden"
				name="dietaryRestrictions"
				value={dietaryRestrictions.join(", ")}
			/>

			<div class="preference-editor-grid">
				<FoodPreferencePicker
					title={preferenceGroupMeta.allergens.title}
					helper={preferenceGroupMeta.allergens.helper}
					searchLabel={preferenceGroupMeta.allergens.searchLabel}
					selectLabel={preferenceGroupMeta.allergens.selectLabel}
					selectedValues={allergens}
					selectValue={getPreferenceSelect("allergens")}
					searchValue={getPreferenceSearch("allergens")}
					availableOptions={getAvailableOptions("allergens")}
					filteredOptions={getFilteredOptions("allergens")}
					disabled={foodPreferencesDisabled}
					emptyLabel="No allergens saved."
					onAdd={(value) => addPreferenceValue("allergens", value)}
					onRemove={(value) => removePreferenceValue("allergens", value)}
					onSearchChange={(value) => setPreferenceSearch("allergens", value)}
					onSelectChange={(value) => setPreferenceSelect("allergens", value)}
				/>

				<FoodPreferencePicker
					title={preferenceGroupMeta.dietaryRestrictions.title}
					helper={preferenceGroupMeta.dietaryRestrictions.helper}
					searchLabel={preferenceGroupMeta.dietaryRestrictions.searchLabel}
					selectLabel={preferenceGroupMeta.dietaryRestrictions.selectLabel}
					selectedValues={dietaryRestrictions}
					selectValue={getPreferenceSelect("dietaryRestrictions")}
					searchValue={getPreferenceSearch("dietaryRestrictions")}
					availableOptions={getAvailableOptions("dietaryRestrictions")}
					filteredOptions={getFilteredOptions("dietaryRestrictions")}
					disabled={foodPreferencesDisabled}
					emptyLabel="No restrictions saved."
					onAdd={(value) => addPreferenceValue("dietaryRestrictions", value)}
					onRemove={(value) =>
						removePreferenceValue("dietaryRestrictions", value)}
					onSearchChange={(value) =>
						setPreferenceSearch("dietaryRestrictions", value)}
					onSelectChange={(value) =>
						setPreferenceSelect("dietaryRestrictions", value)}
				/>
			</div>

			<fieldset class="nutrient-priorities">
				<legend>Preferred nutrients</legend>
				<div class="priority-options">
					{#each data.priorityNutrientOptions as nutrient}
						<label class="check-row">
							<input
								type="checkbox"
								name="prioritizedNutrientIds"
								value={nutrient.id}
								checked={incomingFoodPreferenceValues.prioritizedNutrientIds.includes(nutrient.id)}
								disabled={foodPreferencesDisabled}
							/>
							<span>{nutrient.label}</span>
						</label>
					{/each}
				</div>
			</fieldset>

			<label class="check-row">
				<input
					type="checkbox"
					name="sensitiveAcknowledged"
					checked={incomingFoodPreferenceValues.sensitiveAcknowledged}
					disabled={foodPreferencesDisabled}
				/>
				<span>I understand these optional preferences may affect warnings and suggestion ranking.</span>
			</label>

			<button class="primary-action" type="submit" disabled={foodPreferencesDisabled}>
				{#if foodPreferencesPending}<LoadingSpinner size="small" decorative />{/if}
				Save food preferences
			</button>
		</form>
	</section>
</div>

<style lang="scss">
	@use "./page.scss";
</style>
