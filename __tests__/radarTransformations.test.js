const { describe, test, expect } = require('@jest/globals');

/**
 * Unit tests for code quality radar chart transformation functions
 * Tests the normalization logic that converts SonarCloud metrics to 0-1.0 scale
 */

// Transform SonarCloud ratings (1=A, 2=B, 3=C, 4=D, 5=E) to radar values (0-1.0, where 1.0 is best)
function transformRating(value) {
  if (!value || value === 'No data') return 0;
  const num = parseInt(value);
  if (!num) return 0;
  // Convert to 0-1.0 scale where A=1.0, B=0.8, C=0.6, D=0.4, E=0.2
  return (6 - num) / 5;
}

// Transform percentage values (0-100 to 0-1.0 scale)
function transformPercentage(value) {
  if (!value || value === 'No data') return 0;
  return parseFloat(value) / 100; // 0-100 -> 0-1.0
}

// Transform lines of code to a 0-1.0 scale (logarithmic)
function transformLOC(value) {
  if (!value || value === 'No data') return 0;
  const loc = parseInt(value);
  if (loc < 100) return 0.2;
  if (loc < 500) return 0.4;
  if (loc < 1000) return 0.6;
  if (loc < 5000) return 0.8;
  return 1.0;
}

describe('Radar Chart Transformations', () => {
  describe('transformRating', () => {
    test('should convert SonarCloud ratings to 0-1.0 scale where A=1.0', () => {
      expect(transformRating('1')).toBe(1.0);   // A rating
      expect(transformRating('2')).toBe(0.8);   // B rating  
      expect(transformRating('3')).toBe(0.6);   // C rating
      expect(transformRating('4')).toBe(0.4);   // D rating
      expect(transformRating('5')).toBe(0.2);   // E rating
    });

    test('should handle edge cases', () => {
      expect(transformRating('No data')).toBe(0);
      expect(transformRating('')).toBe(0);
      expect(transformRating(null)).toBe(0);
      expect(transformRating(undefined)).toBe(0);
    });
  });

  describe('transformPercentage', () => {
    test('should convert percentages to 0-1.0 scale', () => {
      expect(transformPercentage('100')).toBe(1.0);
      expect(transformPercentage('80')).toBe(0.8);
      expect(transformPercentage('50')).toBe(0.5);
      expect(transformPercentage('0')).toBe(0.0);
    });

    test('should handle edge cases', () => {
      expect(transformPercentage('No data')).toBe(0);
      expect(transformPercentage('')).toBe(0);
    });
  });

  describe('transformLOC', () => {
    test('should convert LOC to 0-1.0 scale logarithmically', () => {
      expect(transformLOC('50')).toBe(0.2);     // < 100
      expect(transformLOC('300')).toBe(0.4);    // < 500
      expect(transformLOC('800')).toBe(0.6);    // < 1000 
      expect(transformLOC('3000')).toBe(0.8);   // < 5000
      expect(transformLOC('10000')).toBe(1.0);  // >= 5000
    });

    test('should handle edge cases', () => {
      expect(transformLOC('No data')).toBe(0);
      expect(transformLOC('')).toBe(0);
    });
  });

  describe('integrated transformations', () => {
    test('should produce correct radar values for current metrics', () => {
      // Simulate current metrics from report: A ratings (1.0), 0% coverage, 0% duplication, 934 LOC
      const mockMeasures = [
        { metric: 'security_rating', value: '1.0' },
        { metric: 'reliability_rating', value: '1.0' },
        { metric: 'sqale_rating', value: '1.0' },
        { metric: 'coverage', value: '0.0' },
        { metric: 'duplicated_lines_density', value: '0.0' },
        { metric: 'ncloc', value: '934' }
      ];

      function getMetricValue(measures, metric) {
        const measure = measures.find(m => m.metric === metric);
        return measure ? measure.value : 'No data';
      }

      const transformed = {
        security: transformRating(getMetricValue(mockMeasures, 'security_rating')),
        reliability: transformRating(getMetricValue(mockMeasures, 'reliability_rating')),
        maintainability: transformRating(getMetricValue(mockMeasures, 'sqale_rating')),
        coverage: transformPercentage(getMetricValue(mockMeasures, 'coverage')),
        duplicateCode: 1.0 - transformPercentage(getMetricValue(mockMeasures, 'duplicated_lines_density')),
        linesOfCode: transformLOC(getMetricValue(mockMeasures, 'ncloc'))
      };

      expect(transformed.security).toBe(1.0);        // A rating = 1.0
      expect(transformed.reliability).toBe(1.0);     // A rating = 1.0  
      expect(transformed.maintainability).toBe(1.0); // A rating = 1.0
      expect(transformed.coverage).toBe(0.0);        // 0% coverage = 0.0
      expect(transformed.duplicateCode).toBe(1.0);   // 0% duplication = 1.0 (inverted)
      expect(transformed.linesOfCode).toBe(0.6);     // 934 LOC = 0.6

      // Expected radar values: {1, 1, 1, 0, 1, 0.6}
      const radarValues = `{${transformed.security}, ${transformed.reliability}, ${transformed.maintainability}, ${transformed.coverage}, ${transformed.duplicateCode}, ${transformed.linesOfCode}}`;
      expect(radarValues).toBe('{1, 1, 1, 0, 1, 0.6}');
    });
  });
});