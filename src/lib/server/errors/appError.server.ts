import {
	createAppIssuePayload,
	type AppIssueCode,
	type AppIssueParams,
} from "$lib/utils/errors/appIssues";
import { error, json } from "@sveltejs/kit";

export const throwAppError = (
	status: number,
	code: AppIssueCode,
	params?: AppIssueParams,
): never => {
	const { message, ...properties } = createAppIssuePayload(code, params);
	throw error(status, message, properties);
};

export const requireAppValue = <Value>(
	value: Value,
	status: number,
	code: AppIssueCode,
	params?: AppIssueParams,
): NonNullable<Value> => {
	if (value === null || value === undefined) {
		throwAppError(status, code, params);
	}
	return value as NonNullable<Value>;
};

export const appIssueJson = (
	status: number,
	code: AppIssueCode,
	params?: AppIssueParams,
) => json(createAppIssuePayload(code, params), { status });
