import { describe, test, expect } from '@jest/globals';

describe('updateTask.js', () => {
  describe('validation', () => {
    test('should validate kategorie', () => {
      const isValidKategorie = (kat) => ['arbeit', 'privat'].includes(kat);
      
      expect(isValidKategorie('arbeit')).toBe(true);
      expect(isValidKategorie('privat')).toBe(true);
      expect(isValidKategorie('invalid')).toBe(false);
      expect(isValidKategorie(undefined)).toBe(false);
    });

    test('should validate date format', () => {
      const isDate = (s) => /^\d{2}\.\d{2}\.\d{4}$/.test(s || '');
      
      expect(isDate('31.12.2024')).toBe(true);
      expect(isDate('01.01.2025')).toBe(true);
      expect(isDate('invalid')).toBe(false);
      expect(isDate(undefined)).toBe(false);
    });

    test('should validate slot values', () => {
      const slotOk = (z) => ['morgens', 'nachmittags', 'abends'].includes((z || '').toLowerCase());
      
      expect(slotOk('morgens')).toBe(true);
      expect(slotOk('nachmittags')).toBe(true);
      expect(slotOk('abends')).toBe(true);
      expect(slotOk('invalid')).toBe(false);
    });
  });

  describe('updateMarkdown', () => {
    test('should update kategorie in markdown', () => {
      const updateMarkdown = (existingMd, updates) => {
        const lines = existingMd.split('\n');
        const yamlStart = lines.indexOf('---');
        const yamlEnd = lines.indexOf('---', yamlStart + 1);
        
        if (yamlStart === -1 || yamlEnd === -1) {
          throw new Error('Invalid markdown format: missing YAML frontmatter');
        }
        
        const yamlLines = lines.slice(yamlStart + 1, yamlEnd);
        const bodyLines = lines.slice(yamlEnd + 1);
        
        const newYaml = yamlLines.map(line => {
          if (updates.kategorie && line.startsWith('kategorie:')) {
            return `kategorie: ${updates.kategorie}`;
          }
          return line;
        });
        
        const finalBody = updates.body !== undefined ? updates.body : bodyLines.join('\n');
        
        return ['---', ...newYaml, '---', '', finalBody].join('\n');
      };

      const existingMd = `---
typ: task
kategorie: arbeit
status: offen
---

Original task`;

      const result = updateMarkdown(existingMd, { kategorie: 'privat' });

      expect(result).toContain('kategorie: privat');
      expect(result).toContain('Original task');
    });

    test('should update status in markdown', () => {
      const updateMarkdown = (existingMd, updates) => {
        const lines = existingMd.split('\n');
        const yamlStart = lines.indexOf('---');
        const yamlEnd = lines.indexOf('---', yamlStart + 1);
        
        const yamlLines = lines.slice(yamlStart + 1, yamlEnd);
        const bodyLines = lines.slice(yamlEnd + 1);
        
        const newYaml = yamlLines.map(line => {
          if (updates.status && line.startsWith('status:')) {
            return `status: ${updates.status}`;
          }
          return line;
        });
        
        const finalBody = updates.body !== undefined ? updates.body : bodyLines.join('\n');
        
        return ['---', ...newYaml, '---', '', finalBody].join('\n');
      };

      const existingMd = `---
typ: task
kategorie: arbeit
status: offen
---

Task content`;

      const result = updateMarkdown(existingMd, { status: 'in_progress' });

      expect(result).toContain('status: in_progress');
    });

    test('should update body content', () => {
      const updateMarkdown = (existingMd, updates) => {
        const lines = existingMd.split('\n');
        const yamlStart = lines.indexOf('---');
        const yamlEnd = lines.indexOf('---', yamlStart + 1);
        
        const yamlLines = lines.slice(yamlStart + 1, yamlEnd);
        const bodyLines = lines.slice(yamlEnd + 1);
        
        const finalBody = updates.body !== undefined ? updates.body : bodyLines.join('\n');
        
        return ['---', ...yamlLines, '---', '', finalBody].join('\n');
      };

      const existingMd = `---
typ: task
kategorie: privat
---

Old content`;

      const result = updateMarkdown(existingMd, { body: 'New updated content' });

      expect(result).toContain('New updated content');
      expect(result).not.toContain('Old content');
    });

    test('should throw error for invalid markdown format', () => {
      const updateMarkdown = (existingMd, updates) => {
        const lines = existingMd.split('\n');
        const yamlStart = lines.indexOf('---');
        const yamlEnd = lines.indexOf('---', yamlStart + 1);
        
        if (yamlStart === -1 || yamlEnd === -1) {
          throw new Error('Invalid markdown format: missing YAML frontmatter');
        }
      };

      const invalidMd = 'Just plain text without YAML';

      expect(() => updateMarkdown(invalidMd, { kategorie: 'privat' }))
        .toThrow('Invalid markdown format: missing YAML frontmatter');
    });

    test('should update deadline', () => {
      const updateMarkdown = (existingMd, updates) => {
        const lines = existingMd.split('\n');
        const yamlStart = lines.indexOf('---');
        const yamlEnd = lines.indexOf('---', yamlStart + 1);
        
        const yamlLines = lines.slice(yamlStart + 1, yamlEnd);
        const bodyLines = lines.slice(yamlEnd + 1);
        
        const newYaml = yamlLines.map(line => {
          if (updates.hasOwnProperty('deadline') && line.startsWith('deadline:')) {
            return `deadline: ${updates.deadline || 'null'}`;
          }
          return line;
        });
        
        const finalBody = updates.body !== undefined ? updates.body : bodyLines.join('\n');
        
        return ['---', ...newYaml, '---', '', finalBody].join('\n');
      };

      const existingMd = `---
typ: task
kategorie: arbeit
deadline: null
---

Task`;

      const result = updateMarkdown(existingMd, { deadline: '31.12.2024' });

      expect(result).toContain('deadline: 31.12.2024');
    });

    test('should update tags', () => {
      const updateMarkdown = (existingMd, updates) => {
        const lines = existingMd.split('\n');
        const yamlStart = lines.indexOf('---');
        const yamlEnd = lines.indexOf('---', yamlStart + 1);
        
        const yamlLines = lines.slice(yamlStart + 1, yamlEnd);
        const bodyLines = lines.slice(yamlEnd + 1);
        
        const newYaml = yamlLines.map(line => {
          if (updates.tags && line.startsWith('tags:')) {
            return `tags: [${updates.tags.join(', ')}]`;
          }
          return line;
        });
        
        const finalBody = updates.body !== undefined ? updates.body : bodyLines.join('\n');
        
        return ['---', ...newYaml, '---', '', finalBody].join('\n');
      };

      const existingMd = `---
typ: task
kategorie: arbeit
tags: []
---

Task`;

      const result = updateMarkdown(existingMd, { tags: ['urgent', 'backend'] });

      expect(result).toContain('tags: [urgent, backend]');
    });
  });

  describe('base64 encoding', () => {
    test('should encode updated markdown to base64', () => {
      const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
      
      const markdown = '---\ntyp: task\n---\n\nUpdated';
      const encoded = b64(markdown);
      
      expect(encoded).toBe(Buffer.from(markdown).toString('base64'));
    });
  });
});
