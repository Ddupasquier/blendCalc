const LOCAL_SUPABASE_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1"]);

export const getLocalSupabaseAuthCookieName = (
	supabaseUrl: string,
): string | undefined => {
	const url = new URL(supabaseUrl);
	if (!LOCAL_SUPABASE_HOSTNAMES.has(url.hostname)) return undefined;

	const port = url.port || (url.protocol === "https:" ? "443" : "80");
	return `blendcalc-local-${port}-auth-token`;
};
