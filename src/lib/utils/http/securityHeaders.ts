const isAuthPath = (pathname: string) => pathname === "/auth" || pathname.startsWith("/auth/");

export const applySecurityHeaders = (
	response: Response,
	url: URL,
	isAuthenticated: boolean,
) => {
	response.headers.set("X-Content-Type-Options", "nosniff");
	response.headers.set("X-Frame-Options", "DENY");
	response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	response.headers.set(
		"Permissions-Policy",
		"camera=(self), microphone=(), geolocation=()",
	);

	if (
		isAuthenticated ||
		isAuthPath(url.pathname) ||
		response.headers.has("set-cookie")
	) {
		response.headers.set("Cache-Control", "private, no-store");
	}

	if (url.protocol === "https:" && url.hostname !== "localhost") {
		response.headers.set(
			"Strict-Transport-Security",
			"max-age=31536000; includeSubDomains",
		);
	}
};
