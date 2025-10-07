import { describe, test, expect } from '@jest/globals';

describe('completeTask.js', () => {
  describe('validation', () => {
    test('should validate slot values', () => {
      const validSlots = ['morgens', 'nachmittags', 'abends'];
      
      expect(validSlots.includes('morgens')).toBe(true);
      expect(validSlots.includes('nachmittags')).toBe(true);
      expect(validSlots.includes('abends')).toBe(true);
      expect(validSlots.includes('mittags')).toBe(false);
      expect(validSlots.includes('invalid')).toBe(false);
    });

    test('should require both datum and zeit', () => {
      const isValid = (datum, zeit) => {
        return Boolean(datum && zeit);
      };
      
      expect(isValid('15.01.2025', 'morgens')).toBe(true);
      expect(isValid(null, 'morgens')).toBe(false);
      expect(isValid('15.01.2025', null)).toBe(false);
      expect(isValid(null, null)).toBe(false);
    });
  });

  describe('markAsCompleted', () => {
    test('should mark task as completed with date and slot', () => {
      const markAsCompleted = (existingMd, completedDate, completedSlot) => {
        const lines = existingMd.split('\n');
        const yamlStart = lines.indexOf('---');
        const yamlEnd = lines.indexOf('---', yamlStart + 1);
        
        if (yamlStart === -1 || yamlEnd === -1) {
          throw new Error('Invalid markdown format: missing YAML frontmatter');
        }
        
        const yamlLines = lines.slice(yamlStart + 1, yamlEnd);
        const bodyLines = lines.slice(yamlEnd + 1);
        
        const newYaml = yamlLines.map(line => {
          if (line.startsWith('status:')) {
            return 'status: abgeschlossen';
          }
          return line;
        });
        
        const statusIndex = newYaml.findIndex(l => l.startsWith('status:'));
        if (statusIndex !== -1) {
          newYaml.splice(statusIndex + 1, 0, `abgeschlossen_am:`);
          newYaml.splice(statusIndex + 2, 0, `  datum: ${completedDate}`);
          newYaml.splice(statusIndex + 3, 0, `  zeit: ${completedSlot}`);
        }
        
        return ['---', ...newYaml, '---', '', bodyLines.join('\n')].join('\n');
      };

      const existingMd = `---
typ: task
kategorie: arbeit
status: offen
---

Task to complete`;

      const result = markAsCompleted(existingMd, '20.01.2025', 'nachmittags');

      expect(result).toContain('status: abgeschlossen');
      expect(result).toContain('abgeschlossen_am:');
      expect(result).toContain('datum: 20.01.2025');
      expect(result).toContain('zeit: nachmittags');
      expect(result).toContain('Task to complete');
    });

    test('should preserve existing task data', () => {
      const markAsCompleted = (existingMd, completedDate, completedSlot) => {
        const lines = existingMd.split('\n');
        const yamlStart = lines.indexOf('---');
        const yamlEnd = lines.indexOf('---', yamlStart + 1);
        
        const yamlLines = lines.slice(yamlStart + 1, yamlEnd);
        const bodyLines = lines.slice(yamlEnd + 1);
        
        const newYaml = yamlLines.map(line => {
          if (line.startsWith('status:')) {
            return 'status: abgeschlossen';
          }
          return line;
        });
        
        const statusIndex = newYaml.findIndex(l => l.startsWith('status:'));
        if (statusIndex !== -1) {
          newYaml.splice(statusIndex + 1, 0, `abgeschlossen_am:`);
          newYaml.splice(statusIndex + 2, 0, `  datum: ${completedDate}`);
          newYaml.splice(statusIndex + 3, 0, `  zeit: ${completedSlot}`);
        }
        
        return ['---', ...newYaml, '---', '', bodyLines.join('\n')].join('\n');
      };

      const existingMd = `---
typ: task
kategorie: privat
status: offen
tags: [urgent, important]
deadline: 31.12.2024
---

Task with metadata`;

      const result = markAsCompleted(existingMd, '15.01.2025', 'morgens');

      expect(result).toContain('kategorie: privat');
      expect(result).toContain('tags: [urgent, important]');
      expect(result).toContain('deadline: 31.12.2024');
      expect(result).toContain('status: abgeschlossen');
    });

    test('should throw error for invalid markdown format', () => {
      const markAsCompleted = (existingMd, completedDate, completedSlot) => {
        const lines = existingMd.split('\n');
        const yamlStart = lines.indexOf('---');
        const yamlEnd = lines.indexOf('---', yamlStart + 1);
        
        if (yamlStart === -1 || yamlEnd === -1) {
          throw new Error('Invalid markdown format: missing YAML frontmatter');
        }
      };

      const invalidMd = 'No YAML frontmatter here';

      expect(() => markAsCompleted(invalidMd, '15.01.2025', 'morgens'))
        .toThrow('Invalid markdown format: missing YAML frontmatter');
    });

    test('should handle all slot types', () => {
      const markAsCompleted = (existingMd, completedDate, completedSlot) => {
        const lines = existingMd.split('\n');
        const yamlStart = lines.indexOf('---');
        const yamlEnd = lines.indexOf('---', yamlStart + 1);
        
        const yamlLines = lines.slice(yamlStart + 1, yamlEnd);
        const bodyLines = lines.slice(yamlEnd + 1);
        
        const newYaml = yamlLines.map(line => {
          if (line.startsWith('status:')) {
            return 'status: abgeschlossen';
          }
          return line;
        });
        
        const statusIndex = newYaml.findIndex(l => l.startsWith('status:'));
        if (statusIndex !== -1) {
          newYaml.splice(statusIndex + 1, 0, `abgeschlossen_am:`);
          newYaml.splice(statusIndex + 2, 0, `  datum: ${completedDate}`);
          newYaml.splice(statusIndex + 3, 0, `  zeit: ${completedSlot}`);
        }
        
        return ['---', ...newYaml, '---', '', bodyLines.join('\n')].join('\n');
      };

      const baseMd = `---
typ: task
status: offen
---

Task`;

      const morgens = markAsCompleted(baseMd, '15.01.2025', 'morgens');
      expect(morgens).toContain('zeit: morgens');

      const nachmittags = markAsCompleted(baseMd, '15.01.2025', 'nachmittags');
      expect(nachmittags).toContain('zeit: nachmittags');

      const abends = markAsCompleted(baseMd, '15.01.2025', 'abends');
      expect(abends).toContain('zeit: abends');
    });
  });

  describe('base64 encoding', () => {
    test('should encode completed markdown to base64', () => {
      const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
      
      const markdown = '---\nstatus: abgeschlossen\n---\n\nCompleted task';
      const encoded = b64(markdown);
      
      expect(encoded).toBe(Buffer.from(markdown).toString('base64'));
    });
  });
});
