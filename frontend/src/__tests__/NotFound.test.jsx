/**
 * Tests for the NotFound (404) page component.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from '../pages/NotFound';

describe('NotFound', () => {
  it('renders the 404 code', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders the page title', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );
    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });

  it('has a link back to dashboard', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );
    const link = screen.getByText('Back to Dashboard');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/');
  });
});
