const { describe, test, expect } = require('@jest/globals');

// Mock date utilities (these would be imported from the actual module in a real setup)
function ymd(isoStr) {
  return isoStr.slice(0, 10);
}

function ddmmyyyy(isoStr) {
  const d = new Date(isoStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function weekOf(slotId) {
  const match = slotId.match(/(\d{4}-W\d{2})/);
  return match ? match[1] : null;
}

describe('Date Utilities', () => {
  describe('ymd', () => {
    test('should extract date in YYYY-MM-DD format from ISO string', () => {
      const testDate = '2025-09-23T10:00:00Z';
      const result = ymd(testDate);
      expect(result).toBe('2025-09-23');
    });

    test('should handle different ISO formats', () => {
      expect(ymd('2025-12-31T23:59:59.999Z')).toBe('2025-12-31');
      expect(ymd('2025-01-01T00:00:00+01:00')).toBe('2025-01-01');
    });
  });

  describe('ddmmyyyy', () => {
    test('should convert ISO date to DD.MM.YYYY format', () => {
      const testDate = '2025-09-23T10:00:00Z';
      const result = ddmmyyyy(testDate);
      expect(result).toBe('23.09.2025');
    });

    test('should handle edge cases', () => {
      expect(ddmmyyyy('2025-01-01T00:00:00Z')).toBe('01.01.2025');
      expect(ddmmyyyy('2025-12-31T23:59:59Z')).toBe('31.12.2025');
    });

    test('should pad single digits with zero', () => {
      expect(ddmmyyyy('2025-01-05T12:00:00Z')).toBe('05.01.2025');
    });
  });

  describe('weekOf', () => {
    test('should extract week from slot ID', () => {
      const testSlot = '2025-W39-Tue-AM';
      const result = weekOf(testSlot);
      expect(result).toBe('2025-W39');
    });

    test('should handle different slot formats', () => {
      expect(weekOf('2025-W01-Mon-PM')).toBe('2025-W01');
      expect(weekOf('2025-W52-Fri-AM')).toBe('2025-W52');
    });

    test('should return null for invalid slot formats', () => {
      expect(weekOf('invalid-slot')).toBeNull();
      expect(weekOf('2025-Tue-AM')).toBeNull();
      expect(weekOf('')).toBeNull();
    });
  });
});