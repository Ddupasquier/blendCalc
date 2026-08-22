import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const activeQueues = [
	{
		file: "docs/QA/launch-blocker-qa-tasks.md",
		label: "Launch blockers",
	},
	{
		file: "docs/QA/before-launch-qa-tasks.md",
		label: "Before launch",
	},
	{
		file: "docs/QA/post-launch-qa-tasks.md",
		label: "Post-launch",
	},
] as const;

const taskPattern =
	/^\s*- \[(?<state>[ x])\] \*\*(?<id>QA-\d{3}-\d{3})(?: — (?<title>[^*]+))?:\*\*$/;

const readTasks = (file: string) => {
	const lines = readFileSync(file, "utf8").split("\n");
	const tasks: Array<{ body: string; id: string; state: string; title: string }> = [];
	for (let index = 0; index < lines.length; index += 1) {
		const match = lines[index].match(taskPattern);
		if (!match?.groups) continue;
		let end = index + 1;
		while (end < lines.length && !taskPattern.test(lines[end])) end += 1;
			tasks.push({
				body: lines.slice(index + 1, end).join("\n"),
				id: match.groups.id,
				state: match.groups.state,
				title: match.groups.title?.trim() ?? "",
			});
		index = end - 1;
	}
	return tasks;
};

const localTrackersAvailable = [
	"docs/QA/qa-tasks.md",
	"docs/QA/completed-qa-tasks.md",
	...activeQueues.map((queue) => queue.file),
].every(existsSync);

const readQaWorkflowCategories = (file: string) => {
	const source = readFileSync(file, "utf8");
	const categoryIndex = source
		.split("## Work By Category")[1]
		?.split("## Detailed QA Tasks")[0];
	if (!categoryIndex) return [];
	return categoryIndex
		.split(/^### /m)
		.slice(1)
		.map((section) => ({
			name: section.split("\n", 1)[0],
			groups: [...section.matchAll(/\(#(qa-\d{3})--/g)].map((match) =>
				match[1].toUpperCase(),
			),
		}));
};

describe.runIf(localTrackersAvailable)("QA task structure", () => {
	it("keeps QA as the only task queue", () => {
		expect(existsSync("docs/TODO")).toBe(false);
	});

	it("keeps active tasks complete and uniquely owned by one queue", () => {
		const seen = new Set<string>();
		const seenTitles = new Set<string>();
		for (const queue of activeQueues) {
			for (const task of readTasks(queue.file)) {
				expect(task.state, `${task.id} is checked inside an active queue`).toBe(" ");
				expect(seen.has(task.id), `${task.id} is duplicated across active queues`).toBe(false);
				seen.add(task.id);
				expect(task.title, `${task.id} is missing a descriptive title`).not.toBe("");
				expect(task.title.length, `${task.id} has an overlong title`).toBeLessThanOrEqual(100);
				const normalizedTitle = task.title.toLocaleLowerCase();
				expect(
					seenTitles.has(normalizedTitle),
					`${task.id} duplicates the title ${task.title}`,
				).toBe(false);
				seenTitles.add(normalizedTitle);
				expect(task.body, `${task.id} is missing numbered repro steps`).toMatch(
					/- Repro:\n\s+1\./,
				);
				expect(task.body, `${task.id} is missing example input`).toContain(
					"- Example input:",
				);
				expect(task.body, `${task.id} is missing an expected outcome`).toContain(
					"- Expected:",
				);
			}
		}
	});

	it("links directly accessible routes inside numbered repro steps", () => {
		for (const queue of activeQueues) {
			for (const task of readTasks(queue.file)) {
				const repro = task.body
					.split("- Repro:\n")[1]
					?.split("\n    - Example input:")[0];
				for (const line of repro?.split("\n") ?? []) {
					if (!/^\s+\d+\./.test(line)) continue;
					expect(
						line,
						`${task.id} contains an unlinked static route in its repro`,
					).not.toMatch(/(?<!\[)`\/[^`\s{}<>]*`/);
				}
			}
		}
	});

	it("keeps active and completed task IDs disjoint", () => {
		const active = new Set(
			activeQueues.flatMap((queue) => readTasks(queue.file).map((task) => task.id)),
		);
		const completed = readTasks("docs/QA/completed-qa-tasks.md");
		for (const task of completed) {
			expect(task.state, `${task.id} is not checked in the completed archive`).toBe("x");
			expect(active.has(task.id), `${task.id} is both active and completed`).toBe(false);
		}
	});

	it("removes closed QA groups and empty workflow categories from active queues", () => {
		for (const queue of activeQueues) {
			const activeGroups = new Set(
				readTasks(queue.file).map((task) => task.id.slice(0, 6)),
			);
			const referencedGroups: string[] = [];
			for (const category of readQaWorkflowCategories(queue.file)) {
				expect(
					category.groups.length,
					`${queue.file} retains empty category ${category.name}`,
				).toBeGreaterThan(0);
				for (const group of category.groups) {
					expect(
						activeGroups.has(group),
						`${queue.file} links closed or missing ${group} from ${category.name}`,
					).toBe(true);
					referencedGroups.push(group);
				}
			}
			expect(new Set(referencedGroups).size).toBe(referencedGroups.length);
			expect(new Set(referencedGroups)).toEqual(activeGroups);
		}
	});

	it("keeps the QA index task totals synchronized", () => {
		const index = readFileSync("docs/QA/qa-tasks.md", "utf8");
		for (const queue of activeQueues) {
			const total = readTasks(queue.file).length;
			expect(index).toContain(`${queue.label}](./${queue.file.split("/").at(-1)}):`);
			expect(index).toMatch(
				new RegExp(`${queue.label.replace("-", "\\-")}\\]\\([^)]*\\): \\d+ groups, ${total} active tasks\\.`),
			);
		}

		const completedTotal = readTasks("docs/QA/completed-qa-tasks.md").length;
		expect(index).toContain(`Completed QA tasks](./completed-qa-tasks.md): ${completedTotal} completed tasks.`);
	});

	it("keeps local QA documentation links valid", () => {
		for (const file of [
			"docs/QA/qa-tasks.md",
			...activeQueues.map((queue) => queue.file),
			"docs/QA/completed-qa-tasks.md",
		]) {
			const source = readFileSync(file, "utf8");
			for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
				const target = match[1].split("#")[0];
				if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
				const resolved = resolve(dirname(file), decodeURIComponent(target));
				expect(existsSync(resolved), `${file} links to missing ${target}`).toBe(true);
			}
		}
	});
});
