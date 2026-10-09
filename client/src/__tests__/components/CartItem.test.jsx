import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CartItem from '../../components/CartItem';

const item = {
  id: 'p1',
  name: 'Whole Milk',
  price: 1.8,
  image: '/images/milk.jpg',
  quantity: 2,
};

const renderCartItem = (props) =>
  render(
    <MemoryRouter>
      <CartItem {...props} />
    </MemoryRouter>
  );

describe('CartItem', () => {
  const handlers = { updateQuantity: vi.fn(), removeFromCart: vi.fn() };

  beforeEach(() => {
    handlers.updateQuantity.mockClear();
    handlers.removeFromCart.mockClear();
  });

  it('renders the item name, price, and quantity', () => {
    renderCartItem({ item, ...handlers });
    expect(screen.getByText('Whole Milk')).toBeInTheDocument();
    expect(screen.getByText('£1.80 each')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('falls back to a placeholder image', () => {
    renderCartItem({ item: { ...item, image: '' }, ...handlers });
    expect(screen.getByRole('img')).toHaveAttribute('src', '/images/placeholder.jpg');
  });

  it('increases quantity via the + button', () => {
    renderCartItem({ item, ...handlers });
    fireEvent.click(screen.getByRole('button', { name: /increase quantity/i }));
    expect(handlers.updateQuantity).toHaveBeenCalledWith('p1', 3);
  });

  it('decreases quantity via the - button', () => {
    renderCartItem({ item, ...handlers });
    fireEvent.click(screen.getByRole('button', { name: /decrease quantity/i }));
    expect(handlers.updateQuantity).toHaveBeenCalledWith('p1', 1);
  });

  it('disables the decrease button when quantity is 1', () => {
    renderCartItem({ item: { ...item, quantity: 1 }, ...handlers });
    expect(screen.getByRole('button', { name: /decrease quantity/i })).toBeDisabled();
  });

  it('removes the item via the remove button', () => {
    renderCartItem({ item, ...handlers });
    fireEvent.click(screen.getByRole('button', { name: /remove .* from cart/i }));
    expect(handlers.removeFromCart).toHaveBeenCalledWith('p1');
  });

  it('supports a product using _id instead of id', () => {
    renderCartItem({ item: { ...item, id: undefined, _id: 'p9' }, ...handlers });
    fireEvent.click(screen.getByRole('button', { name: /increase quantity/i }));
    expect(handlers.updateQuantity).toHaveBeenCalledWith('p9', 3);
  });
});
