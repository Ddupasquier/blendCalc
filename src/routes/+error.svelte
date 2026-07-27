<script lang="ts">
	import { page } from "$app/state";
	import AppError from "$lib/components/app/AppError/AppError.svelte";
	import {
		getAppIssueMessage,
		getAppIssueTitle,
		getDefaultAppIssueCode,
		isAppIssueCode,
		normalizeAppIssueParams,
	} from "$lib/utils/errors/appIssues";

	const issue = $derived.by(() => {
		const code = isAppIssueCode(page.error?.code)
			? page.error.code
			: getDefaultAppIssueCode(page.status);
		const params = normalizeAppIssueParams(page.error?.params);
		return {
			title: getAppIssueTitle(code),
			message: getAppIssueMessage(code, params),
		};
	});
</script>

<AppError
	status={page.status}
	title={issue.title}
	message={issue.message}
/>
