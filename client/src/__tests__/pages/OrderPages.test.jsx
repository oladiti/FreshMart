import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import OrdersPage from '../../pages/OrdersPage';
import AdminOrdersPage from '../../pages/admin/AdminOrdersPage';
import api from '../../utils/api';

vi.mock('../../utils/api', () => ({
  default: { get: vi.fn() },
}));

const renderWithRouter = (ui) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

const expectOrderNavigation = () => {
  expect(
    screen.getByRole('navigation', { name: /order navigation/i })
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
    'href',
    '/'
  );
  expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute(
    'href',
    '/profile'
  );
  expect(screen.queryByText(/back to home/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/back to profile/i)).not.toBeInTheDocument();
};

describe('order page navigation', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockResolvedValue({ data: [] });
  });

  it('shows Home and Profile links on the user orders page', async () => {
    renderWithRouter(
      <AuthContext.Provider
        value={{
          user: {
            _id: 'u1',
            name: 'Test User',
            email: 'user@test.com',
            role: 'user',
          },
        }}
      >
        <OrdersPage />
      </AuthContext.Provider>
    );

    expectOrderNavigation();
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/orders/myorders')
    );
  });

  it('shows Home and Profile links on the admin orders page', async () => {
    renderWithRouter(<AdminOrdersPage />);

    expectOrderNavigation();
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/admin/orders')
    );
  });
});
