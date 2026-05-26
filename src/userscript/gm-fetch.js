/**
 * Shared GM_xmlhttpRequest wrapper — used by mcp-push.js and mcp-section.js.
 */
export function gmFetch(
	url,
	{ method = "GET", headers = {}, body = undefined, timeoutMs = 1500 } = {},
) {
	return new Promise((resolve, reject) => {
		if (typeof GM_xmlhttpRequest === "undefined") {
			reject(new Error("GM_xmlhttpRequest unavailable"));
			return;
		}
		GM_xmlhttpRequest({
			method,
			url,
			headers,
			data: body,
			timeout: timeoutMs,
			onload: (r) => resolve(r),
			onerror: () => reject(new Error("network error")),
			ontimeout: () => reject(new Error("timeout")),
		});
	});
}
