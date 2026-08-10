import type { ActionData, PageData } from "./$types";

export type AuthMode = "signIn" | "signUp";

export type AuthPageProps = {
	data: PageData;
	form: ActionData;
};
