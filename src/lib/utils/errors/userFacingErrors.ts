const NETWORK_ERROR_PATTERNS = [
	/failed to fetch/iu,
	/load failed/iu,
	/network(?:error| request failed)/iu,
	/err_(?:connection|network|internet)/iu,
	/connection (?:refused|lost|closed)/iu,
];

const TIMEOUT_ERROR_PATTERNS = [
	/timed? ?out/iu,
	/timeout/iu,
];

export type UserFacingErrorMessages = {
	fallback: string;
	network?: string;
	timeout?: string;
};

export class UserFacingError extends Error {
	code?: AppIssueCode;
	params?: AppIssueParams;

	constructor(message: string, cause?: unknown) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "UserFacingError";
	}
}

export const createUserFacingIssueError = (
	code: AppIssueCode,
	params?: AppIssueParams,
	cause?: unknown,
) => {
	const userError = new UserFacingError(getAppIssueMessage(code, params), cause);
	userError.code = code;
	userError.params = normalizeAppIssueParams(params);
	return userError;
};

export const readAppIssuePayload = (
	value: unknown,
): AppIssuePayload | null => {
	if (value === null || typeof value !== "object") return null;
	const body = value as { code?: unknown; params?: unknown };
	if (!isAppIssueCode(body.code)) return null;
	return createAppIssuePayload(body.code, normalizeAppIssueParams(body.params));
};

export const createUserFacingErrorFromResponse = async (
	response: Response,
	fallbackCode: AppIssueCode,
	fallbackParams?: AppIssueParams,
) => {
	const body = await response.json().catch(() => null);
	const issue = readAppIssuePayload(body) ??
		createAppIssuePayload(fallbackCode, fallbackParams);
	return createUserFacingIssueError(issue.code, issue.params);
};

const readErrorString = (error: unknown, key: "name" | "message") => {
	if (error === null || typeof error !== "object") return "";
	const value = Reflect.get(error, key);
	return typeof value === "string" ? value.trim() : "";
};

const getErrorName = (error: unknown) => readErrorString(error, "name");

const getErrorMessage = (error: unknown) => readErrorString(error, "message");

const matchesAny = (value: string, patterns: RegExp[]) =>
	patterns.some((pattern) => pattern.test(value));

export const isAbortError = (error: unknown) =>
	getErrorName(error) === "AbortError";

export const getUserFacingErrorMessage = (
	error: unknown,
	messages: UserFacingErrorMessages,
) => {
	if (error instanceof UserFacingError) return error.message;

	const message = getErrorMessage(error);
	if (
		getErrorName(error) === "TimeoutError" ||
		matchesAny(message, TIMEOUT_ERROR_PATTERNS)
	) {
		return messages.timeout ?? messages.network ?? messages.fallback;
	}
	if (matchesAny(message, NETWORK_ERROR_PATTERNS)) {
		return messages.network ?? messages.fallback;
	}
	return messages.fallback;
};
import {
	createAppIssuePayload,
	getAppIssueMessage,
	isAppIssueCode,
	normalizeAppIssueParams,
	type AppIssueCode,
	type AppIssueParams,
	type AppIssuePayload,
} from "./appIssues";
