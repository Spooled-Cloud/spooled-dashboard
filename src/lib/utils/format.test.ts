/**
 * Tests for format utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  formatRelativeTime,
  formatDuration,
  formatNumber,
  formatBytes,
  formatPercentage,
  formatDateTime,
  formatJobId,
} from './format';

describe('formatRelativeTime', () => {
  it('should format recent dates as "just now"', () => {
    const now = new Date();
    const result = formatRelativeTime(now.toISOString());
    expect(result).toMatch(/just now|less than a minute ago|seconds ago/i);
  });

  it('should handle date strings', () => {
    const date = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
    const result = formatRelativeTime(date);
    expect(result).toMatch(/hour|hours/i);
  });

  it('should handle Date objects', () => {
    const date = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
    const result = formatRelativeTime(date);
    expect(result).toMatch(/day|days/i);
  });
});

describe('formatDuration', () => {
  it('should format milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('should format seconds', () => {
    expect(formatDuration(1500)).toBe('1.50s');
    expect(formatDuration(5000)).toBe('5.00s');
  });

  it('should format minutes', () => {
    expect(formatDuration(90000)).toBe('1.50m');
    expect(formatDuration(300000)).toBe('5.00m');
  });

  it('should format hours', () => {
    expect(formatDuration(3600000)).toBe('1.00h');
    expect(formatDuration(7200000)).toBe('2.00h');
  });
});

describe('formatNumber', () => {
  it('should format small numbers as-is', () => {
    expect(formatNumber(123)).toBe('123');
    expect(formatNumber(999)).toBe('999');
  });

  it('should format thousands with commas', () => {
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(1500)).toBe('1,500');
    expect(formatNumber(999999)).toBe('999,999');
  });

  it('should format millions with commas', () => {
    expect(formatNumber(1000000)).toBe('1,000,000');
    expect(formatNumber(2500000)).toBe('2,500,000');
  });
});

describe('formatBytes', () => {
  it('should format bytes', () => {
    expect(formatBytes(500)).toBe('500 Bytes');
    expect(formatBytes(0)).toBe('0 Bytes');
  });

  it('should format kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(2048)).toBe('2 KB');
  });

  it('should format megabytes', () => {
    expect(formatBytes(1048576)).toBe('1 MB');
  });

  it('should format gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1 GB');
  });
});

describe('formatPercentage', () => {
  it('should format percentage with default decimals', () => {
    expect(formatPercentage(50)).toBe('50.0%');
    expect(formatPercentage(99.5)).toBe('99.5%');
  });

  it('should format percentage with custom decimals', () => {
    expect(formatPercentage(50, 0)).toBe('50%');
    expect(formatPercentage(33.333, 2)).toBe('33.33%');
  });
});

describe('formatDateTime', () => {
  it('should format date with default format', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    const result = formatDateTime(date);
    // The exact format depends on locale, but should contain date parts
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should format date with custom format', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    const result = formatDateTime(date, 'yyyy-MM-dd');
    expect(result).toBe('2024-01-15');
  });

  it('should handle string dates', () => {
    const result = formatDateTime('2024-06-01T12:00:00Z', 'yyyy-MM-dd');
    expect(result).toBe('2024-06-01');
  });
});

describe('formatJobId', () => {
  it('should return short IDs as-is', () => {
    expect(formatJobId('abc123')).toBe('abc123');
    expect(formatJobId('12345678')).toBe('12345678');
  });

  it('should truncate long IDs with ellipsis', () => {
    expect(formatJobId('123456789')).toBe('12345678...');
    expect(formatJobId('abcdefghijklmnop')).toBe('abcdefgh...');
  });

  it('should respect custom length parameter', () => {
    expect(formatJobId('123456789', 4)).toBe('1234...');
    expect(formatJobId('abcdefghij', 10)).toBe('abcdefghij');
  });
});
