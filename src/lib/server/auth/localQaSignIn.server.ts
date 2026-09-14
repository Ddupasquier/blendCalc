import { env as privateEnvironment } from "$env/dynamic/private";
import { env as publicEnvironment } from "$env/dynamic/public";
import { Buffer } from "node:buffer";

const LOCAL_TEST_APP_PORT = "5174";
const LOCAL_TEST_SUPABASE_PORT = "54321";
const LOCAL_REHEARSAL_APP_PORT = "5175";
const LOCAL_REHEARSAL_SUPABASE_PORT = "58321";
const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const LOCAL_QA_BROWSER_PROJECTS = new Set([
	"desktop-chromium",
	"desktop-firefox",
	"desktop-webkit",
	"mobile-chromium",
	"mobile-webkit",
]);

type LocalQaRuntimeInput = {
	appUrl: URL;
	runtimeEnvironment?: string;
	supabaseUrl?: string;
	password?: string;
	accountsBase64?: string;
	rehearsalEmail?: string;
	rehearsalPassword?: string;
};

export type LocalQaSignInAccount = {
	key: string;
	displayName: string;
	email: string;
	role: string;
	purpose: string;
};

export type LocalQaSignInPageData = {
	accounts: LocalQaSignInAccount[];
	experience: "qa" | "rehearsal";
};

const parseUrl = (value: string | undefined) => {
	if (!value) return null;
	try {
		return new URL(value);
	} catch {
		return null;
	}
};

const isExactLocalEndpoint = (url: URL | null, port: string) =>
	Boolean(
		url &&
		url.protocol === "http:" &&
		LOCAL_HOSTNAMES.has(url.hostname) &&
		url.port === port,
	);

const isBoundedText = (value: unknown, maximumLength: number) =>
	typeof value === "string" &&
	value.length > 0 &&
	value.length <= maximumLength;

const parseAccounts = (value: string | undefined) => {
	if (!value) return null;
	try {
		const parsed = JSON.parse(
			Buffer.from(value, "base64").toString("utf8"),
		) as unknown;
		if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 25) {
			return null;
		}
		const accounts = parsed.filter(
			(account): account is LocalQaSignInAccount =>
				typeof account === "object" &&
				account !== null &&
				isBoundedText((account as LocalQaSignInAccount).key, 80) &&
				isBoundedText((account as LocalQaSignInAccount).displayName, 120) &&
				isBoundedText((account as LocalQaSignInAccount).email, 180) &&
				(account as LocalQaSignInAccount).email.endsWith("@blendcalc.local") &&
				isBoundedText((account as LocalQaSignInAccount).role, 40) &&
				isBoundedText((account as LocalQaSignInAccount).purpose, 240),
		);
		if (accounts.length !== parsed.length) return null;
		if (new Set(accounts.map(({ key }) => key)).size !== accounts.length) {
			return null;
		}
		return accounts;
	} catch {
		return null;
	}
};

const resolveRuntime = ({
	appUrl,
	runtimeEnvironment = privateEnvironment.BLENDCALC_RUNTIME_ENVIRONMENT,
	supabaseUrl = publicEnvironment.PUBLIC_SUPABASE_URL,
	password = privateEnvironment.BLENDCALC_TEST_ACCOUNT_PASSWORD,
	accountsBase64 = privateEnvironment.BLENDCALC_TEST_ACCOUNTS_BASE64,
	rehearsalEmail = privateEnvironment.BLENDCALC_REHEARSAL_ACCOUNT_EMAIL,
	rehearsalPassword = privateEnvironment.BLENDCALC_REHEARSAL_ACCOUNT_PASSWORD,
}: LocalQaRuntimeInput) => {
	const accounts = parseAccounts(accountsBase64);
	const normalizedRehearsalEmail = rehearsalEmail ?? "";
	const normalizedRehearsalPassword = rehearsalPassword ?? "";
	const isTestRuntime =
		runtimeEnvironment === "test" &&
		isExactLocalEndpoint(appUrl, LOCAL_TEST_APP_PORT) &&
		isExactLocalEndpoint(parseUrl(supabaseUrl), LOCAL_TEST_SUPABASE_PORT) &&
		Boolean(password) &&
		Boolean(accounts);
	const isRehearsalRuntime =
		runtimeEnvironment === "rehearsal" &&
		isExactLocalEndpoint(appUrl, LOCAL_REHEARSAL_APP_PORT) &&
		isExactLocalEndpoint(
			parseUrl(supabaseUrl),
			LOCAL_REHEARSAL_SUPABASE_PORT,
		) &&
		isBoundedText(normalizedRehearsalEmail, 180) &&
		normalizedRehearsalEmail.endsWith("@blendcalc.local") &&
		isBoundedText(normalizedRehearsalPassword, 240);
	const rehearsalAccounts: LocalQaSignInAccount[] = isRehearsalRuntime
		? [
				{
					key: "rehearsalDeveloper",
					displayName: "Owner snapshot",
					email: normalizedRehearsalEmail,
					role: "developer",
					purpose: "Your production-shaped data in the isolated local sandbox",
				},
			]
		: [];
	return {
		enabled: isTestRuntime || isRehearsalRuntime,
		experience: isRehearsalRuntime ? ("rehearsal" as const) : ("qa" as const),
		accounts: isRehearsalRuntime ? rehearsalAccounts : (accounts ?? []),
		password: isRehearsalRuntime
			? normalizedRehearsalPassword
			: (password ?? ""),
	};
};

export const getLocalQaSignInPageData = (
	input: LocalQaRuntimeInput,
): LocalQaSignInPageData | null => {
	const runtime = resolveRuntime(input);
	return runtime.enabled
		? {
				experience: runtime.experience,
				accounts: runtime.accounts.map((account) => ({ ...account })),
			}
		: null;
};

export const getLocalQaSignInCredentials = (
	accountKey: string,
	input: LocalQaRuntimeInput,
) => {
	const runtime = resolveRuntime(input);
	if (!runtime.enabled) return null;
	const account = runtime.accounts.find(({ key }) => key === accountKey);
	if (!account) return null;
	return { email: account.email, password: runtime.password };
};

export const getLocalQaBrowserRateLimitClientAddress = (
	browserPartition: string | null,
	input: LocalQaRuntimeInput,
) => {
	const runtime = resolveRuntime(input);
	if (!runtime.enabled || runtime.experience !== "qa") return null;
	const [accountKey, projectName, ...unexpectedParts] =
		browserPartition?.split("|") ?? [];
	if (
		unexpectedParts.length > 0 ||
		!accountKey ||
		!projectName ||
		!LOCAL_QA_BROWSER_PROJECTS.has(projectName)
	) {
		return null;
	}
	const account = runtime.accounts.find(({ key }) => key === accountKey);
	return account ? `local-qa-browser:${projectName}:${account.key}` : null;
};
