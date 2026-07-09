/**
 * DOM Fixture Factory for Userscript Testing
 * 
 * Provides reusable DOM structures that mimic the Claude.ai usage page
 * for testing render.js and lifecycle.js functionality.
 */

import { BUCKET_MAP } from '../../src/userscript/constants.js';

/**
 * Creates a basic usage row DOM structure matching Claude.ai's actual DOM
 */
export function createUsageRow(title: string, utilization: number, label: string): HTMLElement {
	const row = document.createElement('div');
	row.className = 'usage-row';
	
	// Title element
	const titleSpan = document.createElement('span');
	titleSpan.textContent = title;
	row.appendChild(titleSpan);
	
	// Progress container
	const progressContainer = document.createElement('div');
	progressContainer.className = 'flex items-center gap-2';
	
	// Bar wrapper
	const barWrapper = document.createElement('div');
	barWrapper.className = 'flex-1';
	
	// Progress bar (role="meter")
	const bar = document.createElement('div');
	bar.setAttribute('role', 'meter');
	bar.style.width = `${utilization}%`;
	bar.style.height = '8px';
	bar.style.background = '#f0f0f0';
	bar.style.borderRadius = '4px';
	bar.style.overflow = 'hidden';
	
	// Fill div
	const fill = document.createElement('div');
	fill.style.width = '100%';
	fill.style.height = '100%';
	fill.style.background = 'var(--color-progress)';
	bar.appendChild(fill);
	
	barWrapper.appendChild(bar);
	progressContainer.appendChild(barWrapper);
	
	// Used label (text-right)
	const usedLabel = document.createElement('span');
	usedLabel.className = 'text-right';
	usedLabel.textContent = label;
	progressContainer.appendChild(usedLabel);
	
	row.appendChild(progressContainer);
	
	return row;
}

/**
 * Creates a complete usage section with all known buckets
 */
export function createUsageSection(): HTMLElement {
	const section = document.createElement('section');
	
	// Heading
	const h2 = document.createElement('h2');
	h2.textContent = 'Plan usage limits';
	section.appendChild(h2);
	
	// Create rows for each bucket
	for (const [key, meta] of Object.entries(BUCKET_MAP)) {
		const row = createUsageRow(meta.title, 50, '50% used');
		section.appendChild(row);
	}
	
	return section;
}

/**
 * Creates a minimal page structure with usage section using Happy-DOM
 */
export function createPageWithUsage(): { doc: Document; window: any } {
	const { Window } = require('happy-dom');
	const window = new Window();
	const doc = window.document;
	
	// Create basic page structure
	const html = doc.createElement('html');
	const head = doc.createElement('head');
	doc.documentElement.appendChild(head);
	
	const body = doc.createElement('body');
	doc.documentElement.appendChild(body);
	
	// Add usage section
	const section = createUsageSection.call(document, section);
	body.appendChild(section);
	
	// Set global references
	globalThis.window = window;
	globalThis.document = doc;
	globalThis.history = window.history;
	globalThis.location = window.location;
	
	return { doc, window };
}

/**
 * Creates a DOM structure ready for render.js testing
 * This includes:
 * - A full usage section with all bucket rows
 * - All necessary global objects (window, history, location)
 */
export function createRenderFixture(): {
	doc: Document;
	window: any;
	section: HTMLElement;
	rows: Map<string, HTMLElement>;
} {
	const { doc, window } = createPageWithUsage();
	const section = doc.querySelector('section')!;
	const rows = new Map<string, HTMLElement>();
	
	// Cache row references by title
	const usageRows = Array.from(section.querySelectorAll('.usage-row'));
	for (const [key, meta] of Object.entries(BUCKET_MAP)) {
		const row = usageRows.find(
			(row) => row.querySelector('span')?.textContent === meta.title
		);
		if (row) {
			rows.set(key, row);
		}
	}
	
	return { doc, window, section, rows };
}

/**
 * Mocks GM_xmlhttpRequest for testing
 */
export function mockGMXmlHttpRequest(): void {
	globalThis.GM_xmlhttpRequest = (() => {
		let mockResponses: Array<{ status: number; responseText: string }> = [];
		
		return (options: any) => {
			// Simulate async response
			setTimeout(() => {
				const mock = mockResponses[0];
				if (mock) {
					if (options.onload) {
						options.onload({
							status: mock.status,
							responseText: mock.responseText,
						});
					}
				}
			}, 10);
			
			return {
				abort: () => {},
			};
		};
	})();
}

/**
 * Resets the DOM to a clean state for each test
 */
export function resetDOM(): void {
	if (globalThis.document && globalThis.document.body) {
		globalThis.document.body.innerHTML = '';
	}
}

/**
 * Helper to verify marker was added correctly
 */
export function findMarkerInRow(row: HTMLElement): HTMLElement | null {
	const bar = row.querySelector('[role="meter"]');
	if (!bar) return null;
	
	const barWrapper = bar.parentElement;
	if (!barWrapper) return null;
	
	return barWrapper.querySelector('.__claude-pace-marker') || null;
}

/**
 * Helper to verify pill was added correctly
 */
export function findPillInRow(row: HTMLElement): HTMLElement | null {
	const progressContainer = row.querySelector('.flex.items-center');
	if (!progressContainer) return null;
	
	return progressContainer.querySelector('.__claude-pace-pill') || null;
}

/**
 * Helper to verify bar gradient was applied
 */
export function getBarGradient(row: HTMLElement): string | null {
	const bar = row.querySelector('[role="meter"]');
	if (!bar) return null;
	
	return (bar as HTMLElement).style.background || null;
}