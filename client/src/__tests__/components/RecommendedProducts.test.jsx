import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import api from '../../utils/api';
import { CartContext } from '../../context/CartContext';
import RecommendedProducts from '../../components/RecommendedProducts';

vi.mock('../../utils/api', () => ({
  default: { get: vi.fn() },
}));

const pick = (id, name) => ({
  _id: id,
  slug: name.toLowerCase(),
  name,
  price: 2,
  image: '/p.jpg',
  countInStock: 5,
});

const renderRow = (props = {}, cart = []) =>
  render(
    <MemoryRouter>
      <CartContext.Provider value={{ cart, addToCart: vi.fn() }}>
        <RecommendedProducts {...props} />
      </CartContext.Provider>
    </MemoryRouter>
  );

describe('RecommendedProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the picks and their human reasons', async () => {
    api.get.mockResolvedValue({
      data: {
        personalized: true,
        recommendations: [
          { product: pick('a1', 'Rice 5kg'), reason: 'Similar to items in your orders' },
        ],
      },
    });

    renderRow();

    expect(await screen.findByText('Rice 5kg')).toBeInTheDocument();
    expect(
      screen.getByText('Similar to items in your orders')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /recommended for you/i })
    ).toBeInTheDocument();
  });

  it('shows a skeleton while loading and renders nothing when there are no picks', async () => {
    let resolveRequest;
    api.get.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );

    const { container } = renderRow();

    expect(screen.getByTestId('rec-skeleton')).toBeInTheDocument();

    resolveRequest({ data: { personalized: false, recommendations: [] } });

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('seeds from the current product, excludes the cart, and retitles the row', async () => {
    api.get.mockResolvedValue({
      data: {
        personalized: false,
        recommendations: [{ product: pick('a2', 'Olive Oil'), reason: 'Popular right now' }],
      },
    });

    renderRow({ seedProductId: 'seed1' }, [{ id: 'cart1' }, { id: 'cart2' }]);

    expect(await screen.findByText('Olive Oil')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /you may also like/i })
    ).toBeInTheDocument();

    const url = api.get.mock.calls[0][0];
    expect(url).toContain('seed=seed1');
    expect(url).toContain('exclude=cart1%2Ccart2');
  });

  it('does not crash when the cart context has no cart array', async () => {
    api.get.mockResolvedValue({
      data: {
        personalized: false,
        recommendations: [{ product: pick('a3', 'Milk'), reason: 'Popular right now' }],
      },
    });

    render(
      <MemoryRouter>
        <CartContext.Provider value={{ addToCart: vi.fn() }}>
          <RecommendedProducts />
        </CartContext.Provider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Milk')).toBeInTheDocument();
    expect(api.get.mock.calls[0][0]).not.toContain('exclude=');
  });

  it('renders nothing when the request fails', async () => {
    api.get.mockRejectedValue(new Error('network down'));

    const { container } = renderRow();

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
