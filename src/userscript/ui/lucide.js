const UW = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

let lucideReady = false;
let lucideLoadPromise = null;

export function isLucideReady() {
	return lucideReady;
}

export function ensureLucide() {
	if (UW.lucide) {
		lucideReady = true;
		return Promise.resolve();
	}
	if (lucideLoadPromise) return lucideLoadPromise;
	lucideLoadPromise = new Promise((resolve, reject) => {
		const s = document.createElement("script");
		s.src = "https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js";
		s.onload = () => {
			lucideReady = true;
			resolve();
		};
		s.onerror = () => reject(new Error("[claude-pace] Lucide CDN load failed"));
		document.head.appendChild(s);
	});
	return lucideLoadPromise;
}

export function makeLucideIcon(name, size = 12) {
	const el = document.createElement("i");
	el.dataset.lucide = name;
	Object.assign(el.style, {
		width: size + "px",
		height: size + "px",
		display: "inline-flex",
		alignItems: "center",
		flexShrink: "0",
	});
	return el;
}

export function renderLucideIcons(container) {
	if (!UW.lucide) return;
	try {
		UW.lucide.createIcons({ nodes: [container] });
	} catch (_) {
		UW.lucide.createIcons();
	}
}
