import { LOG, WARN } from "./log.js";

const USAGE_RE = /\/api\/organizations\/([0-9a-f-]+)\/usage(\?|$)/;

let capturedOrgId = null;

export function getCapturedOrgId() {
	return capturedOrgId;
}

export function getOrgIdFromCookie() {
	const m = document.cookie.match(/(?:^|;\s*)lastActiveOrg=([0-9a-f-]+)/);
	return m ? m[1] : null;
}

export function installCapture(onUsage, onFirstCapture) {
	const UW = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
	if (UW.__claudeUsagePaceFetchPatched) {
		LOG("fetch already patched — skipping");
		return;
	}
	UW.__claudeUsagePaceFetchPatched = true;
	LOG("patching window.fetch");

	const orig = UW.fetch.bind(UW);
	UW.fetch = function (input, init) {
		const p = orig.apply(UW, arguments);
		let url = "";
		try {
			url = typeof input === "string" ? input : (input && input.url) || "";
		} catch (_) {}
		const m = url && USAGE_RE.exec(url);
		if (m) {
			if (!capturedOrgId) {
				capturedOrgId = m[1];
				LOG("captured orgId from fetch:", capturedOrgId);
				onFirstCapture?.();
			}
			p.then((r) => {
				if (!r || !r.ok) {
					WARN("fetch response not OK", r && r.status);
					return;
				}
				return r
					.clone()
					.json()
					.then((d) => onUsage(d));
			}).catch((e) => {
				WARN("failed to read /usage response:", e);
			});
		}
		return p;
	};
}
