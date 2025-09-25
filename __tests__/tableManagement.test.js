const { describe, test, expect } = require('@jest/globals');

// Mock table management utilities
function ensureTableCurrent(sec) {
  const header = `| Slot-ID           | Task | Kategorie | Deadline |\n|-------------------|:-----|:----------|:--------|\n`;
  if (!sec) return header;
  if (sec.includes("| Slot-ID") && sec.includes("|---")) return sec;
  return `## Dummy\n${header}`.split("\n").slice(1).join("\n");
}

function appendRow(sec, row) {
  const lines = sec.trim().split("\n"); 
  lines.push(row); 
  return lines.join("\n");
}

describe('Table Management', () => {
  describe('ensureTableCurrent', () => {
    test('should create table with headers for empty section', () => {
      const result = ensureTableCurrent("");
      expect(result).toContain("| Slot-ID");
      expect(result).toContain("|-------------------|");
      expect(result).toContain("| Task |");
      expect(result).toContain("| Kategorie |");
      expect(result).toContain("| Deadline |");
    });

    test('should return existing section if it already has table headers', () => {
      const existingTable = `| Slot-ID | Task | Kategorie | Deadline |\n|---|---|---|---|\n| 2025-W39-Mon-AM | Test | testing | 30.09.2025 |`;
      const result = ensureTableCurrent(existingTable);
      expect(result).toBe(existingTable);
    });

    test('should handle null/undefined input', () => {
      const result = ensureTableCurrent(null);
      expect(result).toContain("| Slot-ID");
      expect(result).toContain("|-------------------|");
    });
  });

  describe('appendRow', () => {
    test('should append row to existing table', () => {
      const table = `| Slot-ID | Task | Kategorie | Deadline |\n|---|---|---|---|\n`;
      const testRow = "| 2025-W39-Tue-AM | [T-001: Test](./test.md) | testing | 30.09.2025 |";
      
      const result = appendRow(table, testRow);
      
      expect(result).toContain(testRow);
      expect(result).toContain("T-001: Test");
      expect(result).toContain("testing");
      expect(result).toContain("30.09.2025");
    });

    test('should handle empty table input', () => {
      const testRow = "| 2025-W39-Wed-PM | [T-002: Another Task](./task2.md) | development | 01.10.2025 |";
      const result = appendRow("", testRow);
      expect(result).toBe("\n" + testRow); // appendRow adds empty line for empty input
    });

    test('should preserve existing rows when appending', () => {
      const table = `| Slot-ID | Task |\n|---|---|\n| 2025-W39-Mon-AM | Existing Task |`;
      const newRow = "| 2025-W39-Tue-AM | New Task |";
      
      const result = appendRow(table, newRow);
      
      expect(result).toContain("Existing Task");
      expect(result).toContain("New Task");
      const lines = result.split('\n');
      expect(lines[lines.length - 1]).toBe(newRow);
    });
  });
});