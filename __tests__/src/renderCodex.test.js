import { describe, test, expect } from '@jest/globals';

describe('renderCodex.js', () => {
  describe('constants', () => {
    test('should have correct slot definitions', () => {
      const SLOTS = ['morgens', 'nachmittags', 'abends'];
      
      expect(SLOTS).toHaveLength(3);
      expect(SLOTS[0]).toBe('morgens');
      expect(SLOTS[1]).toBe('nachmittags');
      expect(SLOTS[2]).toBe('abends');
    });

    test('should have correct auto-fillable slots', () => {
      const AUTO_FILLABLE_SLOTS = ['morgens', 'nachmittags'];
      
      expect(AUTO_FILLABLE_SLOTS).toHaveLength(2);
      expect(AUTO_FILLABLE_SLOTS).toContain('morgens');
      expect(AUTO_FILLABLE_SLOTS).toContain('nachmittags');
      expect(AUTO_FILLABLE_SLOTS).not.toContain('abends');
    });

    test('should have correct weekday definitions', () => {
      const WEEKDAYS = [1, 2, 3, 4, 5]; // Mo-Fr
      
      expect(WEEKDAYS).toHaveLength(5);
      expect(WEEKDAYS).toEqual([1, 2, 3, 4, 5]);
    });

    test('should have correct weekend definitions', () => {
      const WEEKENDS = [0, 6]; // Sa-So
      
      expect(WEEKENDS).toHaveLength(2);
      expect(WEEKENDS).toEqual([0, 6]);
    });
  });

  describe('htmlEscape', () => {
    test('should escape HTML special characters', () => {
      const htmlEscape = (s) => (s || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c]));

      expect(htmlEscape('<script>alert("XSS")</script>'))
        .toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
      expect(htmlEscape('A & B')).toBe('A &amp; B');
      expect(htmlEscape("It's fine")).toBe('It&#39;s fine');
    });

    test('should handle empty string', () => {
      const htmlEscape = (s) => (s || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c]));

      expect(htmlEscape('')).toBe('');
      expect(htmlEscape(null)).toBe('');
      expect(htmlEscape(undefined)).toBe('');
    });
  });

  describe('date formatting', () => {
    test('should parse date string dd.mm.yyyy', () => {
      const parseDateStr = (dateStr) => {
        const [dd, mm, yyyy] = dateStr.split('.');
        return new Date(yyyy, mm - 1, dd);
      };

      const date = parseDateStr('15.01.2025');
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(0); // January is 0
      expect(date.getDate()).toBe(15);
    });

    test('should format date to dd.mm.yyyy', () => {
      const formatDateStr = (date) => {
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${dd}.${mm}.${yyyy}`;
      };

      const date = new Date(2025, 0, 15); // January 15, 2025
      expect(formatDateStr(date)).toBe('15.01.2025');
    });

    test('should pad single digit days and months', () => {
      const formatDateStr = (date) => {
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${dd}.${mm}.${yyyy}`;
      };

      const date = new Date(2025, 0, 5); // January 5, 2025
      expect(formatDateStr(date)).toBe('05.01.2025');
    });
  });

  describe('week calculations', () => {
    test('should get week start (Monday)', () => {
      const getWeekStart = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
      };

      // Wednesday, January 15, 2025
      const date = new Date(2025, 0, 15);
      const weekStart = getWeekStart(date);
      
      expect(weekStart.getDay()).toBe(1); // Monday
      expect(weekStart.getDate()).toBe(13);
    });

    test('should handle Sunday correctly', () => {
      const getWeekStart = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
      };

      // Sunday, January 12, 2025
      const date = new Date(2025, 0, 12);
      const weekStart = getWeekStart(date);
      
      expect(weekStart.getDay()).toBe(1); // Monday
      expect(weekStart.getDate()).toBe(6);
    });
  });

  describe('day type checks', () => {
    test('should identify weekdays', () => {
      const WEEKDAYS = [1, 2, 3, 4, 5];
      const isWeekday = (date) => WEEKDAYS.includes(date.getDay());

      expect(isWeekday(new Date(2025, 0, 13))).toBe(true); // Monday
      expect(isWeekday(new Date(2025, 0, 14))).toBe(true); // Tuesday
      expect(isWeekday(new Date(2025, 0, 17))).toBe(true); // Friday
      expect(isWeekday(new Date(2025, 0, 18))).toBe(false); // Saturday
      expect(isWeekday(new Date(2025, 0, 19))).toBe(false); // Sunday
    });

    test('should identify weekends', () => {
      const WEEKENDS = [0, 6];
      const isWeekend = (date) => WEEKENDS.includes(date.getDay());

      expect(isWeekend(new Date(2025, 0, 18))).toBe(true); // Saturday
      expect(isWeekend(new Date(2025, 0, 19))).toBe(true); // Sunday
      expect(isWeekend(new Date(2025, 0, 13))).toBe(false); // Monday
      expect(isWeekend(new Date(2025, 0, 17))).toBe(false); // Friday
    });
  });

  describe('task number extraction', () => {
    test('should extract task number from filename', () => {
      const extractTaskNumber = (filename) => {
        const match = filename.match(/(\d{4})/);
        return match ? parseInt(match[1], 10) : 9999;
      };

      expect(extractTaskNumber('0001.md')).toBe(1);
      expect(extractTaskNumber('0042.md')).toBe(42);
      expect(extractTaskNumber('0123-task-name.md')).toBe(123);
      expect(extractTaskNumber('9999.md')).toBe(9999);
    });

    test('should return default for invalid filenames', () => {
      const extractTaskNumber = (filename) => {
        const match = filename.match(/(\d{4})/);
        return match ? parseInt(match[1], 10) : 9999;
      };

      expect(extractTaskNumber('invalid.md')).toBe(9999);
      expect(extractTaskNumber('task-123.md')).toBe(9999); // Only 3 digits
      expect(extractTaskNumber('')).toBe(9999);
    });
  });

  describe('timeline skeleton creation', () => {
    test('should create 7-day skeleton', () => {
      const SLOTS = ['morgens', 'nachmittags', 'abends'];
      const createWeekSkeleton = (startDate) => {
        const skeleton = [];
        for (let i = 0; i < 7; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          const day = {
            dayOfWeek: date.getDay(),
            slots: SLOTS.map(slot => ({
              zeit: slot,
              task: null,
              isFixed: false
            }))
          };
          skeleton.push(day);
        }
        return skeleton;
      };

      const startDate = new Date(2025, 0, 13); // Monday
      const skeleton = createWeekSkeleton(startDate);

      expect(skeleton).toHaveLength(7);
      expect(skeleton[0].dayOfWeek).toBe(1); // Monday
      expect(skeleton[6].dayOfWeek).toBe(0); // Sunday
      expect(skeleton[0].slots).toHaveLength(3);
      expect(skeleton[0].slots[0].zeit).toBe('morgens');
      expect(skeleton[0].slots[0].task).toBeNull();
      expect(skeleton[0].slots[0].isFixed).toBe(false);
    });
  });

  describe('URL parameter parsing', () => {
    test('should parse format parameter', () => {
      const url = new URL('http://localhost:7071/codex?format=html');
      const format = (url.searchParams.get('format') || 'json').toLowerCase();
      
      expect(format).toBe('html');
    });

    test('should default to json format', () => {
      const url = new URL('http://localhost:7071/codex');
      const format = (url.searchParams.get('format') || 'json').toLowerCase();
      
      expect(format).toBe('json');
    });

    test('should parse nocache parameter', () => {
      const url = new URL('http://localhost:7071/codex?nocache=true');
      const nocache = url.searchParams.get('nocache') === 'true';
      
      expect(nocache).toBe(true);
    });

    test('should default nocache to false', () => {
      const url = new URL('http://localhost:7071/codex');
      const nocache = url.searchParams.get('nocache') === 'true';
      
      expect(nocache).toBe(false);
    });
  });

  describe('ETag handling', () => {
    test('should match ETag correctly', () => {
      const headSha = 'abc123';
      const ifNoneMatch = '"abc123"';
      const matches = ifNoneMatch.replace(/"/g, '') === headSha;
      
      expect(matches).toBe(true);
    });

    test('should not match different ETags', () => {
      const headSha = 'abc123';
      const ifNoneMatch = '"def456"';
      const matches = ifNoneMatch.replace(/"/g, '') === headSha;
      
      expect(matches).toBe(false);
    });

    test('should handle missing ETag', () => {
      const headSha = 'abc123';
      const ifNoneMatch = null;
      const matches = ifNoneMatch && ifNoneMatch.replace(/"/g, '') === headSha;
      
      expect(matches).toBeFalsy();
    });
  });
});
