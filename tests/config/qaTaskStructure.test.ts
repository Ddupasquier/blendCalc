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

const todoQueues = [
	{
		file: "docs/TODO/launch-blocker-todo-tasks.md",
		label: "Launch blockers",
	},
	{
		file: "docs/TODO/before-launch-todo-tasks.md",
		label: "Before launch",
	},
	{
		file: "docs/TODO/post-launch-todo-tasks.md",
		label: "Post-launch",
	},
] as const;

const taskPattern = /^\s*- \[(?<state>[ x])\] \*\*(?<id>QA-\d{3}-\d{3}):\*\*$/;

const readTasks = (file: string) => {
	const lines = readFileSync(file, "utf8").split("\n");
	const tasks: Array<{ body: string; id: string; state: string }> = [];
	for (let index = 0; index < lines.length; index += 1) {
		const match = lines[index].match(taskPattern);
		if (!match?.groups) continue;
		let end = index + 1;
		while (end < lines.length && !taskPattern.test(lines[end])) end += 1;
		tasks.push({
			body: lines.slice(index + 1, end).join("\n"),
			id: match.groups.id,
			state: match.groups.state,
		});
		index = end - 1;
	}
	return tasks;
};

const todoTaskPattern = /^\s*- \[(?<state>[ x])\] \*\*(?<id>TODO-\d{3}-\d{3}):/;

const readTodoTasks = (file: string) => {
	const lines = readFileSync(file, "utf8").split("\n");
	const tasks: Array<{ body: string; id: string; state: string }> = [];
	for (let index = 0; index < lines.length; index += 1) {
		const match = lines[index].match(todoTaskPattern);
		if (!match?.groups) continue;
		let end = index + 1;
		while (end < lines.length && !todoTaskPattern.test(lines[end])) end += 1;
		tasks.push({
			body: lines.slice(index + 1, end).join("\n"),
			id: match.groups.id,
			state: match.groups.state,
		});
		index = end - 1;
	}
	return tasks;
};

const localTrackersAvailable = [
	"docs/QA/qa-tasks.md",
	"docs/QA/completed-qa-tasks.md",
	...activeQueues.map((queue) => queue.file),
	"docs/TODO/todo-tasks.md",
	"docs/TODO/completed-todo-tasks.md",
	...todoQueues.map((queue) => queue.file),
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

const readTodoWorkflowCategories = (file: string) => {
	const source = readFileSync(file, "utf8");
	return source
		.split(/^## /m)
		.slice(1)
		.filter((section) => !section.startsWith("Imported Verification Contract"))
		.map((section) => ({
			name: section.split("\n", 1)[0],
			groups: [...section.matchAll(/^### (TODO-\d{3}) —/gm)].map(
				(match) => match[1],
			),
		}));
};

describe.runIf(localTrackersAvailable)("QA and TODO task structure", () => {
	it("keeps active tasks complete and uniquely owned by one queue", () => {
		const seen = new Set<string>();
		for (const queue of activeQueues) {
			for (const task of readTasks(queue.file)) {
				expect(task.state, `${task.id} is checked inside an active queue`).toBe(" ");
				expect(seen.has(task.id), `${task.id} is duplicated across active queues`).toBe(false);
				seen.add(task.id);
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

	it("keeps each legacy QA group represented once in the TODO transition queue", () => {
		const activeIds = new Set(
			activeQueues.flatMap((queue) => readTasks(queue.file).map((task) => task.id)),
		);
		const referencedIds: string[] = [];
		const seenTodoIds = new Set<string>();

		for (const queue of todoQueues) {
			for (const task of readTodoTasks(queue.file)) {
				expect(task.state, `${task.id} is checked inside an active TODO queue`).toBe(" ");
				expect(seenTodoIds.has(task.id), `${task.id} is duplicated`).toBe(false);
				seenTodoIds.add(task.id);
				expect(task.body, `${task.id} is missing its QA source`).toContain("- Source:");
				const ids = [...task.body.matchAll(/`(QA-\d{3}-\d{3})`/g)].map(
					(match) => match[1],
				);
				expect(ids.length, `${task.id} lists no remaining QA checks`).toBeGreaterThan(0);
				referencedIds.push(...ids);
			}
		}

		expect(new Set(referencedIds).size).toBe(referencedIds.length);
		expect(new Set(referencedIds)).toEqual(activeIds);
	});

	it("keeps the TODO index totals synchronized", () => {
		const index = readFileSync("docs/TODO/todo-tasks.md", "utf8");
		for (const queue of todoQueues) {
			const tasks = readTodoTasks(queue.file);
			const qaChecks = tasks.flatMap((task) => [
				...task.body.matchAll(/`(QA-\d{3}-\d{3})`/g),
			]).length;
			expect(index).toContain(
				`${queue.label}](./${queue.file.split("/").at(-1)}): ${tasks.length} groups, ${tasks.length} active TODOs covering ${qaChecks} remaining QA checks.`,
			);
		}
	});

	it("removes completed TODO groups and empty categories from active queues", () => {
		for (const queue of todoQueues) {
			const activeGroups = new Set(
				readTodoTasks(queue.file).map((task) => task.id.slice(0, 8)),
			);
			const referencedGroups: string[] = [];
			for (const category of readTodoWorkflowCategories(queue.file)) {
				expect(
					category.groups.length,
					`${queue.file} retains empty category ${category.name}`,
				).toBeGreaterThan(0);
				referencedGroups.push(...category.groups);
			}
			expect(new Set(referencedGroups).size).toBe(referencedGroups.length);
			expect(new Set(referencedGroups)).toEqual(activeGroups);
		}
	});

	it("keeps local TODO documentation links valid", () => {
		for (const file of [
			"docs/TODO/todo-tasks.md",
			...todoQueues.map((queue) => queue.file),
			"docs/TODO/completed-todo-tasks.md",
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
