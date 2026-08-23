import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";

export const load: PageServerLoad = () => {
	throw redirect(308, "/profile/privileged-tools");
};
