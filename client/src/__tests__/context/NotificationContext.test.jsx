import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  NotificationProvider,
  useNotifications,
} from '../../context/NotificationContext';

vi.mock('framer-motion', () => ({
  motion: { div: ({ children }) => children },
  AnimatePresence: ({ children }) => children,
}));

function Trigger({ message = 'Item added to cart', type }) {
  const { notify } = useNotifications();
  return (
    <button onClick={() => notify(message, type)}>notify</button>
  );
}

describe('NotificationContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a toast when notify is called', () => {
    render(
      <NotificationProvider>
        <Trigger />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('notify'));

    expect(screen.getByText('Item added to cart')).toBeInTheDocument();
  });

  it('auto-dismisses the toast after the timeout', () => {
    render(
      <NotificationProvider>
        <Trigger />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('notify'));
    expect(screen.getByText('Item added to cart')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3200);
    });

    expect(screen.queryByText('Item added to cart')).not.toBeInTheDocument();
  });

  it('dismisses the toast when the close button is clicked', () => {
    render(
      <NotificationProvider>
        <Trigger />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('notify'));
    fireEvent.click(screen.getByLabelText('Dismiss notification'));

    expect(screen.queryByText('Item added to cart')).not.toBeInTheDocument();
  });

  it('stacks multiple toasts', () => {
    render(
      <NotificationProvider>
        <Trigger message="First message" />
        <Trigger message="Second message" />
      </NotificationProvider>
    );

    fireEvent.click(screen.getAllByText('notify')[0]);
    fireEvent.click(screen.getAllByText('notify')[1]);

    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
  });

  it('does not throw when notify is called without a provider', () => {
    render(<Trigger />);
    expect(() => fireEvent.click(screen.getByText('notify'))).not.toThrow();
  });
});
