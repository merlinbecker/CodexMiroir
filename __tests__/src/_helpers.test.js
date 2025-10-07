import { describe, test, expect } from '@jest/globals';
import { getContentType } from '../../src/_helpers.js';

describe('_helpers.js', () => {
  describe('getContentType', () => {
    test('should return text/html for .html files', () => {
      expect(getContentType('index.html')).toBe('text/html');
      expect(getContentType('path/to/file.html')).toBe('text/html');
    });

    test('should return text/css for .css files', () => {
      expect(getContentType('styles.css')).toBe('text/css');
      expect(getContentType('path/to/styles.css')).toBe('text/css');
    });

    test('should return application/javascript for .js files', () => {
      expect(getContentType('app.js')).toBe('application/javascript');
      expect(getContentType('path/to/app.js')).toBe('application/javascript');
    });

    test('should return application/json for .json files', () => {
      expect(getContentType('data.json')).toBe('application/json');
    });

    test('should return image types for image files', () => {
      expect(getContentType('image.png')).toBe('image/png');
      expect(getContentType('photo.jpg')).toBe('image/jpeg');
      expect(getContentType('photo.jpeg')).toBe('image/jpeg');
      expect(getContentType('animation.gif')).toBe('image/gif');
      expect(getContentType('logo.svg')).toBe('image/svg+xml');
      expect(getContentType('favicon.ico')).toBe('image/x-icon');
    });

    test('should return text/plain for unknown extensions', () => {
      expect(getContentType('file.unknown')).toBe('text/plain');
      expect(getContentType('file.txt')).toBe('text/plain');
      expect(getContentType('file.md')).toBe('text/plain');
    });

    test('should handle files without extensions', () => {
      expect(getContentType('filename')).toBe('text/plain');
    });

    test('should be case insensitive', () => {
      expect(getContentType('FILE.HTML')).toBe('text/html');
      expect(getContentType('FILE.CSS')).toBe('text/css');
      expect(getContentType('FILE.JS')).toBe('application/javascript');
    });
  });
});
