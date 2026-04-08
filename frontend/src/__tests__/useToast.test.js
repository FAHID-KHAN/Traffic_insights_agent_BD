/**
 * Tests for useToast hook.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '../utils/useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with no toasts', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toEqual([]);
  });

  it('adds a toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.addToast('Hello', 'info'));
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Hello');
    expect(result.current.toasts[0].type).toBe('info');
  });

  it('auto-removes toast after 4 seconds', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.addToast('Temp'));
    expect(result.current.toasts).toHaveLength(1);

    act(() => vi.advanceTimersByTime(4100));
    expect(result.current.toasts).toHaveLength(0);
  });

  it('can hold multiple toasts', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('A');
      result.current.addToast('B');
    });
    expect(result.current.toasts).toHaveLength(2);
  });
});
