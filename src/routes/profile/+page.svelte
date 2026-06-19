<script lang="ts">
	import { enhance } from "$app/forms";
	import PillRow from "$lib/components/common/PillRow.svelte";
	import { userFoodPreferences } from "$lib/stores/userFoodPreferences";
	import {
		getServingSizeDisplayValue,
		type DefaultServingUnit,
	} from "$lib/utils/profile/foodPreferences";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import type { ActionData, PageData } from "./$types";

	let {
		data,
		form,
	}: {
		data: PageData;
		form: ActionData;
	} = $props();

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
		foodPreferences:
			form?.foodPreferenceValues?.foodPreferences ??
			data.foodPreferences?.dislikes ??
			[],
		allergens:
			form?.foodPreferenceValues?.allergens ??
			data.foodPreferences?.allergens ??
			[],
		dietaryRestrictions:
			form?.foodPreferenceValues?.dietaryRestrictions ??
			data.foodPreferences?.dietaryRestrictions ??
			[],
		ingredientsToAvoid:
			form?.foodPreferenceValues?.ingredientsToAvoid ??
			data.foodPreferences?.ingredientsToAvoid ??
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

	let dislikes = $state<string[]>([]);
	let allergens = $state<string[]>([]);
	let dietaryRestrictions = $state<string[]>([]);
	let ingredientsToAvoid = $state<string[]>([]);
	let lastPreferenceSeed = "";
	const preferenceSeed = $derived(
		JSON.stringify({
			foodPreferences: incomingFoodPreferenceValues.foodPreferences,
			allergens: incomingFoodPreferenceValues.allergens,
			dietaryRestrictions: incomingFoodPreferenceValues.dietaryRestrictions,
			ingredientsToAvoid: incomingFoodPreferenceValues.ingredientsToAvoid,
		}),
	);

	$effect(() => {
		const seed = preferenceSeed;
		if (seed === lastPreferenceSeed) return;
		lastPreferenceSeed = seed;
		dislikes = [...incomingFoodPreferenceValues.foodPreferences];
		allergens = [...incomingFoodPreferenceValues.allergens];
		dietaryRestrictions = [...incomingFoodPreferenceValues.dietaryRestrictions];
		ingredientsToAvoid = [...incomingFoodPreferenceValues.ingredientsToAvoid];
	});

	type PreferenceGroupKey =
		| "foodPreferences"
		| "allergens"
		| "dietaryRestrictions"
		| "ingredientsToAvoid";

	const preferenceGroupMeta: Record<
		PreferenceGroupKey,
		{ title: string; helper: string; searchLabel: string }
	> = {
		foodPreferences: {
			title: "Dislikes",
			helper: "Down-ranks suggestions, but does not block them.",
			searchLabel: "Search or add dislikes",
		},
		allergens: {
			title: "Allergens",
			helper: "Adds warnings when metadata suggests a conflict.",
			searchLabel: "Search or add allergens",
		},
		dietaryRestrictions: {
			title: "Dietary restrictions",
			helper: "Warns on possible conflicts. It never prevents adding an item.",
			searchLabel: "Search or add restrictions",
		},
		ingredientsToAvoid: {
			title: "Ingredients to avoid",
			helper: "Adds warnings and also pushes those items lower in suggestions.",
			searchLabel: "Search or add ingredients",
		},
	};
	let preferenceSearch = $state<Record<PreferenceGroupKey, string>>({
		foodPreferences: "",
		allergens: "",
		dietaryRestrictions: "",
		ingredientsToAvoid: "",
	});

	const readPreferenceGroup = (group: PreferenceGroupKey) => {
		switch (group) {
			case "foodPreferences":
				return dislikes;
			case "allergens":
				return allergens;
			case "dietaryRestrictions":
				return dietaryRestrictions;
			case "ingredientsToAvoid":
				return ingredientsToAvoid;
		}
	};

	const writePreferenceGroup = (group: PreferenceGroupKey, nextValues: string[]) => {
		const uniqueValues = uniquePreferenceValues(nextValues);
		switch (group) {
			case "foodPreferences":
				dislikes = uniqueValues;
				return;
			case "allergens":
				allergens = uniqueValues;
				return;
			case "dietaryRestrictions":
				dietaryRestrictions = uniqueValues;
				return;
			case "ingredientsToAvoid":
				ingredientsToAvoid = uniqueValues;
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
			case "foodPreferences":
				return dislikeOptions;
			case "allergens":
				return allergenOptions;
			case "dietaryRestrictions":
				return restrictionOptions;
			case "ingredientsToAvoid":
				return avoidOptions;
		}
	};

	const getFilteredOptions = (group: PreferenceGroupKey) => {
		const query = normalizePreferenceValue(getPreferenceSearch(group));
		const selected = new Set(readPreferenceGroup(group).map(normalizePreferenceValue));
		return getOptionPool(group).filter((option) => {
			const normalizedOption = normalizePreferenceValue(option);
			if (selected.has(normalizedOption)) return false;
			if (!query) return true;
			return normalizedOption.includes(query);
		});
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
	};

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
	const suggestedIngredientLabels = $derived(
		data.foodPreferenceOptions.ingredients.map((option) => option.label),
	);
	const dislikeOptions = $derived(
		getOptionRows(suggestedIngredientLabels, dislikes),
	);
	const allergenOptions = $derived(
		getOptionRows(suggestedAllergenLabels, allergens),
	);
	const restrictionOptions = $derived(
		getOptionRows(suggestedRestrictionLabels, dietaryRestrictions),
	);
	const avoidOptions = $derived(
		getOptionRows(suggestedIngredientLabels, ingredientsToAvoid),
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
		incomingFoodPreferenceValues.foodPreferences.length
			? {
					label: "Dislikes",
					value: incomingFoodPreferenceValues.foodPreferences.join(", "),
				}
			: null,
		incomingFoodPreferenceValues.allergens.length
			? { label: "Allergens", value: incomingFoodPreferenceValues.allergens.join(", ") }
			: null,
		incomingFoodPreferenceValues.dietaryRestrictions.length
			? {
					label: "Restrictions",
					value: incomingFoodPreferenceValues.dietaryRestrictions.join(", "),
				}
			: null,
		incomingFoodPreferenceValues.ingredientsToAvoid.length
			? {
					label: "Avoid",
					value: incomingFoodPreferenceValues.ingredientsToAvoid.join(", "),
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
	);

	let lastSavedFoodPreferencesSnapshot = "";
	$effect(() => {
		const savedProfile = form?.savedFoodPreferencesProfile;
		if (!savedProfile || !form?.foodPreferencesSuccess) return;

		const snapshot = JSON.stringify(savedProfile);
		if (snapshot === lastSavedFoodPreferencesSnapshot) return;

		lastSavedFoodPreferencesSnapshot = snapshot;
		userFoodPreferences.set(savedProfile);
	});
</script>

<svelte:head>
	<title>Profile · Smoothie Mixer</title>
	<meta name="description" content="Manage your optional Smoothie Mixer profile details." />
</svelte:head>

<div class="profile-page">
	<header class="profile-heading">
		<p class="profile-heading__eyebrow">Account</p>
		<h1>Your profile</h1>
		<p>Your profile is optional. Your login works without completing it.</p>
	</header>

	<section class="profile-card profile-card--identity">
		<div class="avatar-preview" aria-label="Current profile image">
			{#if data.avatarUrl}
				<img src={data.avatarUrl} alt={data.profile?.avatar_alt_text ?? "Your profile"} />
			{:else}
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />
				</svg>
			{/if}
		</div>
		<div>
			<strong>{data.profile?.display_name ?? data.defaultDisplayName}</strong>
			<span>Preferred name</span>
		</div>
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
				{profilePending ? "Saving profile…" : "Save profile"}
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
			<label for="profile-avatar">Choose image</label>
			<input
				id="profile-avatar"
				name="avatar"
				type="file"
				accept="image/jpeg,image/png,image/webp"
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
					{avatarPending ? "Saving image…" : "Upload image"}
				</button>
				{#if data.profile?.avatar_path}
					<button class="secondary-action" type="submit" formaction="?/removeAvatar" formnovalidate disabled={avatarPending}>
						{avatarPending ? "Working…" : "Remove image"}
					</button>
				{/if}
			</div>
		</form>
	</section>

	<section class="profile-card">
		<div class="profile-card__heading">
			<h2>Food preferences</h2>
			<p>Optional settings for safer suggestions and smoother mix planning.</p>
		</div>

		<div class="sensitive-notice">
			<strong>Optional, but important.</strong>
			<span>
				Allergens, restrictions, avoid lists, and nutrient priorities can be health-related.
				If you save them, the app treats them as important warnings.
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
						<input
							name="defaultSmoothieServingSize"
							type="number"
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

			<input type="hidden" name="foodPreferences" value={dislikes.join(", ")} />
			<input type="hidden" name="allergens" value={allergens.join(", ")} />
			<input
				type="hidden"
				name="dietaryRestrictions"
				value={dietaryRestrictions.join(", ")}
			/>
			<input
				type="hidden"
				name="ingredientsToAvoid"
				value={ingredientsToAvoid.join(", ")}
			/>

			<div class="preference-editor-grid">
				<section class="preference-editor-card">
					<div class="preference-editor-card__heading">
						<div>
							<h3>{preferenceGroupMeta.foodPreferences.title}</h3>
							<p>{preferenceGroupMeta.foodPreferences.helper}</p>
						</div>
					</div>
					<label class="preference-search">
						<span>{preferenceGroupMeta.foodPreferences.searchLabel}</span>
						<div class="preference-search__controls">
							<input
								type="search"
								value={getPreferenceSearch("foodPreferences")}
								placeholder="Search catalog or add your own"
								disabled={foodPreferencesDisabled}
								oninput={(event) =>
									setPreferenceSearch(
										"foodPreferences",
										(event.currentTarget as HTMLInputElement).value,
									)}
								onkeydown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault();
										addPreferenceValue(
											"foodPreferences",
											getPreferenceSearch("foodPreferences"),
										);
									}
								}}
							/>
							<button
								type="button"
								class="search-add"
								disabled={
									foodPreferencesDisabled ||
									!getPreferenceSearch("foodPreferences").trim()
								}
								onclick={() =>
									addPreferenceValue(
										"foodPreferences",
										getPreferenceSearch("foodPreferences"),
									)}
							>
								Add
							</button>
						</div>
					</label>
					{#if getFilteredOptions("foodPreferences").length}
						<PillRow
							pills={getFilteredOptions("foodPreferences")}
							onSelect={(index) =>
								addPreferenceValue(
									"foodPreferences",
									getFilteredOptions("foodPreferences")[index],
								)}
							removable={false}
						/>
					{/if}
					{#if dislikes.length}
						<PillRow
							pills={dislikes}
							onRemove={(index) =>
								removePreferenceValue("foodPreferences", dislikes[index])}
							preserveOrder
						/>
					{:else}
						<p class="preference-empty">No dislikes saved.</p>
					{/if}
				</section>

				<section class="preference-editor-card">
					<div class="preference-editor-card__heading">
						<div>
							<h3>{preferenceGroupMeta.allergens.title}</h3>
							<p>{preferenceGroupMeta.allergens.helper}</p>
						</div>
					</div>
					<label class="preference-search">
						<span>{preferenceGroupMeta.allergens.searchLabel}</span>
						<div class="preference-search__controls">
							<input
								type="search"
								value={getPreferenceSearch("allergens")}
								placeholder="Search catalog or add your own"
								disabled={foodPreferencesDisabled}
								oninput={(event) =>
									setPreferenceSearch(
										"allergens",
										(event.currentTarget as HTMLInputElement).value,
									)}
								onkeydown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault();
										addPreferenceValue(
											"allergens",
											getPreferenceSearch("allergens"),
										);
									}
								}}
							/>
							<button
								type="button"
								class="search-add"
								disabled={
									foodPreferencesDisabled ||
									!getPreferenceSearch("allergens").trim()
								}
								onclick={() =>
									addPreferenceValue(
										"allergens",
										getPreferenceSearch("allergens"),
									)}
							>
								Add
							</button>
						</div>
					</label>
					{#if getFilteredOptions("allergens").length}
						<PillRow
							pills={getFilteredOptions("allergens")}
							onSelect={(index) =>
								addPreferenceValue(
									"allergens",
									getFilteredOptions("allergens")[index],
								)}
							removable={false}
						/>
					{/if}
					{#if allergens.length}
						<PillRow
							pills={allergens}
							onRemove={(index) =>
								removePreferenceValue("allergens", allergens[index])}
							preserveOrder
						/>
					{:else}
						<p class="preference-empty">No allergens saved.</p>
					{/if}
				</section>

				<section class="preference-editor-card">
					<div class="preference-editor-card__heading">
						<div>
							<h3>{preferenceGroupMeta.dietaryRestrictions.title}</h3>
							<p>{preferenceGroupMeta.dietaryRestrictions.helper}</p>
						</div>
					</div>
					<label class="preference-search">
						<span>{preferenceGroupMeta.dietaryRestrictions.searchLabel}</span>
						<div class="preference-search__controls">
							<input
								type="search"
								value={getPreferenceSearch("dietaryRestrictions")}
								placeholder="Search catalog or add your own"
								disabled={foodPreferencesDisabled}
								oninput={(event) =>
									setPreferenceSearch(
										"dietaryRestrictions",
										(event.currentTarget as HTMLInputElement).value,
									)}
								onkeydown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault();
										addPreferenceValue(
											"dietaryRestrictions",
											getPreferenceSearch("dietaryRestrictions"),
										);
									}
								}}
							/>
							<button
								type="button"
								class="search-add"
								disabled={
									foodPreferencesDisabled ||
									!getPreferenceSearch("dietaryRestrictions").trim()
								}
								onclick={() =>
									addPreferenceValue(
										"dietaryRestrictions",
										getPreferenceSearch("dietaryRestrictions"),
									)}
							>
								Add
							</button>
						</div>
					</label>
					{#if getFilteredOptions("dietaryRestrictions").length}
						<PillRow
							pills={getFilteredOptions("dietaryRestrictions")}
							onSelect={(index) =>
								addPreferenceValue(
									"dietaryRestrictions",
									getFilteredOptions("dietaryRestrictions")[index],
								)}
							removable={false}
						/>
					{/if}
					{#if dietaryRestrictions.length}
						<PillRow
							pills={dietaryRestrictions}
							onRemove={(index) =>
								removePreferenceValue(
									"dietaryRestrictions",
									dietaryRestrictions[index],
								)}
							preserveOrder
						/>
					{:else}
						<p class="preference-empty">No restrictions saved.</p>
					{/if}
				</section>

				<section class="preference-editor-card">
					<div class="preference-editor-card__heading">
						<div>
							<h3>{preferenceGroupMeta.ingredientsToAvoid.title}</h3>
							<p>{preferenceGroupMeta.ingredientsToAvoid.helper}</p>
						</div>
					</div>
					<label class="preference-search">
						<span>{preferenceGroupMeta.ingredientsToAvoid.searchLabel}</span>
						<div class="preference-search__controls">
							<input
								type="search"
								value={getPreferenceSearch("ingredientsToAvoid")}
								placeholder="Search catalog or add your own"
								disabled={foodPreferencesDisabled}
								oninput={(event) =>
									setPreferenceSearch(
										"ingredientsToAvoid",
										(event.currentTarget as HTMLInputElement).value,
									)}
								onkeydown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault();
										addPreferenceValue(
											"ingredientsToAvoid",
											getPreferenceSearch("ingredientsToAvoid"),
										);
									}
								}}
							/>
							<button
								type="button"
								class="search-add"
								disabled={
									foodPreferencesDisabled ||
									!getPreferenceSearch("ingredientsToAvoid").trim()
								}
								onclick={() =>
									addPreferenceValue(
										"ingredientsToAvoid",
										getPreferenceSearch("ingredientsToAvoid"),
									)}
							>
								Add
							</button>
						</div>
					</label>
					{#if getFilteredOptions("ingredientsToAvoid").length}
						<PillRow
							pills={getFilteredOptions("ingredientsToAvoid")}
							onSelect={(index) =>
								addPreferenceValue(
									"ingredientsToAvoid",
									getFilteredOptions("ingredientsToAvoid")[index],
								)}
							removable={false}
						/>
					{/if}
					{#if ingredientsToAvoid.length}
						<PillRow
							pills={ingredientsToAvoid}
							onRemove={(index) =>
								removePreferenceValue(
									"ingredientsToAvoid",
									ingredientsToAvoid[index],
								)}
							preserveOrder
						/>
					{:else}
						<p class="preference-empty">No avoided ingredients saved.</p>
					{/if}
				</section>
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
				{foodPreferencesPending ? "Saving preferences…" : "Save food preferences"}
			</button>
		</form>
	</section>
</div>

<style lang="scss">
	@use "../../styles/variables" as *;

	.profile-page {
		display: grid;
		gap: $app-gap-md;
	}

	.profile-heading {
		display: grid;
		gap: $app-gap-xs;

		h1 {
			font-family: $app-font-family-display;
			font-size: clamp(1.65rem, 6vw, 2.2rem);
			letter-spacing: -0.035em;
		}

		p:last-child {
			color: $app-muted;
			font-size: $app-font-size-md;
		}
	}

	.profile-heading__eyebrow {
		color: $app-muted;
		font-size: $app-font-size-xs;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.profile-card {
		display: grid;
		gap: $app-gap-md;
		padding: $app-gap-md;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;

		form {
			display: grid;
			gap: $app-gap-sm;
		}

		label,
		legend {
			color: $app-primary;
			font-size: $app-font-size-md;
			font-weight: 800;
		}

		input:not([type="checkbox"]),
		textarea,
		select {
			width: 100%;
			padding: 0.65rem 0.75rem;
			color: $app-primary;
			background: $app-bg;
			border: $app-border;
			border-radius: $app-radius-sm;
			font: inherit;
		}

		input[type="file"] {
			font-size: $app-font-size-sm;
		}

		small {
			color: $app-muted;
			font-size: $app-font-size-sm;
		}
	}

	.sensitive-notice {
		display: grid;
		gap: $app-gap-xs;
		padding: $app-gap-sm;
		color: $app-warning-text;
		background: $app-warning-bg;
		border: $app-warning-border;
		border-radius: $app-radius-sm;
		font-size: $app-font-size-sm;
	}

	.saved-preferences {
		display: grid;
		gap: $app-gap-sm;
		padding: $app-gap-sm;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-radius-sm;

		> strong {
			color: $app-primary;
			font-size: $app-font-size-md;
		}
	}

	.saved-preferences__grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: $app-gap-xs;
	}

	.saved-preferences__item {
		min-width: 0;
		padding: $app-gap-xs;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-radius-sm;

		span {
			display: block;
			margin-bottom: 0.1rem;
			color: $app-muted;
			font-size: $app-font-size-xs;
			font-weight: 900;
			letter-spacing: 0.05em;
			text-transform: uppercase;
		}

		p {
			color: $app-primary;
			font-size: $app-font-size-sm;
			font-weight: 800;
			overflow-wrap: anywhere;
		}
	}

	.preference-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: $app-gap-sm;

		label {
			display: grid;
			gap: $app-gap-xs;
		}
	}

	.inline-fields {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 5rem;
		gap: $app-gap-xs;
	}

	.preference-editor-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: $app-gap-sm;
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

	.preference-search {
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

	.nutrient-priorities {
		display: grid;
		gap: $app-gap-sm;
		padding: $app-gap-sm;
		border: $app-border;
		border-radius: $app-radius-sm;
	}

	.priority-options {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: $app-gap-xs $app-gap-sm;
	}

	.profile-card--identity {
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;

		div:last-child {
			display: grid;
			min-width: 0;
		}

		strong,
		span {
			overflow-wrap: anywhere;
		}

		span {
			color: $app-muted;
			font-size: $app-font-size-sm;
		}
	}

	.avatar-preview {
		display: grid;
		place-items: center;
		width: 4.5rem;
		height: 4.5rem;
		overflow: hidden;
		color: $app-primary;
		background: $app-accent;
		border: $app-border;
		border-radius: 50%;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}

		svg {
			width: 55%;
			fill: none;
			stroke: currentColor;
			stroke-linecap: round;
			stroke-linejoin: round;
			stroke-width: 1.8;
		}
	}

	.profile-card__heading {
		display: grid;
		gap: $app-gap-xs;

		h2 {
			font-size: $app-font-size-xl;
		}

		p {
			color: $app-muted;
			font-size: $app-font-size-sm;
		}
	}

	.avatar-policy {
		display: grid;
		gap: $app-gap-sm;
		margin-top: $app-gap-xs;
		padding: $app-gap-sm;
		border: $app-border;
		border-radius: $app-radius-sm;
	}

	.avatar-policy__details {
		min-width: 0;
		padding: $app-gap-sm;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-radius-sm;

		summary {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: $app-gap-sm;
			color: $app-primary;
			font-size: $app-font-size-sm;
			font-weight: 800;
			cursor: pointer;
			list-style: none;

			&::-webkit-details-marker {
				display: none;
			}
		}

		ul {
			display: grid;
			gap: 0.15rem;
			margin-top: $app-gap-sm;
			padding-left: 1.15rem;
			color: $app-muted;
			font-size: $app-font-size-sm;
		}

		&[open] .avatar-policy__chevron {
			transform: rotate(180deg);
		}
	}

	.avatar-policy__chevron {
		font-size: $app-font-size-lg;
		line-height: 1;
		transition: transform 160ms ease;
	}

	.check-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: $app-gap-sm;
		align-items: start;

		input {
			margin-top: 0.2rem;
		}
	}

	.form-actions {
		display: flex;
		flex-wrap: wrap;
		gap: $app-gap-sm;
	}

	.primary-action,
	.secondary-action {
		width: fit-content;
		font-family: $app-button-font-family;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
	}

	.primary-action {
		color: $app-btn-text;
		background: $app-btn-bg;

		&:hover {
			background: $app-btn-bg-hover;
		}
	}

	.secondary-action {
		color: $app-primary;
		background: $app-accent;
	}

	.form-message {
		padding: $app-gap-sm;
		border-radius: $app-radius-sm;
		font-size: $app-font-size-sm;
		font-weight: 800;
	}

	.form-message--error {
		background: $app-danger-bg;
	}

	.form-message--success {
		background: $app-success-bg;
	}

	.form-message--warning {
		color: $app-warning-text;
		background: $app-warning-bg;
		border: $app-warning-border;
	}

	@media (max-width: $app-breakpoint-xs) {
		.preference-grid,
		.preference-editor-grid,
		.priority-options,
		.saved-preferences__grid {
			grid-template-columns: 1fr;
		}

		.form-actions button {
			flex: 1 1 100%;
			width: 100%;
		}
	}
</style>
