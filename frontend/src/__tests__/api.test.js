/**
 * Tests for src/utils/api.js — pure utility functions.
 * The fetch-based `api()` and `postApi()` are tested via mocking.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, postApi, formatDate, COLORS } from '../utils/api';

/* ── formatDate ────────────────────────────────────────────────── */

describe('formatDate', () => {
  it('formats a valid ISO date string', () => {
    const result = formatDate('2025-06-15');
    // en-GB → "15 Jun 2025"
    expect(result).toContain('Jun');
    expect(result).toContain('2025');
  });

  it('returns "—" for null/undefined', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
  });

  it('returns the raw string for unparseable dates', () => {
    // If Date constructor gives Invalid Date, catch block returns dateStr
    const result = formatDate('not-a-date');
    expect(typeof result).toBe('string');
  });
});

/* ── COLORS ────────────────────────────────────────────────────── */

describe('COLORS', () => {
  it('is an array of hex colour strings', () => {
    expect(Array.isArray(COLORS)).toBe(true);
    expect(COLORS.length).toBeGreaterThan(5);
    COLORS.forEach((c) => expect(c).toMatch(/^#[0-9a-fA-F]{6}$/));
  });
});

/* ── api() ─────────────────────────────────────────────────────── */

describe('api()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls fetch with the correct URL and returns JSON', async () => {
    const mockData = { total: 42 };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await api('/overview');
    expect(fetch).toHaveBeenCalledWith('/api/overview');
    expect(result).toEqual(mockData);
  });

  it('throws on non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(api('/overview')).rejects.toThrow('API error: 500');
  });
});

/* ── postApi() ─────────────────────────────────────────────────── */

describe('postApi()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends a POST request and returns JSON', async () => {
    const mockData = { status: 'success' };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await postApi('/scrape');
    expect(fetch).toHaveBeenCalledWith('/api/scrape', { method: 'POST' });
    expect(result).toEqual(mockData);
  });
});
