export const saveTutorialCompletion = async () => {
	const response = await fetch("/api/tutorial-preference", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ choice: "complete" }),
	});
	return response.ok;
};
