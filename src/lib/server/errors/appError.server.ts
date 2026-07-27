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
	throw error(status, createAppIssuePayload(code, params));
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
