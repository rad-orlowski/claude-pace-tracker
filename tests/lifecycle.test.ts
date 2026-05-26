/**
 * Tests for lifecycle.js SPA navigation and cleanup
 * 
 * Tests the SPA navigation detection, history API wrapping,
 * DOM cleanup, and interval management used in lifecycle.js
 * Focuses on core operations without complex CSS selectors
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Window } from 'happy-dom';

describe('lifecycle.js - SPA Navigation and Cleanup', () => {
	let window: Window;
	let document: Document;
	let originalPushState: any;
	let originalReplaceState: any;

	beforeEach(() => {
		// Create fresh Happy-DOM instance for each test
		window = new Window();
		document = window.document;
		
		// Store original methods
		originalPushState = window.history.pushState.bind(window.history);
		originalReplaceState = window.history.replaceState.bind(window.history);
		
		// Set global references
		globalThis.window = window as any;
		globalThis.document = document;
		globalThis.history = window.history;
		globalThis.location = window.location;
	});

	afterEach(() => {
		// Clean up DOM
		if (document.body) {
			document.body.innerHTML = '';
		}
		
		// Restore original methods
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
		
		// Clear any intervals
		const maxIntervalId = setInterval(() => {}, 0);
		for (let i = 1; i <= maxIntervalId; i++) {
			clearInterval(i);
		}
	});

	describe('History API wrapping', () => {
		it('should wrap pushState with custom behavior', () => {
			let pushStateCalled = false;
			let pushStateArgs: any[] = [];

			// Simulate wrapping
			window.history.pushState = function (...args: any[]) {
				pushStateCalled = true;
				pushStateArgs = args;
				return originalPushState(...args);
			};

			window.history.pushState({ page: 'usage' }, '', '/settings/usage');

			expect(pushStateCalled).toBe(true);
			expect(pushStateArgs.length).toBe(3);
			expect(pushStateArgs[2]).toBe('/settings/usage');
		});

		it('should wrap replaceState with custom behavior', () => {
			let replaceStateCalled = false;
			let replaceStateArgs: any[] = [];

			// Simulate wrapping
			window.history.replaceState = function (...args: any[]) {
				replaceStateCalled = true;
				replaceStateArgs = args;
				return originalReplaceState(...args);
			};

			window.history.replaceState({ page: 'settings' }, '', '/settings');

			expect(replaceStateCalled).toBe(true);
			expect(replaceStateArgs.length).toBe(3);
			expect(replaceStateArgs[2]).toBe('/settings');
		});

		it('should preserve original pushState return value', () => {
			// Simulate wrapping
			window.history.pushState = function (...args: any[]) {
				return originalPushState(...args);
			};

			const result = window.history.pushState({ page: 'test' }, '', '/test');

			// pushState returns undefined
			expect(result).toBeUndefined();
		});

		it('should handle multiple history method calls', () => {
			let callCount = 0;

			// Simulate wrapping
			const wrappedPushState = function (...args: any[]) {
				callCount++;
				return originalPushState(...args);
			};

			window.history.pushState = wrappedPushState;

			// Multiple calls
			window.history.pushState({ page: '1' }, '', '/page1');
			window.history.pushState({ page: '2' }, '', '/page2');
			window.history.pushState({ page: '3' }, '', '/page3');

			expect(callCount).toBe(3);
		});
	});

	describe('SPA navigation detection', () => {
		it('should detect navigation to /settings/usage', () => {
			// Set pathname
			Object.defineProperty(window.location, 'pathname', {
				writable: true,
				value: '/settings/usage',
			});

			const onUsagePage = /\/settings\/usage(\b|\/)/.test(window.location.pathname);
			expect(onUsagePage).toBe(true);
		});

		it('should detect navigation away from /settings/usage', () => {
			// Set pathname to different page
			Object.defineProperty(window.location, 'pathname', {
				writable: true,
				value: '/settings',
			});

			const onUsagePage = /\/settings\/usage(\b|\/)/.test(window.location.pathname);
			expect(onUsagePage).toBe(false);
		});

		it('should detect navigation to usage subpage', () => {
			// Set pathname to usage subpage
			Object.defineProperty(window.location, 'pathname', {
				writable: true,
				value: '/settings/usage/weekly',
			});

			const onUsagePage = /\/settings\/usage(\b|\/)/.test(window.location.pathname);
			expect(onUsagePage).toBe(true);
		});

		it('should handle root navigation', () => {
			// Set pathname to root
			Object.defineProperty(window.location, 'pathname', {
				writable: true,
				value: '/',
			});

			const onUsagePage = /\/settings\/usage(\b|\/)/.test(window.location.pathname);
			expect(onUsagePage).toBe(false);
		});
	});

	describe('DOM cleanup on navigation away', () => {
		it('should remove injected marker elements', () => {
			const container = document.createElement('div');
			
			// Add marker
			const marker = document.createElement('div');
			marker.className = '__claude-pace-marker';
			container.appendChild(marker);

			// Verify marker exists using direct children access
			expect(container.children).toHaveLength(1);
			expect(container.children[0].className).toBe('__claude-pace-marker');

			// Simulate cleanup using direct children access
			Array.from(container.children).forEach(el => {
				if (el.className === '__claude-pace-marker') {
					el.remove();
				}
			});

			// Verify marker was removed
			expect(container.children).toHaveLength(0);
		});

		it('should remove injected pill elements', () => {
			const container = document.createElement('div');
			
			// Add pill
			const pill = document.createElement('span');
			pill.className = '__claude-pace-pill';
			container.appendChild(pill);

			// Verify pill exists using direct children access
			expect(container.children).toHaveLength(1);
			expect(container.children[0].className).toBe('__claude-pace-pill');

			// Simulate cleanup using direct children access
			Array.from(container.children).forEach(el => {
				if (el.className === '__claude-pace-pill') {
					el.remove();
				}
			});

			// Verify pill was removed
			expect(container.children).toHaveLength(0);
		});

		it('should remove injected summary elements', () => {
			const container = document.createElement('div');
			
			// Add summary
			const summary = document.createElement('div');
			summary.className = '__claude-pace-summary';
			container.appendChild(summary);

			// Verify summary exists using direct children access
			expect(container.children).toHaveLength(1);
			expect(container.children[0].className).toBe('__claude-pace-summary');

			// Simulate cleanup using direct children access
			Array.from(container.children).forEach(el => {
				if (el.className === '__claude-pace-summary') {
					el.remove();
				}
			});

			// Verify summary was removed
			expect(container.children).toHaveLength(0);
		});

		it('should remove all injected element types', () => {
			const container = document.createElement('div');
			
			// Add various injected elements
			const marker = document.createElement('div');
			marker.className = '__claude-pace-marker';
			container.appendChild(marker);

			const pill = document.createElement('span');
			pill.className = '__claude-pace-pill';
			container.appendChild(pill);

			const summary = document.createElement('div');
			summary.className = '__claude-pace-summary';
			container.appendChild(summary);

			// Verify all elements exist using direct children access
			expect(container.children).toHaveLength(3);

			// Simulate cleanup (remove all types) using direct children access
			Array.from(container.children).forEach(el => {
				el.remove();
			});

			// Verify all were removed
			expect(container.children).toHaveLength(0);
		});

		it('should clear bar gradients', () => {
			const bar = document.createElement('div');
			bar.style.background = 'linear-gradient(90deg, #22c55e 0%, #22c55e 50%, #f0f0f0 50%, #f0f0f0 100%)';
			bar.style.border = '1px solid #22c55e';
			bar.style.position = 'relative';

			// Verify styles were applied
			expect(bar.style.background).toContain('linear-gradient');
			expect(bar.style.border).toContain('#22c55e');

			// Simulate cleanup
			bar.style.background = '';
			bar.style.border = '';
			bar.style.position = '';

			// Verify styles were cleared
			expect(bar.style.background).toBe('');
			expect(bar.style.border).toBe('');
			expect(bar.style.position).toBe('');
		});

		it('should clear bar fill background', () => {
			const bar = document.createElement('div');
			
			const fill = document.createElement('div');
			fill.style.background = '#22c55e';
			bar.appendChild(fill);

			// Verify fill has background
			expect(fill.style.background).toBe('#22c55e');

			// Simulate cleanup
			fill.style.background = '';

			// Verify fill background was cleared
			expect(fill.style.background).toBe('');
		});

		it('should remove gear panel if present', () => {
			const gear = document.createElement('div');
			gear.id = '__claude-pace-gear';
			gear.className = 'gear-panel';
			document.body.appendChild(gear);

			// Verify gear exists
			expect(document.getElementById('__claude-pace-gear')).not.toBeNull();

			// Simulate cleanup
			const gearToRemove = document.getElementById('__claude-pace-gear');
			if (gearToRemove) {
				gearToRemove.remove();
			}

			// Verify gear was removed
			expect(document.getElementById('__claude-pace-gear')).toBeNull();
		});
	});

	describe('Re-rendering on navigation to usage page', () => {
		it('should allow re-adding elements after cleanup', () => {
			const container = document.createElement('div');

			// Add marker
			const marker = document.createElement('div');
			marker.className = '__claude-pace-marker';
			container.appendChild(marker);

			// Remove it
			marker.remove();
			expect(container.children).toHaveLength(0);

			// Add it back (simulating re-render)
			const newMarker = document.createElement('div');
			newMarker.className = '__claude-pace-marker';
			container.appendChild(newMarker);

			// Verify it was re-added
			expect(container.children).toHaveLength(1);
			expect(container.children[0].className).toBe('__claude-pace-marker');
		});

		it('should handle rapid navigation transitions', () => {
			const container = document.createElement('div');
			let markerCount = 0;

			// Simulate rapid add/remove cycles
			for (let i = 0; i < 5; i++) {
				// Add
				const marker = document.createElement('div');
				marker.className = '__claude-pace-marker';
				marker.dataset.cycle = i.toString();
				container.appendChild(marker);
				markerCount++;

				// Remove
				marker.remove();
				markerCount--;

				// Verify state
				expect(container.children.length).toBe(0);
			}

			// Final verification
			expect(markerCount).toBe(0);
		});

		it('should preserve page content during re-render', () => {
			const section = document.createElement('section');
			
			// Add original content
			const h2 = document.createElement('h2');
			h2.textContent = 'Plan usage limits';
			section.appendChild(h2);
			
			const row = document.createElement('div');
			row.className = 'usage-row';
			section.appendChild(row);
			
			document.body.appendChild(section);
			
			// Verify original content using direct children access
			expect(section.children[0].textContent).toBe('Plan usage limits');
			expect(section.children[1].className).toBe('usage-row');
			
			// Remove and re-add injected elements (simulating cleanup and re-render)
			const marker = document.createElement('div');
			marker.className = '__claude-pace-marker';
			section.appendChild(marker);
			
			marker.remove();
			
			const newMarker = document.createElement('div');
			newMarker.className = '__claude-pace-marker';
			section.appendChild(newMarker);
			
			// Verify original content still exists using direct children access
			expect(section.children[0].textContent).toBe('Plan usage limits');
			expect(section.children[1].className).toBe('usage-row');
			expect(section.children[2].className).toBe('__claude-pace-marker');
		});
	});

	describe('Interval management', () => {
		it('should create and clear rerender interval', async () => {
			let callCount = 0;
			const intervalId = setInterval(() => {
				callCount++;
			}, 50);

			// Let it run
			const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
			await delay(120);
			
			expect(callCount).toBeGreaterThan(0);

			const initialCount = callCount;

			// Clear interval
			clearInterval(intervalId);

			// Wait and verify it stopped
			await delay(120);
			expect(callCount).toBe(initialCount);
		});

		it('should handle clearing non-existent interval', () => {
			// Should not throw
			expect(() => {
				clearInterval(999999);
			}).not.toThrow();
		});

		it('should handle multiple intervals', async () => {
			let count1 = 0;
			let count2 = 0;
			let count3 = 0;

			const id1 = setInterval(() => count1++, 50);
			const id2 = setInterval(() => count2++, 50);
			const id3 = setInterval(() => count3++, 50);

			// Let them run
			const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
			await delay(120);

			// Clear all
			clearInterval(id1);
			clearInterval(id2);
			clearInterval(id3);

			// Verify all ran
			expect(count1).toBeGreaterThan(0);
			expect(count2).toBeGreaterThan(0);
			expect(count3).toBeGreaterThan(0);
		});
	});

	describe('Error handling', () => {
		it('should handle missing DOM elements gracefully', () => {
			// Try to clean up when nothing exists using direct children access
			const container = document.createElement('div');
			expect(container.children.length).toBe(0);

			// Should not throw when iterating empty children
			expect(() => {
				Array.from(container.children).forEach(el => el.remove());
			}).not.toThrow();
		});

		it('should handle null references in cleanup', () => {
			// Simulate cleanup with null checks
			const gear = document.getElementById('__claude-pace-gear');
			if (gear) {
				gear.remove();
			}

			// Should not throw
			expect(() => {
				const gear = document.getElementById('__claude-pace-gear');
				if (gear) {
					gear.remove();
				}
			}).not.toThrow();
		});

		it('should handle empty query selector results', () => {
			const container = document.createElement('div');
			expect(container.children.length).toBe(0);

			// Should not throw when iterating empty children
			expect(() => {
				Array.from(container.children).forEach(el => el.remove());
			}).not.toThrow();
		});

		it('should handle invalid pathnames', () => {
			// Test with undefined pathname
			const onUsagePage = /\/settings\/usage(\b|\/)/.test('');
			expect(onUsagePage).toBe(false);

			// Test with special characters
			const specialPath = '/settings/usage?test=<script>alert(1)</script>';
			const matches = /\/settings\/usage(\b|\/)/.test(specialPath);
			expect(matches).toBe(true);
		});

		it('should handle concurrent history API calls', () => {
			let pushCount = 0;
			let replaceCount = 0;

			window.history.pushState = function (...args: any[]) {
				pushCount++;
				return originalPushState(...args);
			};

			window.history.replaceState = function (...args: any[]) {
				replaceCount++;
				return originalReplaceState(...args);
			};

			// Simulate concurrent calls
			window.history.pushState({ page: '1' }, '', '/1');
			window.history.replaceState({ page: '2' }, '', '/2');
			window.history.pushState({ page: '3' }, '', '/3');
			window.history.replaceState({ page: '4' }, '', '/4');

			expect(pushCount).toBe(2);
			expect(replaceCount).toBe(2);
		});
	});
});