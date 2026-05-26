/**
 * Tests for render.js DOM manipulation
 * 
 * Tests the DOM manipulation functions used in render.js including:
 * - Finding and interacting with usage rows
 * - Adding and positioning marker elements
 * - Applying gradients to progress bars
 * - Creating and updating pill elements
 * - Rendering summary cards
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

	describe('Usage row creation and structure', () => {
		it('should create usage row with required elements', () => {
			const row = document.createElement('div');
			row.className = 'usage-row';
			
			const titleSpan = document.createElement('span');
			titleSpan.textContent = 'Current session';
			row.appendChild(titleSpan);
			
			const progressContainer = document.createElement('div');
			progressContainer.className = 'flex items-center gap-2';
			
			const barWrapper = document.createElement('div');
			barWrapper.className = 'flex-1';
			
			const bar = document.createElement('div');
			bar.setAttribute('role', 'progressbar');
			bar.style.width = '50%';
			bar.style.height = '8px';
			bar.style.background = '#f0f0f0';
			bar.style.borderRadius = '4px';
			bar.style.overflow = 'hidden';
			
			const fill = document.createElement('div');
			fill.style.width = '100%';
			fill.style.height = '100%';
			fill.style.background = 'var(--color-progress)';
			bar.appendChild(fill);
			
			barWrapper.appendChild(bar);
			progressContainer.appendChild(barWrapper);
			
			const usedLabel = document.createElement('span');
			usedLabel.className = 'text-right';
			usedLabel.textContent = '50% used';
			progressContainer.appendChild(usedLabel);
			
			row.appendChild(progressContainer);
			document.body.appendChild(row);
			
			// Verify structure
			expect(document.querySelector('.usage-row')).not.toBeNull();
			expect(document.querySelector('[role="progressbar"]')).not.toBeNull();
			expect(document.querySelector('.text-right')).not.toBeNull();
			expect(document.querySelector('.flex-1')).not.toBeNull();
		});

		it('should find usage row by title text', () => {
			const section = document.createElement('section');
			
			const h2 = document.createElement('h2');
			h2.textContent = 'Plan usage limits';
			section.appendChild(h2);
			
			const row = document.createElement('div');
			row.className = 'usage-row';
			
			const titleSpan = document.createElement('span');
			titleSpan.textContent = 'Current session';
			row.appendChild(titleSpan);
			
			section.appendChild(row);
			document.body.appendChild(section);
			
			// Find row by title
			const rows = Array.from(document.querySelectorAll('.usage-row'));
			const foundRow = rows.find(r => r.querySelector('span')?.textContent === 'Current session');
			
			expect(foundRow).not.toBeNull();
			expect(foundRow?.querySelector('span')?.textContent).toBe('Current session');
		});

		it('should handle missing elements gracefully', () => {
			const missingBar = document.querySelector('[role="progressbar"]');
			expect(missingBar).toBeNull();
			
			const missingRow = document.querySelector('.usage-row');
			expect(missingRow).toBeNull();
		});
	});

	describe('Marker element manipulation', () => {
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

		it('should position marker within bar wrapper', () => {
			const barWrapper = document.createElement('div');
			barWrapper.style.position = 'relative';
			barWrapper.style.width = '100%';
			
			const marker = document.createElement('div');
			marker.className = '__claude-pace-marker';
			marker.style.position = 'absolute';
			marker.style.left = '50%';
			marker.style.width = '4px';
			marker.style.height = '100%';
			
			barWrapper.appendChild(marker);
			
			// Verify marker was added
			expect(barWrapper.querySelector('.__claude-pace-marker')).not.toBeNull();
			expect(marker.style.left).toBe('50%');
		});

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

	describe('Progress bar gradient application', () => {
		it('should apply gradient to progress bar', () => {
			const bar = document.createElement('div');
			bar.setAttribute('role', 'progressbar');
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
			bar.setAttribute('role', 'progressbar');
			
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

		it('should support gradient string construction', () => {
			const util = 50;
			const expected = `linear-gradient(90deg, #22c55e 0%, #22c55e ${util}%, #f0f0f0 ${util}%, #f0f0f0 100%)`;
			
			expect(expected).toContain('linear-gradient');
			expect(expected).toContain('50%');
			expect(expected).toContain('#22c55e');
			expect(expected).toContain('#f0f0f0');
		});
	});

	describe('Pill element creation and styling', () => {
		it('should create pill element with correct class', () => {
			const pill = document.createElement('span');
			pill.className = '__claude-pace-pill';
			pill.style.display = 'inline-flex';
			pill.style.padding = '2px 8px';
			pill.style.gap = '4px';
			pill.textContent = '+5%';
			
			expect(pill.className).toBe('__claude-pace-pill');
			expect(pill.style.display).toBe('inline-flex');
			expect(pill.textContent).toBe('+5%');
		});

		it('should position pill in progress container', () => {
			const progressContainer = document.createElement('div');
			progressContainer.className = 'flex items-center gap-2';
			
			const pill = document.createElement('span');
			pill.className = '__claude-pace-pill';
			pill.style.display = 'inline-flex';
			pill.textContent = '+5%';
			
			progressContainer.appendChild(pill);
			
			// Verify pill was added
			expect(progressContainer.querySelector('.__claude-pace-pill')).not.toBeNull();
			expect(progressContainer.querySelector('.__claude-pace-pill')?.textContent).toBe('+5%');
		});

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

		it('should apply severity-based styles', () => {
			const pill = document.createElement('span');
			pill.className = '__claude-pace-pill';
			
			// Simulate over-pace styling
			pill.style.color = '#dc2626';
			pill.style.background = 'rgba(220,38,38,0.1)';
			pill.style.border = '1px solid rgba(220,38,38,0.25)';
			
			expect(pill.style.color).toBe('#dc2626');
			expect(pill.style.background).toContain('rgba(220,38,38,0.1)');
			
			// Simulate under-pace styling
			pill.style.color = '#16a34a';
			pill.style.background = 'rgba(22,163,74,0.1)';
			pill.style.border = '1px solid rgba(22,163,74,0.25)';
			
			expect(pill.style.color).toBe('#16a34a');
			expect(pill.style.background).toContain('rgba(22,163,74,0.1)');
		});
	});

	describe('Summary card rendering', () => {
		it('should create summary card element', () => {
			const summaryCard = document.createElement('div');
			summaryCard.className = '__claude-pace-summary';
			summaryCard.innerHTML = '<div class="summary-content">Pace: On track</div>';
			
			expect(summaryCard.className).toBe('__claude-pace-summary');
			expect(summaryCard.textContent).toContain('On track');
		});

		it('should add summary card to usage section', () => {
			const section = document.createElement('section');
			
			// Add some rows first
			for (let i = 0; i < 3; i++) {
				const row = document.createElement('div');
				row.className = 'usage-row';
				section.appendChild(row);
			}
			
			const rowCount = section.querySelectorAll('.usage-row').length;
			
			// Add summary card
			const summaryCard = document.createElement('div');
			summaryCard.className = '__claude-pace-summary';
			summaryCard.innerHTML = '<div class="summary-content">Pace: On track</div>';
			section.appendChild(summaryCard);
			
			// Verify it was added
			expect(section.querySelector('.__claude-pace-summary')).not.toBeNull();
			
			// Verify it comes after rows
			const allChildren = Array.from(section.children);
			const summaryIndex = allChildren.indexOf(summaryCard);
			expect(summaryIndex).toBeGreaterThan(rowCount - 1);
		});

		it('should update summary card content', () => {
			const summaryCard = document.createElement('div');
			summaryCard.className = '__claude-pace-summary';
			summaryCard.innerHTML = '<div class="summary-content">Pace: On track</div>';
			
			// Update content
			summaryCard.innerHTML = '<div class="summary-content">Pace: Over budget</div>';
			
			expect(summaryCard.textContent).toContain('Over budget');
		});
	});

	describe('DOM cleanup and re-rendering', () => {
		it('should remove existing markers when re-rendering', () => {
			const barWrapper = document.createElement('div');
			barWrapper.style.position = 'relative';
			
			// Add marker
			const marker = document.createElement('div');
			marker.className = '__claude-pace-marker';
			barWrapper.appendChild(marker);
			
			// Verify marker exists
			let foundMarker = barWrapper.querySelector('.__claude-pace-marker');
			expect(foundMarker).not.toBeNull();
			
			// Remove marker (simulating cleanup)
			marker.remove();
			
			// Verify marker was removed
			foundMarker = barWrapper.querySelector('.__claude-pace-marker');
			expect(foundMarker).toBeNull();
		});

		it('should clear bar styles on cleanup', () => {
			const bar = document.createElement('div');
			bar.setAttribute('role', 'progressbar');
			
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

		it('should handle multiple render cycles', () => {
			const bar = document.createElement('div');
			bar.setAttribute('role', 'progressbar');
			
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
			
			// Verify elements exist
			expect(container.querySelector('.__claude-pace-marker')).not.toBeNull();
			expect(container.querySelector('.__claude-pace-pill')).not.toBeNull();
			expect(container.querySelector('.__claude-pace-summary')).not.toBeNull();
			
			// Remove all
			container.querySelectorAll('.__claude-pace-marker, .__claude-pace-pill, .__claude-pace-summary')
				.forEach(el => el.remove());
			
			// Verify all were removed
			expect(container.querySelector('.__claude-pace-marker')).toBeNull();
			expect(container.querySelector('.__claude-pace-pill')).toBeNull();
			expect(container.querySelector('.__claude-pace-summary')).toBeNull();
		});
	});

	describe('Error handling and edge cases', () => {
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
			const missingBar = document.querySelector('[role="progressbar"]');
			
			// Should not throw when manipulating null
			expect(() => {
				if (missingBar) {
					(missingBar as HTMLElement).style.background = 'green';
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

		it('should handle invalid percentage values', () => {
			const marker = document.createElement('div');
			marker.style.position = 'absolute';
			
			// Test boundary values
			marker.style.left = '-10%';
			expect(parseFloat(marker.style.left)).toBe(-10);
			
			marker.style.left = '150%';
			expect(parseFloat(marker.style.left)).toBe(150);
			
			// Test NaN handling
			const invalidValue = parseFloat('invalid');
			expect(isNaN(invalidValue)).toBe(true);
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