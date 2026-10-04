// Runs before styles paint; no inline script and no application cookies or account state.
(() => {
	let theme = "system";
	try {
		const saved = localStorage.getItem("blendcalc-docs-theme");
		if (["light", "dark", "system"].includes(saved)) theme = saved;
	} catch {
		/* Reading preferences is optional in restricted browsers. */
	}
	const dark =
		theme === "dark" ||
		(theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
	document.documentElement.dataset.theme = dark ? "dark" : "light";
	document.documentElement.dataset.preference = theme;
	document.querySelector('meta[name="theme-color"]').content = dark
		? "#11141c"
		: "#f8f8fb";
})();
