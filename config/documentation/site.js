const themeToggle = document.querySelector(".theme-toggle");
const media = matchMedia("(prefers-color-scheme: dark)");
const applyTheme = (preference) => {
	const dark =
		preference === "dark" || (preference === "system" && media.matches);
	document.documentElement.dataset.theme = dark ? "dark" : "light";
	document.documentElement.dataset.preference = preference;
	document.querySelector('meta[name="theme-color"]').content = dark
		? "#11141c"
		: "#f8f8fb";
	themeToggle.setAttribute(
		"aria-label",
		`Color theme: ${preference}. Change theme`,
	);
	themeToggle.title = `Color theme: ${preference} (click for ${preference === "system" ? "light" : preference === "light" ? "dark" : "system"})`;
};
applyTheme(document.documentElement.dataset.preference);
themeToggle.addEventListener("click", () => {
	const current = document.documentElement.dataset.preference;
	const next =
		current === "system" ? "light" : current === "light" ? "dark" : "system";
	try {
		localStorage.setItem("blendcalc-docs-theme", next);
	} catch {
		/* Theme still works without persistence. */
	}
	applyTheme(next);
});
media.addEventListener("change", () =>
	applyTheme(document.documentElement.dataset.preference),
);

const openDialog = (dialog, trigger) => {
	if (document.querySelector("dialog[open]")) return;
	dialog.showModal();
	document.body.classList.add("modal-open");
	dialog.addEventListener(
		"close",
		() => {
			document.body.classList.remove("modal-open");
			trigger.focus();
		},
		{ once: true },
	);
};
for (const dialog of document.querySelectorAll("dialog")) {
	dialog
		.querySelector("[data-close]")
		.addEventListener("click", () => dialog.close());
	dialog.addEventListener("click", (event) => {
		if (event.target !== dialog) return;
		const rectangle = dialog.getBoundingClientRect();
		if (
			event.clientX < rectangle.left ||
			event.clientX > rectangle.right ||
			event.clientY < rectangle.top ||
			event.clientY > rectangle.bottom
		)
			dialog.close();
	});
}
const menuToggle = document.querySelector(".menu-toggle");
const drawer = document.querySelector(".mobile-drawer");
menuToggle.addEventListener("click", () => openDialog(drawer, menuToggle));
matchMedia("(min-width: 1024px)").addEventListener("change", (event) => {
	if (event.matches && drawer.open) drawer.close();
});

for (const button of document.querySelectorAll(".copy-button")) {
	button.addEventListener("click", async () => {
		const block = button.closest(".code-block");
		const code = block.querySelector("code");
		const status = block.querySelector(".copy-status");
		try {
			if (!navigator.clipboard?.writeText)
				throw new Error("Clipboard unavailable");
			await navigator.clipboard.writeText(code.textContent);
			button.textContent = "Copied!";
			status.textContent = "Code copied to clipboard.";
		} catch {
			const selection = window.getSelection();
			const range = document.createRange();
			range.selectNodeContents(code);
			selection.removeAllRanges();
			selection.addRange(range);
			status.classList.remove("sr-only");
			status.textContent =
				"Copy isn’t available here. The code is selected; press Ctrl+C or ⌘C to copy it.";
		}
	});
}

const searchDialog = document.querySelector(".search-dialog");
const searchTrigger = document.querySelector(".search-trigger");
const searchInput = document.querySelector("#docs-search");
const results = document.querySelector("#docs-search-results");
const searchStatus = document.querySelector("#docs-search-status");
let searchIndex;
let loading;
const normalize = (value) =>
	value
		.normalize("NFKD")
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
const updateResults = () => {
	results.replaceChildren();
	const words = normalize(searchInput.value).split(/\s+/).filter(Boolean);
	if (!words.length) {
		searchStatus.textContent =
			"Search pages and sections. Your query stays in this browser.";
		return;
	}
	const matches = searchIndex
		.map((entry) => {
			const title = normalize(entry.title);
			const text = normalize(`${entry.title} ${entry.section} ${entry.text}`);
			return {
				entry,
				score: words.every((word) => text.includes(word))
					? words.reduce(
							(score, word) => score + (title.includes(word) ? 5 : 1),
							0,
						)
					: 0,
			};
		})
		.filter(({ score }) => score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, 20);
	searchStatus.textContent = matches.length
		? `${matches.length} result${matches.length === 1 ? "" : "s"}${matches.length === 20 ? " (showing the first 20)" : ""}.`
		: "No results yet. Try a shorter phrase, such as “profile” or “database”.";
	for (const { entry } of matches) {
		const link = document.createElement("a");
		link.className = "search-result";
		link.href = entry.url;
		const title = document.createElement("strong");
		title.textContent = entry.title;
		const section = document.createElement("span");
		section.textContent = entry.section;
		const excerpt = document.createElement("p");
		const firstWord = words[0];
		const start = Math.max(
			0,
			entry.text.toLocaleLowerCase().indexOf(firstWord) - 45,
		);
		excerpt.textContent = `${start ? "…" : ""}${entry.text.slice(start, start + 170)}${entry.text.length > start + 170 ? "…" : ""}`;
		link.append(title, section, excerpt);
		link.addEventListener("click", () => searchDialog.close());
		results.append(link);
	}
};
const showSearch = async () => {
	openDialog(searchDialog, searchTrigger);
	searchInput.focus();
	if (!searchIndex) {
		searchStatus.textContent = "Loading the documentation index…";
		try {
			loading ??= fetch(`${document.body.dataset.base}search-index.json`).then(
				(response) => {
					if (!response.ok) throw new Error("Search index unavailable");
					return response.json();
				},
			);
			searchIndex = await loading;
		} catch {
			loading = undefined;
			searchStatus.textContent =
				"Search couldn’t load. Close and reopen to retry, or use the documentation menu.";
			return;
		}
	}
	updateResults();
};
searchTrigger.addEventListener("click", showSearch);
searchInput.addEventListener("input", () => {
	if (searchIndex) updateResults();
});
searchInput.addEventListener("keydown", (event) => {
	if (event.key === "ArrowDown") {
		event.preventDefault();
		results.querySelector("a")?.focus();
	}
});
document.addEventListener("keydown", (event) => {
	if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
		event.preventDefault();
		if (!document.querySelector("dialog[open]")) showSearch();
	}
});
