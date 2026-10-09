import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import api from '../../utils/api';
import { CartContext } from '../../context/CartContext';
import HomePage from '../../pages/HomePage';

vi.mock('../../utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const renderHome = () =>
  render(
    <MemoryRouter>
      <CartContext.Provider value={{ addToCart: vi.fn() }}>
        <HomePage />
      </CartContext.Provider>
    </MemoryRouter>
  );

const subscribe = (email = 'shopper@example.com') => {
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole('button', { name: /subscribe/i }));
};

describe('HomePage newsletter form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: { products: [], deals: [] } });
    api.post.mockResolvedValue({ data: { message: 'Thanks for subscribing!' } });
  });

  it('renders the newsletter section', async () => {
    renderHome();

    expect(
      await screen.findByRole('heading', { name: /join our newsletter/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subscribe/i })).toBeInTheDocument();
    expect(
      screen.getByText(/no spam — just fresh offers/i)
    ).toBeInTheDocument();
  });

  // Regression guard: this form's onSubmit used to be a bare
  // e.preventDefault(), so the button did nothing at all.
  it('posts to the newsletter endpoint instead of silently swallowing the submit', async () => {
    renderHome();
    await screen.findByLabelText('Email address');

    subscribe();

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith('/newsletter', {
      email: 'shopper@example.com',
      source: 'home',
    });
  });

  it('confirms success with the message the server sent', async () => {
    api.post.mockResolvedValue({
      data: {
        message: "You're already subscribed — thanks for staying in touch!",
      },
    });

    renderHome();
    await screen.findByLabelText('Email address');
    subscribe();

    expect(
      await screen.findByRole('status')
    ).toHaveTextContent("You're already subscribed");
  });

  it('shows an error and keeps the form when the request fails', async () => {
    api.post.mockRejectedValue({
      response: { data: { message: 'Email is required' } },
    });

    renderHome();
    await screen.findByLabelText('Email address');
    subscribe('shopper@example.com');

    expect(await screen.findByRole('status')).toHaveTextContent('Email is required');
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
  });

  it('does not post an empty address', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }));

    expect(api.post).not.toHaveBeenCalled();
  });
});