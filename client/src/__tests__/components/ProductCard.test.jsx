import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CartContext } from '../../context/CartContext';
import ProductCard from '../../components/ProductCard';

const mockProduct = {
  _id: 'p1',
  name: 'Fresh Apples',
  price: 2.5,
  image: '/images/apples.jpg',
};

const cartVal = { addToCart: vi.fn() };

function renderCard(product = mockProduct) {
  return render(
    <CartContext.Provider value={cartVal}>
      <ProductCard product={product} />
    </CartContext.Provider>
  );
}

describe('ProductCard', () => {
  beforeEach(() => {
    cartVal.addToCart.mockClear();
  });

  it('renders the product name and image', () => {
    renderCard();
    expect(screen.getByText('Fresh Apples')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', '/images/apples.jpg');
  });

  it('renders the price formatted in GBP', () => {
    renderCard();
    expect(screen.getByText('£2.50')).toBeInTheDocument();
  });

  it('calls addToCart with the product when button clicked', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: /add .* to cart/i }));
    expect(cartVal.addToCart).toHaveBeenCalledWith(mockProduct);
  });

  it('uses a placeholder alt when product name is missing', () => {
    renderCard({ _id: 'p2', price: 1, image: '/x.jpg', name: undefined });
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'Product');
  });
});
