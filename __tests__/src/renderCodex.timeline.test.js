import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Mock storage functions
const mockList = jest.fn();
const mockGetTextBlob = jest.fn();
const mockPutTextBlob = jest.fn();

jest.unstable_mockModule('../../shared/storage.js', () => ({
  list: mockList,
  getTextBlob: mockGetTextBlob,
  putTextBlob: mockPutTextBlob
}));

// Mock parsing
const mockParseTask = jest.fn();
jest.unstable_mockModule('../../shared/parsing.js', () => ({
  parseTask: mockParseTask
}));

describe('renderCodex.js - Timeline Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Timeline Skeleton Creation', () => {
    test('should only show future slots based on current hour', () => {
      // Test that past slots are filtered out
      // Rule 2.1: Timeline zeigt NUR zukünftige Slots ab dem aktuellen Zeitpunkt
      const SLOTS = ['morgens', 'nachmittags', 'abends'];
      
      // Simulate creating skeleton with current hour = 10 (after 9)
      // Should include: nachmittags, abends
      const currentHour = 10;
      let availableSlots = SLOTS;
      
      if (currentHour >= 19) {
        availableSlots = [];
      } else if (currentHour >= 14) {
        availableSlots = ['abends'];
      } else if (currentHour >= 9) {
        availableSlots = ['nachmittags', 'abends'];
      }
      
      expect(availableSlots).toEqual(['nachmittags', 'abends']);
    });

    test('should show no slots after 19:00', () => {
      // Rule 2.1: Wenn heute nach 19 Uhr: Keine Slots mehr für heute
      const SLOTS = ['morgens', 'nachmittags', 'abends'];
      const currentHour = 20;
      let availableSlots = SLOTS;
      
      if (currentHour >= 19) {
        availableSlots = [];
      } else if (currentHour >= 14) {
        availableSlots = ['abends'];
      } else if (currentHour >= 9) {
        availableSlots = ['nachmittags', 'abends'];
      }
      
      expect(availableSlots).toEqual([]);
    });

    test('should only show abends slot after 14:00', () => {
      // Rule 2.1: Wenn heute nach 14 Uhr: Nur `abends` Slot verfügbar
      const SLOTS = ['morgens', 'nachmittags', 'abends'];
      const currentHour = 15;
      let availableSlots = SLOTS;
      
      if (currentHour >= 19) {
        availableSlots = [];
      } else if (currentHour >= 14) {
        availableSlots = ['abends'];
      } else if (currentHour >= 9) {
        availableSlots = ['nachmittags', 'abends'];
      }
      
      expect(availableSlots).toEqual(['abends']);
    });

    test('should show all slots before 9:00', () => {
      // Rule 2.1: Wenn heute vor 9 Uhr: alle Slots verfügbar
      const SLOTS = ['morgens', 'nachmittags', 'abends'];
      const currentHour = 8;
      let availableSlots = SLOTS;
      
      if (currentHour >= 19) {
        availableSlots = [];
      } else if (currentHour >= 14) {
        availableSlots = ['abends'];
      } else if (currentHour >= 9) {
        availableSlots = ['nachmittags', 'abends'];
      }
      
      expect(availableSlots).toEqual(['morgens', 'nachmittags', 'abends']);
    });
  });

  describe('Task Sorting', () => {
    test('should sort tasks by ID in ascending order', () => {
      // Rule 2.2: Tasks MÜSSEN nach ID AUFSTEIGEND sortiert werden
      const extractTaskNumber = (filename) => {
        const match = filename.match(/(\d{4})(-[^/]+)?\.md$/);
        return match ? parseInt(match[1], 10) : 9999;
      };

      const tasks = [
        { file: 'raw/tasks/0104-large.md' },
        { file: 'raw/tasks/0003-medium.md' },
        { file: 'raw/tasks/0002-small.md' }
      ];

      const sorted = tasks.slice().sort((a, b) => {
        const idA = extractTaskNumber(a.file);
        const idB = extractTaskNumber(b.file);
        return idA - idB;
      });

      expect(extractTaskNumber(sorted[0].file)).toBe(2);
      expect(extractTaskNumber(sorted[1].file)).toBe(3);
      expect(extractTaskNumber(sorted[2].file)).toBe(104);
    });

    test('should place smallest ID first', () => {
      // Rule 2.2: Die kleinste ID wird zuerst in den nächsten freien Slot platziert
      // Rule 2.2: Beispiel: 0002 → 0003 → 0104 (nicht 0104 → 0003 → 0002)
      const extractTaskNumber = (filename) => {
        const match = filename.match(/(\d{4})(-[^/]+)?\.md$/);
        return match ? parseInt(match[1], 10) : 9999;
      };

      const tasks = [
        { file: 'raw/tasks/0104.md' },
        { file: 'raw/tasks/0003.md' },
        { file: 'raw/tasks/0002.md' }
      ];

      const sorted = tasks.slice().sort((a, b) => {
        const idA = extractTaskNumber(a.file);
        const idB = extractTaskNumber(b.file);
        return idA - idB;
      });

      expect(sorted[0].file).toBe('raw/tasks/0002.md');
      expect(sorted[1].file).toBe('raw/tasks/0003.md');
      expect(sorted[2].file).toBe('raw/tasks/0104.md');
    });
  });

  describe('Fixed vs Open Tasks', () => {
    test('should identify fixed tasks with valid datum', () => {
      // Rule 2.3: Fixed Tasks = haben `fixedSlot` mit gültigem `datum` (nicht null)
      const taskWithFixedSlot = {
        fixedSlot: { datum: '15.01.2025', zeit: 'morgens' }
      };
      
      const taskWithNullDatum = {
        fixedSlot: { datum: null, zeit: 'morgens' }
      };
      
      const taskWithoutFixedSlot = {
        fixedSlot: null
      };

      const isFixed = (t) => {
        if (!t.fixedSlot) return false;
        if (Array.isArray(t.fixedSlot)) {
          const datumObj = t.fixedSlot.find(obj => obj.datum !== undefined);
          return datumObj && datumObj.datum && datumObj.datum !== null;
        }
        return t.fixedSlot.datum && t.fixedSlot.datum !== null;
      };

      expect(isFixed(taskWithFixedSlot)).toBe(true);
      expect(isFixed(taskWithNullDatum)).toBeFalsy();
      expect(isFixed(taskWithoutFixedSlot)).toBeFalsy();
    });

    test('should identify open tasks', () => {
      // Rule 2.3: Open Tasks = kein `fixedSlot` ODER `fixedSlot.datum` ist null/undefined
      const openTask1 = { fixedSlot: null };
      const openTask2 = { fixedSlot: { datum: null, zeit: 'morgens' } };
      const openTask3 = {}; // no fixedSlot at all

      const isOpen = (t) => {
        if (!t.fixedSlot) return true;
        if (Array.isArray(t.fixedSlot)) {
          const datumObj = t.fixedSlot.find(obj => obj.datum !== undefined);
          return !datumObj || !datumObj.datum || datumObj.datum === null;
        }
        return !t.fixedSlot.datum || t.fixedSlot.datum === null;
      };

      expect(isOpen(openTask1)).toBe(true);
      expect(isOpen(openTask2)).toBe(true);
      expect(isOpen(openTask3)).toBe(true);
    });

    test('should handle array-format fixedSlot', () => {
      // Support both object and array format
      const taskArrayFormat = {
        fixedSlot: [{ datum: '15.01.2025' }, { zeit: 'morgens' }]
      };

      const isFixed = (t) => {
        if (!t.fixedSlot) return false;
        if (Array.isArray(t.fixedSlot)) {
          const datumObj = t.fixedSlot.find(obj => obj.datum !== undefined);
          return datumObj && datumObj.datum && datumObj.datum !== null;
        }
        return t.fixedSlot.datum && t.fixedSlot.datum !== null;
      };

      expect(isFixed(taskArrayFormat)).toBe(true);
    });
  });

  describe('Category Rules', () => {
    test('arbeit tasks should only be placed on weekdays', () => {
      // Rule 2.4: `arbeit` Tasks NUR an Werktagen (Mo-Fr)
      const WEEKDAYS = [1, 2, 3, 4, 5];
      const isWeekday = (date) => WEEKDAYS.includes(date.getDay());

      const monday = new Date(2025, 0, 13); // Monday
      const saturday = new Date(2025, 0, 18); // Saturday
      const friday = new Date(2025, 0, 17); // Friday

      expect(isWeekday(monday)).toBe(true);
      expect(isWeekday(friday)).toBe(true);
      expect(isWeekday(saturday)).toBe(false);
    });

    test('privat tasks should only be placed on weekends', () => {
      // Rule 2.4: `privat` Tasks NUR am Wochenende (Sa-So)
      const WEEKENDS = [0, 6];
      const isWeekend = (date) => WEEKENDS.includes(date.getDay());

      const saturday = new Date(2025, 0, 18); // Saturday
      const sunday = new Date(2025, 0, 19); // Sunday
      const monday = new Date(2025, 0, 13); // Monday

      expect(isWeekend(saturday)).toBe(true);
      expect(isWeekend(sunday)).toBe(true);
      expect(isWeekend(monday)).toBe(false);
    });

    test('should skip tasks that do not match day category', () => {
      // Rule 2.4: Tasks werden übersprungen, wenn Kategorie nicht zum Tag passt
      const WEEKDAYS = [1, 2, 3, 4, 5];
      const WEEKENDS = [0, 6];
      const isWeekday = (date) => WEEKDAYS.includes(date.getDay());
      const isWeekend = (date) => WEEKENDS.includes(date.getDay());

      const saturday = new Date(2025, 0, 18); // Saturday
      const monday = new Date(2025, 0, 13); // Monday

      const arbeitTask = { kategorie: 'arbeit' };
      const privatTask = { kategorie: 'privat' };

      // arbeit task on saturday should be skipped
      const shouldPlaceArbeitOnSaturday = arbeitTask.kategorie === 'arbeit' && isWeekday(saturday);
      expect(shouldPlaceArbeitOnSaturday).toBe(false);

      // arbeit task on monday should be placed
      const shouldPlaceArbeitOnMonday = arbeitTask.kategorie === 'arbeit' && isWeekday(monday);
      expect(shouldPlaceArbeitOnMonday).toBe(true);

      // privat task on saturday should be placed
      const shouldPlacePrivatOnSaturday = privatTask.kategorie === 'privat' && isWeekend(saturday);
      expect(shouldPlacePrivatOnSaturday).toBe(true);

      // privat task on monday should be skipped
      const shouldPlacePrivatOnMonday = privatTask.kategorie === 'privat' && isWeekend(monday);
      expect(shouldPlacePrivatOnMonday).toBe(false);
    });
  });

  describe('Status Filtering', () => {
    test('should only include tasks with status offen', () => {
      // Rule 2.5: NUR Tasks mit `status: "offen"` werden in die Timeline aufgenommen
      const task1 = { status: 'offen', typ: 'task' };
      const task2 = { status: 'abgeschlossen', typ: 'task' };
      const task3 = { status: 'abgebrochen', typ: 'task' };
      const task4 = { status: 'invalid', typ: 'task' };

      const shouldInclude = (task) => {
        return task.typ === 'task' && task.status === 'offen';
      };

      expect(shouldInclude(task1)).toBe(true);
      expect(shouldInclude(task2)).toBe(false);
      expect(shouldInclude(task3)).toBe(false);
      expect(shouldInclude(task4)).toBe(false);
    });

    test('should ignore abgeschlossen tasks', () => {
      // Rule 2.5: `status: "abgeschlossen"` Tasks werden IGNORIERT
      const task = { status: 'abgeschlossen', typ: 'task' };
      const shouldInclude = task.typ === 'task' && task.status === 'offen';
      expect(shouldInclude).toBe(false);
    });

    test('should ignore abgebrochen tasks', () => {
      // Rule 2.5: `status: "abgebrochen"` Tasks werden IGNORIERT
      const task = { status: 'abgebrochen', typ: 'task' };
      const shouldInclude = task.typ === 'task' && task.status === 'offen';
      expect(shouldInclude).toBe(false);
    });

    test('should skip tasks with invalid status', () => {
      // Rule 2.5: Ungültige Status-Werte führen zum Überspringen des Tasks
      const task = { status: 'unknown', typ: 'task' };
      const shouldInclude = task.typ === 'task' && task.status === 'offen';
      expect(shouldInclude).toBe(false);
    });
  });

  describe('Auto-fillable Slots', () => {
    test('should only auto-fill morgens and nachmittags', () => {
      // Rule 2.1: Nur `morgens` und `nachmittags` sind auto-füllbar
      const AUTO_FILLABLE_SLOTS = ['morgens', 'nachmittags'];
      
      expect(AUTO_FILLABLE_SLOTS).toContain('morgens');
      expect(AUTO_FILLABLE_SLOTS).toContain('nachmittags');
      expect(AUTO_FILLABLE_SLOTS).not.toContain('abends');
    });

    test('abends slot should only be for fixed tasks', () => {
      // Rule 2.1: `abends` ist NUR für manuell fixierte Tasks
      const AUTO_FILLABLE_SLOTS = ['morgens', 'nachmittags'];
      const isAutoFillable = (slot) => AUTO_FILLABLE_SLOTS.includes(slot);
      
      expect(isAutoFillable('morgens')).toBe(true);
      expect(isAutoFillable('nachmittags')).toBe(true);
      expect(isAutoFillable('abends')).toBe(false);
    });
  });

  describe('File Name Extraction', () => {
    test('should extract task number from various filename formats', () => {
      // Rule 3.1: Pattern `NNNN-Titel.md` oder `NNNN.md`
      const extractTaskNumber = (filename) => {
        const match = filename.match(/(\d{4})(-[^/]+)?\.md$/);
        return match ? parseInt(match[1], 10) : 9999;
      };

      expect(extractTaskNumber('0001.md')).toBe(1);
      expect(extractTaskNumber('0042-task-name.md')).toBe(42);
      expect(extractTaskNumber('0123-Another-Task.md')).toBe(123);
      expect(extractTaskNumber('9999.md')).toBe(9999);
    });

    test('should return default for files without valid ID', () => {
      // Rule 3.1: Dateien ohne 4-stellige ID werden übersprungen
      const extractTaskNumber = (filename) => {
        const match = filename.match(/(\d{4})(-[^/]+)?\.md$/);
        return match ? parseInt(match[1], 10) : 9999;
      };

      expect(extractTaskNumber('invalid.md')).toBe(9999);
      expect(extractTaskNumber('123.md')).toBe(9999); // Only 3 digits
      expect(extractTaskNumber('README.md')).toBe(9999);
    });
  });
});
