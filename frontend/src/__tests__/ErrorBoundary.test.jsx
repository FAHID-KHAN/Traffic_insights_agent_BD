/**
 * Tests for ErrorBoundary component.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';

/* ── Helper: a component that throws on demand ─────────────────── */
function BombComponent({ shouldThrow }) {
  if (shouldThrow) throw new Error('Test explosion');
  return <div>All good</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Suppress noisy React error-boundary console output
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <BombComponent shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('shows fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <BombComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
  });

  it('shows error details in expandable section', () => {
    render(
      <ErrorBoundary>
        <BombComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Error details')).toBeInTheDocument();
    expect(screen.getByText(/Test explosion/)).toBeInTheDocument();
  });

  it('reload button calls window.location.reload', () => {
    // Mock window.location.reload
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock, href: '/' },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <BombComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByText('Reload Page'));
    expect(reloadMock).toHaveBeenCalled();
  });
});
