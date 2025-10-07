import { describe, test, expect } from '@jest/globals';
import { parseTask, sortKey, slotOrder } from '../../shared/parsing.js';

describe('parsing.js', () => {
  describe('parseTask', () => {
    test('should parse task with complete frontmatter', () => {
      const markdown = `---
typ: task
kategorie: arbeit
status: offen
tags: [urgent, backend]
deadline: 31.12.2024
fixedSlot:
  datum: 15.01.2025
  zeit: morgens
---

This is the task body.`;

      const result = parseTask(markdown);

      expect(result.typ).toBe('task');
      expect(result.kategorie).toBe('arbeit');
      expect(result.status).toBe('offen');
      expect(result.tags).toEqual(['urgent', 'backend']);
      expect(result.deadline).toBe('31.12.2024');
      expect(result.fixedSlot).toEqual({
        datum: '15.01.2025',
        zeit: 'morgens'
      });
      expect(result.body).toBe('This is the task body.');
    });

    test('should parse task with minimal frontmatter', () => {
      const markdown = `---
typ: task
kategorie: privat
status: offen
---

Simple task.`;

      const result = parseTask(markdown);

      expect(result.typ).toBe('task');
      expect(result.kategorie).toBe('privat');
      expect(result.status).toBe('offen');
      expect(result.tags).toEqual([]);
      expect(result.deadline).toBeNull();
      expect(result.fixedSlot).toBeNull();
      expect(result.body).toBe('Simple task.');
    });

    test('should parse completed task', () => {
      const markdown = `---
typ: task
kategorie: arbeit
status: abgeschlossen
abgeschlossen_am:
  datum: 20.01.2025
  zeit: nachmittags
---

Completed task.`;

      const result = parseTask(markdown);

      expect(result.status).toBe('abgeschlossen');
      expect(result.abgeschlossen_am).toEqual({
        datum: '20.01.2025',
        zeit: 'nachmittags'
      });
    });

    test('should handle empty tags array', () => {
      const markdown = `---
typ: task
kategorie: privat
status: offen
tags: []
---

Task without tags.`;

      const result = parseTask(markdown);
      expect(result.tags).toEqual([]);
    });

    test('should trim body content', () => {
      const markdown = `---
typ: task
kategorie: privat
status: offen
---


Task with extra whitespace.


`;

      const result = parseTask(markdown);
      expect(result.body).toBe('Task with extra whitespace.');
    });
  });

  describe('slotOrder', () => {
    test('should have correct slot ordering', () => {
      expect(slotOrder.morgens).toBe(1);
      expect(slotOrder.nachmittags).toBe(2);
      expect(slotOrder.abends).toBe(3);
    });
  });

  describe('sortKey', () => {
    test('should generate sortable key from date and slot', () => {
      const key1 = sortKey('15.01.2025', 'morgens');
      const key2 = sortKey('15.01.2025', 'nachmittags');
      const key3 = sortKey('16.01.2025', 'morgens');

      expect(key1).toBe('2025-01-15#1');
      expect(key2).toBe('2025-01-15#2');
      expect(key3).toBe('2025-01-16#1');
    });

    test('should sort chronologically', () => {
      const key1 = sortKey('15.01.2025', 'morgens');
      const key2 = sortKey('15.01.2025', 'nachmittags');
      const key3 = sortKey('16.01.2025', 'morgens');

      expect(key1 < key2).toBe(true);
      expect(key2 < key3).toBe(true);
    });

    test('should handle null date with default', () => {
      const key = sortKey(null, 'morgens');
      expect(key).toBe('2999-12-31#1');
    });

    test('should handle unknown slot with default order', () => {
      const key = sortKey('15.01.2025', 'unknown');
      expect(key).toBe('2025-01-15#9');
    });
  });
});
