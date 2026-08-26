import type {
	FullConfig,
	FullResult,
	Reporter,
	TestCase,
	TestResult,
} from "@playwright/test/reporter";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type CompletedTestTiming = {
	durationMilliseconds: number;
	file: string;
	project: string;
	retry: number;
	status: string;
	title: string;
};

const durationBudgetMilliseconds = Number.parseInt(
	process.env.PLAYWRIGHT_TEST_BUDGET_MS ?? "45000",
	10,
);
const enforceDurationBudget =
	process.env.PLAYWRIGHT_ENFORCE_DURATION_BUDGETS === "true";
const reportPath = resolve(
	process.env.PLAYWRIGHT_SLOW_TEST_REPORT ??
		"test-results/playwright-slow-tests.json",
);

class SlowTestReporter implements Reporter {
	private completedTests: CompletedTestTiming[] = [];

	onBegin(_config: FullConfig) {
		if (
			!Number.isInteger(durationBudgetMilliseconds) ||
			durationBudgetMilliseconds < 1
		) {
			throw new Error("PLAYWRIGHT_TEST_BUDGET_MS must be a positive integer.");
		}
	}

	onTestEnd(test: TestCase, result: TestResult) {
		if (result.status === "skipped") return;
		this.completedTests.push({
			durationMilliseconds: result.duration,
			file: test.location.file,
			project: test.parent.project()?.name ?? "unknown",
			retry: result.retry,
			status: result.status,
			title: test.titlePath().slice(1).join(" › "),
		});
	}

	async onEnd(result: FullResult) {
		const slowestTests = [...this.completedTests].sort(
			(left, right) => right.durationMilliseconds - left.durationMilliseconds,
		);
		const budgetViolations = slowestTests.filter(
			(test) =>
				test.status === "passed" &&
				test.durationMilliseconds > durationBudgetMilliseconds,
		);
		await mkdir(dirname(reportPath), { recursive: true });
		await writeFile(
			reportPath,
			`${JSON.stringify(
				{
					budgetMilliseconds: durationBudgetMilliseconds,
					budgetViolationCount: budgetViolations.length,
					generatedAt: new Date().toISOString(),
					runStatus: result.status,
					slowestTests: slowestTests.slice(0, 25),
				},
				null,
				2,
			)}\n`,
		);

		if (budgetViolations.length > 0) {
			const summary = budgetViolations
				.slice(0, 10)
				.map(
					(test) =>
						`${(test.durationMilliseconds / 1_000).toFixed(1)}s ${test.project} › ${test.title}`,
				)
				.join("\n");
			console.warn(
				`\n${budgetViolations.length} Playwright test${budgetViolations.length === 1 ? "" : "s"} exceeded the ${(durationBudgetMilliseconds / 1_000).toFixed(0)}s duration budget:\n${summary}\nFull report: ${reportPath}`,
			);
		}

		if (enforceDurationBudget && budgetViolations.length > 0) {
			return { status: "failed" as const };
		}
	}
}

export default SlowTestReporter;
