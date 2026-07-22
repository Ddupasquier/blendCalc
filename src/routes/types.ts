import type { Snippet } from "svelte";
import type { LayoutData, PageData } from "./$types";

export type AppLayoutProps = {
	children: Snippet;
	data: LayoutData;
};

export type LandingPageProps = {
	data: PageData;
};
