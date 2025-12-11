/**
 * Tests for cn utility function
 */

import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    const showBar = true;
    const showBaz = false;
    expect(cn('foo', showBar && 'bar', showBaz && 'baz')).toBe('foo bar');
  });

  it('should handle undefined and null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });

  it('should handle arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('should handle objects', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });

  it('should merge Tailwind classes correctly', () => {
    // Later class should override earlier conflicting class
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('should handle complex Tailwind merges', () => {
    expect(cn('p-4 hover:bg-red-500', 'p-8')).toBe('hover:bg-red-500 p-8');
  });

  it('should return empty string for no inputs', () => {
    expect(cn()).toBe('');
  });

  it('should handle empty strings', () => {
    expect(cn('', 'foo', '', 'bar', '')).toBe('foo bar');
  });
});
