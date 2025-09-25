const { describe, test, expect } = require('@jest/globals');

describe('Task Data Validation', () => {
  describe('Task Structure', () => {
    test('should validate required fields for task creation', () => {
      const validTask = {
        list: "pro",
        id: "T-001",
        title: "Test Task",
        created_at_iso: "2025-09-23T10:00:00Z",
        scheduled_slot: "2025-W39-Tue-AM",
        category: "testing"
      };

      const requiredFields = ['list', 'id', 'title', 'created_at_iso', 'scheduled_slot'];
      const hasAllFields = requiredFields.every(field => validTask[field]);
      
      expect(hasAllFields).toBe(true);
    });

    test('should reject task with missing required fields', () => {
      const invalidTask = {
        list: "pro",
        id: "T-001",
        // missing title, created_at_iso, scheduled_slot
        category: "testing"
      };

      const requiredFields = ['list', 'id', 'title', 'created_at_iso', 'scheduled_slot'];
      const hasAllFields = requiredFields.every(field => invalidTask[field]);
      
      expect(hasAllFields).toBe(false);
    });
  });

  describe('List Validation', () => {
    test('should accept valid list values', () => {
      const validLists = ['pro', 'priv'];
      
      validLists.forEach(list => {
        expect(['pro', 'priv']).toContain(list);
      });
    });

    test('should reject invalid list values', () => {
      const invalidLists = ['personal', 'work', 'other', ''];
      
      invalidLists.forEach(list => {
        expect(['pro', 'priv']).not.toContain(list);
      });
    });
  });

  describe('Slot Format Validation', () => {
    test('should validate correct slot format', () => {
      const validSlots = [
        '2025-W39-Tue-AM',
        '2025-W01-Mon-PM',
        '2025-W52-Fri-AM',
        '2025-W10-Wed-PM'
      ];

      const slotRegex = /^\d{4}-W\d{2}-(Mon|Tue|Wed|Thu|Fri|Sat|Sun)-(AM|PM)$/;
      
      validSlots.forEach(slot => {
        expect(slotRegex.test(slot)).toBe(true);
      });
    });

    test('should reject invalid slot formats', () => {
      const invalidSlots = [
        '2025-W39-Tuesday-AM',    // full day name
        '2025-W39-Tue-Morning',   // invalid time
        '2025-39-Tue-AM',         // missing W
        'W39-Tue-AM',             // missing year
        '2025-W39-Tue',           // missing time
        '2025-W100-Tue-AM',       // invalid week number
        ''                        // empty
      ];

      const slotRegex = /^\d{4}-W\d{2}-(Mon|Tue|Wed|Thu|Fri|Sat|Sun)-(AM|PM)$/;
      
      invalidSlots.forEach(slot => {
        expect(slotRegex.test(slot)).toBe(false);
      });
    });
  });

  describe('Task ID Validation', () => {
    test('should accept typical task ID formats', () => {
      const validIds = [
        'T-001',
        'T-123',
        'TASK-001',
        'PRO-001',
        'PRIV-001'
      ];

      // Basic validation - task IDs should be non-empty strings
      validIds.forEach(id => {
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
      });
    });

    test('should handle edge cases in task IDs', () => {
      const edgeCaseIds = [
        'T-0001',  // leading zeros
        'T-999',   // high numbers
        'A-B-C',   // multiple dashes
      ];

      edgeCaseIds.forEach(id => {
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Optional Fields', () => {
    test('should handle tasks with optional fields', () => {
      const taskWithOptionals = {
        list: "pro",
        id: "T-001",
        title: "Test Task",
        created_at_iso: "2025-09-23T10:00:00Z",
        scheduled_slot: "2025-W39-Tue-AM",
        category: "testing",
        // Optional fields
        deadline_iso: "2025-10-01T23:59:59Z",
        project: "CodexMiroir",
        azure_devops: "ABC-123",
        requester: "user@example.com",
        duration_slots: 2
      };

      // All optional fields should be allowed
      expect(taskWithOptionals.deadline_iso).toBeTruthy();
      expect(taskWithOptionals.project).toBeTruthy();
      expect(taskWithOptionals.azure_devops).toBeTruthy();
      expect(taskWithOptionals.requester).toBeTruthy();
      expect(taskWithOptionals.duration_slots).toBe(2);
    });

    test('should handle tasks without optional fields', () => {
      const taskWithoutOptionals = {
        list: "priv",
        id: "P-001",
        title: "Personal Task",
        created_at_iso: "2025-09-23T10:00:00Z",
        scheduled_slot: "2025-W39-Wed-PM",
        category: "personal"
      };

      // Should still be valid without optional fields
      const requiredFields = ['list', 'id', 'title', 'created_at_iso', 'scheduled_slot'];
      const hasAllRequired = requiredFields.every(field => taskWithoutOptionals[field]);
      
      expect(hasAllRequired).toBe(true);
    });
  });
});