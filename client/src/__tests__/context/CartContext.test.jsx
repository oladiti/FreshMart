import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CartContext, CartProvider } from '../../context/CartContext';
import { AuthContext } from '../../context/AuthContext';

vi.mock('framer-motion', () => ({
  motion: { div: ({ children }) => children },
  AnimatePresence: ({ children }) => children,
}));

import { useContext } from 'react';

function Harness() {
  const { cart, addToCart, updateQuantity, removeFromCart, clearCart, totalItems, totalAmount } =
    useContext(CartContext);
  return (
    <div>
      <span data-testid="cart">{JSON.stringify(cart)}</span>
      <span data-testid="totalItems">{totalItems}</span>
      <span data-testid="totalAmount">{totalAmount}</span>
      <button onClick={() => addToCart({ _id: 'p1', name: 'Apple', price: 2, image: '/a.jpg' })}>
        add-apple
      </button>
      <button
        onClick={() => addToCart({ _id: 'p1', name: 'Apple', price: 2, image: '/a.jpg' }, 3)}
      >
        add-apple-3
      </button>
      <button onClick={() => addToCart({ _id: 'p2', name: 'Milk', price: 1.5, image: '/m.jpg' })}>
        add-milk
      </button>
      <button onClick={() => updateQuantity('p1', 5)}>set-qty-5</button>
      <button onClick={() => updateQuantity('p1', 0)}>set-qty-0</button>
      <button onClick={() => removeFromCart('p1')}>remove-p1</button>
      <button onClick={clearCart}>clear</button>
    </div>
  );
}

function renderWithAuth(user = { _id: 'u1' }) {
  return render(
    <AuthContext.Provider value={{ user, loading: false }}>
      <CartProvider>
        <Harness />
      </CartProvider>
    </AuthContext.Provider>
  );
}

describe('CartContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with an empty cart', async () => {
    renderWithAuth();
    await waitFor(() => {
      expect(screen.getByTestId('cart').textContent).toBe('[]');
    });
  });

  it('adds a new item to the cart', async () => {
    renderWithAuth();
    fireEvent.click(screen.getByText('add-apple'));
    await waitFor(() => {
      const cart = JSON.parse(screen.getByTestId('cart').textContent);
      expect(cart.length).toBe(1);
      expect(cart[0].name).toBe('Apple');
      expect(cart[0].quantity).toBe(1);
      expect(screen.getByTestId('totalItems').textContent).toBe('1');
    });
  });

  it('increments quantity when adding an existing item', async () => {
    renderWithAuth();
    fireEvent.click(screen.getByText('add-apple'));
    fireEvent.click(screen.getByText('add-apple'));
    await waitFor(() => {
      const cart = JSON.parse(screen.getByTestId('cart').textContent);
      expect(cart[0].quantity).toBe(2);
    });
  });

  it('adds an explicit quantity delta (3)', async () => {
    renderWithAuth();
    fireEvent.click(screen.getByText('add-apple-3'));
    await waitFor(() => {
      const cart = JSON.parse(screen.getByTestId('cart').textContent);
      expect(cart[0].quantity).toBe(3);
      expect(screen.getByTestId('totalAmount').textContent).toBe('6');
    });
  });

  it('computes total items and total amount across items', async () => {
    renderWithAuth();
    fireEvent.click(screen.getByText('add-apple'));
    fireEvent.click(screen.getByText('add-milk'));
    await waitFor(() => {
      expect(screen.getByTestId('totalItems').textContent).toBe('2');
      expect(screen.getByTestId('totalAmount').textContent).toBe('3.5');
    });
  });

  it('sets an absolute quantity with updateQuantity', async () => {
    renderWithAuth();
    fireEvent.click(screen.getByText('add-apple'));
    fireEvent.click(screen.getByText('set-qty-5'));
    await waitFor(() => {
      const cart = JSON.parse(screen.getByTestId('cart').textContent);
      expect(cart[0].quantity).toBe(5);
    });
  });

  it('removes an item when quantity is set to 0', async () => {
    renderWithAuth();
    fireEvent.click(screen.getByText('add-apple'));
    fireEvent.click(screen.getByText('set-qty-0'));
    await waitFor(() => {
      expect(screen.getByTestId('cart').textContent).toBe('[]');
    });
  });

  it('removes a specific item', async () => {
    renderWithAuth();
    fireEvent.click(screen.getByText('add-apple'));
    fireEvent.click(screen.getByText('add-milk'));
    fireEvent.click(screen.getByText('remove-p1'));
    await waitFor(() => {
      const cart = JSON.parse(screen.getByTestId('cart').textContent);
      expect(cart.length).toBe(1);
      expect(cart[0].name).toBe('Milk');
    });
  });

  it('clears the entire cart', async () => {
    renderWithAuth();
    fireEvent.click(screen.getByText('add-apple'));
    fireEvent.click(screen.getByText('add-milk'));
    fireEvent.click(screen.getByText('clear'));
    await waitFor(() => {
      expect(screen.getByTestId('cart').textContent).toBe('[]');
    });
  });

  it('persists to an account-specific localStorage key', async () => {
    renderWithAuth();
    fireEvent.click(screen.getByText('add-apple'));
    await waitFor(() => {
      const stored = localStorage.getItem('cart_u1');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored)[0].name).toBe('Apple');
    });
  });

  it('uses a guest cart key when no user is present', async () => {
    renderWithAuth(null);
    fireEvent.click(screen.getByText('add-apple'));
    await waitFor(() => {
      const guest = localStorage.getItem('guest_cart');
      expect(guest).toBeTruthy();
    });
  });
});
