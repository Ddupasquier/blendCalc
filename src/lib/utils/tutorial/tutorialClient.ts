import type { TutorialChoice } from "./tutorial";

export const saveTutorialChoice = async (choice: TutorialChoice) => {
	const response = await fetch("/api/tutorial-preference", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ choice }),
	});
	return response.ok;
};
