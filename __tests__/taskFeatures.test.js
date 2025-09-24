const { describe, test, expect } = require('@jest/globals');

// Mock task decomposition function
function mockTaskDecomposition(task) {
  const maxSlotHours = 3.5;
  const totalSlots = Math.ceil(task.estimated_hours / maxSlotHours);
  
  const subtasks = [];
  for (let i = 1; i <= totalSlots; i++) {
    const remainingHours = task.estimated_hours - (i - 1) * maxSlotHours;
    const slotHours = Math.min(remainingHours, maxSlotHours);
    
    subtasks.push({
      title: `${task.title} - Teil ${i}`,
      estimated_hours: slotHours,
      order: i
    });
  }
  
  return {
    subtasks,
    total_slots: totalSlots,
    fallback: true
  };
}

// Mock voice response generation
function generateVoiceResponse(currentTask) {
  if (!currentTask) {
    return "Keine aktuelle Aufgabe gefunden.";
  }
  
  return `Deine aktuelle berufliche Aufgabe ist: ${currentTask.task}. 
Geplant für ${currentTask.slot}, Deadline ${currentTask.deadline}.
Kategorie: ${currentTask.category}.`;
}

describe('Task Decomposition', () => {
  describe('Slot Calculation', () => {
    test('should calculate correct number of slots for task hours', () => {
      const testCases = [
        { estimated_hours: 3.5, expected_slots: 1 },
        { estimated_hours: 7.0, expected_slots: 2 },
        { estimated_hours: 10.5, expected_slots: 3 },
        { estimated_hours: 14.0, expected_slots: 4 },
        { estimated_hours: 15.0, expected_slots: 5 }
      ];

      testCases.forEach(({ estimated_hours, expected_slots }) => {
        const task = { title: "Test Task", estimated_hours };
        const result = mockTaskDecomposition(task);
        
        expect(result.total_slots).toBe(expected_slots);
      });
    });

    test('should handle edge cases in hour calculation', () => {
      const edgeCases = [
        { estimated_hours: 0.5, expected_slots: 1 },   // Very small task
        { estimated_hours: 3.6, expected_slots: 2 },   // Just over one slot
        { estimated_hours: 50.0, expected_slots: 15 }  // Large task
      ];

      edgeCases.forEach(({ estimated_hours, expected_slots }) => {
        const task = { title: "Edge Case Task", estimated_hours };
        const result = mockTaskDecomposition(task);
        
        expect(result.total_slots).toBe(expected_slots);
      });
    });
  });

  describe('Subtask Generation', () => {
    test('should create correct number of subtasks', () => {
      const task = { title: "Website Redesign", estimated_hours: 14 };
      const result = mockTaskDecomposition(task);
      
      expect(result.subtasks).toHaveLength(4);
      expect(result.total_slots).toBe(4);
    });

    test('should generate subtasks with proper naming', () => {
      const task = { title: "API Development", estimated_hours: 7 };
      const result = mockTaskDecomposition(task);
      
      result.subtasks.forEach((subtask, index) => {
        expect(subtask.title).toBe(`API Development - Teil ${index + 1}`);
        expect(subtask.order).toBe(index + 1);
      });
    });

    test('should distribute hours correctly across subtasks', () => {
      const task = { title: "Code Review", estimated_hours: 10.5 };
      const result = mockTaskDecomposition(task);
      
      // First two subtasks should have 3.5 hours each
      expect(result.subtasks[0].estimated_hours).toBe(3.5);
      expect(result.subtasks[1].estimated_hours).toBe(3.5);
      expect(result.subtasks[2].estimated_hours).toBe(3.5);
      
      // Total hours should match original
      const totalHours = result.subtasks.reduce((sum, subtask) => sum + subtask.estimated_hours, 0);
      expect(totalHours).toBe(task.estimated_hours);
    });

    test('should handle single slot tasks', () => {
      const task = { title: "Quick Fix", estimated_hours: 2.0 };
      const result = mockTaskDecomposition(task);
      
      expect(result.subtasks).toHaveLength(1);
      expect(result.subtasks[0].estimated_hours).toBe(2.0);
      expect(result.subtasks[0].title).toBe("Quick Fix - Teil 1");
    });
  });

  describe('Response Structure', () => {
    test('should return proper structure', () => {
      const task = { title: "Test Task", estimated_hours: 7 };
      const result = mockTaskDecomposition(task);
      
      expect(result).toHaveProperty('subtasks');
      expect(result).toHaveProperty('total_slots');
      expect(result).toHaveProperty('fallback');
      
      expect(Array.isArray(result.subtasks)).toBe(true);
      expect(typeof result.total_slots).toBe('number');
      expect(typeof result.fallback).toBe('boolean');
    });

    test('should mark as fallback processing', () => {
      const task = { title: "Any Task", estimated_hours: 5 };
      const result = mockTaskDecomposition(task);
      
      expect(result.fallback).toBe(true);
    });
  });
});

describe('Voice Response Generation', () => {
  describe('Task Information Response', () => {
    test('should generate German response for current task', () => {
      const currentTask = {
        slot: "2025-W39-Tue-AM",
        task: "T-001: API Specification",
        category: "programmierung",
        deadline: "30.09.2025"
      };

      const response = generateVoiceResponse(currentTask);
      
      expect(response).toContain('Deine aktuelle berufliche Aufgabe ist');
      expect(response).toContain(currentTask.task);
      expect(response).toContain(currentTask.slot);
      expect(response).toContain(currentTask.deadline);
      expect(response).toContain(currentTask.category);
    });

    test('should handle missing task information', () => {
      const response = generateVoiceResponse(null);
      
      expect(response).toContain('Keine aktuelle Aufgabe gefunden');
    });

    test('should handle undefined task', () => {
      const response = generateVoiceResponse(undefined);
      
      expect(response).toContain('Keine aktuelle Aufgabe gefunden');
    });
  });

  describe('German Language Support', () => {
    test('should use proper German phrases', () => {
      const currentTask = {
        slot: "2025-W40-Wed-PM",
        task: "T-002: Database Migration",
        category: "database",
        deadline: "15.10.2025"
      };

      const response = generateVoiceResponse(currentTask);
      
      // Check for key German phrases
      expect(response).toContain('Deine aktuelle');
      expect(response).toContain('Aufgabe');
      expect(response).toContain('Geplant für');
      expect(response).toContain('Deadline');
      expect(response).toContain('Kategorie');
    });

    test('should maintain consistent German formatting', () => {
      const currentTask = {
        slot: "2025-W41-Thu-AM",
        task: "T-003: Testing Implementation",
        category: "testing",
        deadline: "01.11.2025"
      };

      const response = generateVoiceResponse(currentTask);
      
      // Should be proper sentences with punctuation
      expect(response).toMatch(/\./); // Contains periods
      expect(response).toMatch(/[A-ZÄÖÜ]/); // Starts with capital letter
    });
  });

  describe('Task Detail Integration', () => {
    test('should include all task details in response', () => {
      const currentTask = {
        slot: "2025-W42-Fri-PM",
        task: "T-004: Performance Optimization",
        category: "optimization",
        deadline: "20.11.2025"
      };

      const response = generateVoiceResponse(currentTask);
      
      // Verify all details are present
      expect(response).toContain("T-004: Performance Optimization");
      expect(response).toContain("2025-W42-Fri-PM");
      expect(response).toContain("optimization");
      expect(response).toContain("20.11.2025");
    });

    test('should handle special characters in task names', () => {
      const currentTask = {
        slot: "2025-W43-Mon-AM",
        task: "T-005: UI/UX Überarbeitung & Tests",
        category: "design",
        deadline: "05.12.2025"
      };

      const response = generateVoiceResponse(currentTask);
      
      expect(response).toContain("T-005: UI/UX Überarbeitung & Tests");
      expect(response).toContain("design");
    });
  });
});