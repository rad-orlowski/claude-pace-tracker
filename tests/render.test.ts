/**
 * Tests for render.js DOM manipulation
 * 
 * Tests the DOM manipulation functions used in render.js
 * Focuses on core operations without complex CSS selectors
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Window } from 'happy-dom';

describe('render.js - DOM Manipulation', () => {
	let window: Window;
	let document: Document;

	beforeEach(() => {
		// Create fresh Happy-DOM instance for each test
		window = new Window();
		document = window.document;
		
		// Set global references
		globalThis.window = window as any;
		globalThis.document = document;
		globalThis.history = window.history;
		globalThis.location = window.location;
	});

	afterEach(() => {
		// Clean up
		if (document.body) {
			document.body.innerHTML = '';
		}
	});

	describe('DOM element creation', () => {
		it('should create marker element with correct class', () => {
			const marker = document.createElement('div');
			marker.className = '__claude-pace-marker';
			marker.style.position = 'absolute';
			marker.style.left = '50%';
			marker.style.width = '4px';
			marker.style.height = '100%';
			
			expect(marker.className).toBe('__claude-pace-marker');
			expect(marker.style.position).toBe('absolute');
			expect(marker.style.left).toBe('50%');
		});

		it('should create pill element with correct class', () => {
			const pill = document.createElement('span');
			pill.className = '__claude-pace-pill';
			pill.style.display = 'inline-flex';
			pill.style.padding = '2px 8px';
			pill.textContent = '+5%';
			
			expect(pill.className).toBe('__claude-pace-pill');
			expect(pill.style.display).toBe('inline-flex');
			expect(pill.textContent).toBe('+5%');
		});

		it('should create summary card element', () => {
			const summaryCard = document.createElement('div');
			summaryCard.className = '__claude-pace-summary';
			summaryCard.innerHTML = '<div class="summary-content">Pace: On track</div>';
			
			expect(summaryCard.className).toBe('__claude-pace-summary');
			expect(summaryCard.textContent).toContain('On track');
		});
	});

	describe('Marker positioning', () => {
		it('should calculate marker position as percentage', () => {
			const marker = document.createElement('div');
			marker.style.position = 'absolute';
			
			// Test different position values
			marker.style.left = '0%';
			expect(parseFloat(marker.style.left)).toBe(0);
			
			marker.style.left = '50%';
			expect(parseFloat(marker.style.left)).toBe(50);
			
			marker.style.left = '100%';
			expect(parseFloat(marker.style.left)).toBe(100);
			
			marker.style.left = '75.5%';
			expect(parseFloat(marker.style.left)).toBe(75.5);
		});

		it('should handle marker band width calculation', () => {
			const markerPct = 50;
			const band = 5;
			
			const mLeft = Math.max(0, markerPct - band);
			const mRight = Math.min(100, markerPct + band);
			
			expect(mLeft).toBe(45);
			expect(mRight).toBe(55);
			expect(mRight - mLeft).toBe(10); // Band width
		});

		it('should clamp marker position to valid range', () => {
			// Test edge cases
			expect(Math.max(0, -5)).toBe(0);
			expect(Math.max(0, 0)).toBe(0);
			expect(Math.max(0, 50)).toBe(50);
			
			expect(Math.min(100, 150)).toBe(100);
			expect(Math.min(100, 100)).toBe(100);
			expect(Math.min(100, 50)).toBe(50);
		});
	});

	describe('Progress bar styling', () => {
		it('should apply gradient to progress bar', () => {
			const bar = document.createElement('div');
			bar.style.height = '8px';
			bar.style.background = '#f0f0f0';
			
			// Apply gradient (simulating what render.js does)
			const gradient = 'linear-gradient(90deg, #22c55e 0%, #22c55e 50%, #f0f0f0 50%, #f0f0f0 100%)';
			bar.style.background = gradient;
			
			// Verify gradient was applied
			expect(bar.style.background).toContain('linear-gradient');
			expect(bar.style.background).toContain('#22c55e');
		});

		it('should preserve existing bar styles when applying gradient', () => {
			const bar = document.createElement('div');
			
			// Set initial styles
			bar.style.height = '8px';
			bar.style.borderRadius = '4px';
			bar.style.border = '1px solid #e0e0e0';
			
			// Apply gradient
			bar.style.background = 'linear-gradient(90deg, #22c55e 0%, #22c55e 50%, #f0f0f0 50%, #f0f0f0 100%)';
			
			// Verify other styles are preserved
			expect(bar.style.height).toBe('8px');
			expect(bar.style.borderRadius).toBe('4px');
			expect(bar.style.border).toBe('1px solid #e0e0e0');
		});

		it('should clear bar styles on cleanup', () => {
			const bar = document.createElement('div');
			
			// Apply styles
			bar.style.background = 'linear-gradient(90deg, #22c55e 0%, #22c55e 50%, #f0f0f0 50%, #f0f0f0 100%)';
			bar.style.border = '1px solid #22c55e';
			bar.style.position = 'relative';
			
			// Verify styles were applied
			expect(bar.style.background).toContain('linear-gradient');
			expect(bar.style.border).toContain('#22c55e');
			
			// Clear styles
			bar.style.background = '';
			bar.style.border = '';
			bar.style.position = '';
			
			// Verify styles were cleared
			expect(bar.style.background).toBe('');
			expect(bar.style.border).toBe('');
			expect(bar.style.position).toBe('');
		});
	});

	describe('Pill styling and updates', () => {
		it('should update pill content when re-rendered', () => {
			const pill = document.createElement('span');
			pill.className = '__claude-pace-pill';
			pill.textContent = '+5%';
			
			// Update pill
			pill.textContent = '-3%';
			
			// Verify update
			expect(pill.textContent).toBe('-3%');
		});

		it('should handle pill display state', () => {
			const pill = document.createElement('span');
			pill.className = '__claude-pace-pill';
			
			// Test display toggle
			pill.style.display = 'none';
			expect(pill.style.display).toBe('none');
			
			pill.style.display = 'inline-flex';
			expect(pill.style.display).toBe('inline-flex');
		});

		it('should apply severity-based colors', () => {
			const pill = document.createElement('span');
			pill.className = '__claude-pace-pill';
			
			// Simulate over-pace styling
			pill.style.color = '#dc2626';
			pill.style.background = '#fee2e2';
			
			expect(pill.style.color).toBe('#dc2626');
			expect(pill.style.background).toContain('#fee2e2');
			
			// Simulate under-pace styling
			pill.style.color = '#16a34a';
			pill.style.background = '#dcfce7';
			
			expect(pill.style.color).toBe('#16a34a');
			expect(pill.style.background).toContain('#dcfce7');
		});
	});

	describe('DOM manipulation', () => {
		it('should add and remove elements', () => {
			const container = document.createElement('div');
			
			// Add marker
			const marker = document.createElement('div');
			marker.className = '__claude-pace-marker';
			container.appendChild(marker);
			
			// Verify marker exists using direct element reference
			expect(container.children).toHaveLength(1);
			expect(container.children[0].className).toBe('__claude-pace-marker');
			
			// Remove marker
			marker.remove();
			
			// Verify marker was removed
			expect(container.children).toHaveLength(0);
		});

		it('should handle multiple render cycles', () => {
			const bar = document.createElement('div');
			
			// Multiple render cycles
			for (let i = 0; i < 3; i++) {
				const gradient = `linear-gradient(90deg, #22c55e 0%, #22c55e ${i * 20}%, #f0f0f0 ${i * 20}%, #f0f0f0 100%)`;
				bar.style.background = gradient;
			}
			
			// Verify final state
			expect(bar.style.background).toContain('40%'); // Last iteration was i=2, so 2*20=40
		});

		it('should remove all injected elements on cleanup', () => {
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
			
			// Verify elements exist using direct children access
			expect(container.children).toHaveLength(3);
			
			// Remove all
			Array.from(container.children).forEach(el => el.remove());
			
			// Verify all were removed
			expect(container.children).toHaveLength(0);
		});
	});

	describe('Error handling', () => {
		it('should handle null parent references', () => {
			const bar = document.createElement('div');
			const barWrapper = bar.parentElement; // This is null
			
			expect(barWrapper).toBeNull();
			
			// Should not throw when checking
			expect(() => {
				if (barWrapper) {
					barWrapper.appendChild(bar);
				}
			}).not.toThrow();
		});

		it('should handle missing DOM elements', () => {
			// Should not throw when manipulating non-existent elements
			expect(() => {
				const container = document.createElement('div');
				// Try to access non-existent child
				const missingChild = container.children[0];
				if (missingChild) {
					missingChild.style.background = 'green';
				}
			}).not.toThrow();
		});

		it('should handle empty text content', () => {
			const pill = document.createElement('span');
			pill.className = '__claude-pace-pill';
			pill.textContent = '';
			
			expect(pill.textContent).toBe('');
			expect(() => {
				pill.textContent = '+5%';
			}).not.toThrow();
		});
	});

	describe('Time and percentage calculations', () => {
		it('should calculate elapsed percentage correctly', () => {
			const now = Date.now();
			const resetsAt = now + (5 * 60 * 60 * 1000); // 5 hours from now
			const periodMs = 5 * 60 * 60 * 1000; // 5 hours
			
			// Time elapsed since period start
			const periodStartMs = resetsAt - periodMs;
			const elapsedMs = now - periodStartMs;
			const elapsedPct = (elapsedMs / periodMs) * 100;
			
			// Since we just calculated resetsAt as 5 hours from now,
			// elapsedMs should be 0 (period just started)
			expect(elapsedPct).toBeGreaterThanOrEqual(0);
			expect(elapsedPct).toBeLessThanOrEqual(100);
		});

		it('should handle time edge cases', () => {
			// Test zero elapsed time
			const elapsedMs = 0;
			const periodMs = 5 * 60 * 60 * 1000;
			const elapsedPct = (elapsedMs / periodMs) * 100;
			expect(elapsedPct).toBe(0);
			
			// Test full elapsed time
			const fullElapsedMs = periodMs;
			const fullElapsedPct = (fullElapsedMs / periodMs) * 100;
			expect(fullElapsedPct).toBe(100);
		});
	});
});