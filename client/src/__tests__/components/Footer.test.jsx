import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import api from '../../utils/api';
import Footer from '../../components/Footer';

vi.mock('../../utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const renderFooter = () =>
  render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>
  );

const subscribe = (email = 'shopper@test.com') => {
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
};

// Flushes the async submit (and its promise chain) while fake timers are on,
// so we can then assert with synchronous queries.
const submitAndFlush = (email = 'shopper@test.com') =>
  act(async () => {
    subscribe(email);
  });

const advance = (ms) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('Footer subscribe confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockResolvedValue({ data: { message: 'Thanks for subscribing!' } });
  });

  describe('5 second auto-dismiss', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    });

    it('shows a confirmation instead of the form after subscribing', async () => {
      renderFooter();
      await submitAndFlush();

      expect(screen.getByText('Thanks for subscribing!')).toBeInTheDocument();
      expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument();
    });

    it('clears the email field so the returning form is empty', async () => {
      renderFooter();
      await submitAndFlush('  padded@example.com  ');

      advance(5000);
      expect(screen.getByLabelText('Email address')).toHaveValue('');
    });

    it('keeps the confirmation visible for just under 5 seconds', async () => {
      renderFooter();
      await submitAndFlush();

      advance(4999);
      expect(screen.getByText('Thanks for subscribing!')).toBeInTheDocument();
    });

    it('hides the confirmation and restores the form after 5 seconds', async () => {
      renderFooter();
      await submitAndFlush();

      advance(5000);
      expect(screen.queryByText('Thanks for subscribing!')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    });

    it('restarts the timer if the user subscribes again', async () => {
      renderFooter();
      await submitAndFlush();
      advance(5000);
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();

      await submitAndFlush('second@test.com');
      expect(screen.getByText('Thanks for subscribing!')).toBeInTheDocument();

      // The old timer must not carry over and cut this one short.
      advance(4999);
      expect(screen.getByText('Thanks for subscribing!')).toBeInTheDocument();
    });

    it('clears the pending timer on unmount', async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
      const { unmount } = renderFooter();
      await submitAndFlush();

      unmount();
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('request payload', () => {
    it('posts the address to the newsletter endpoint tagged as footer', async () => {
      renderFooter();
      subscribe('Shopper@Example.com');

      await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
      expect(api.post).toHaveBeenCalledWith('/newsletter', {
        email: 'Shopper@Example.com',
        source: 'footer',
      });
    });

    it('trims whitespace off the submitted address', async () => {
      renderFooter();
      subscribe('  padded@example.com  ');

      await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
      expect(api.post).toHaveBeenCalledWith('/newsletter', {
        email: 'padded@example.com',
        source: 'footer',
      });
    });

    it("surfaces the server's already-subscribed message", async () => {
      api.post.mockResolvedValue({
        data: {
          message: "You're already subscribed — thanks for staying in touch!",
          alreadySubscribed: true,
        },
      });

      renderFooter();
      subscribe('repeat@example.com');

      expect(
        await screen.findByText(
          "You're already subscribed — thanks for staying in touch!"
        )
      ).toBeInTheDocument();
    });

    it('surfaces a server validation message and keeps the form', async () => {
      api.post.mockRejectedValue({
        response: { data: { message: 'Please provide a valid email address' } },
      });

      renderFooter();
      subscribe('repeat@example.com');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Please provide a valid email address'
      );
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    });

    it('falls back to a generic message when the error has no server text', async () => {
      api.post.mockRejectedValue(new Error('network down'));

      renderFooter();
      subscribe('shopper@example.com');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        /something went wrong/i
      );
    });

    it('does not post when the email field is empty', () => {
      renderFooter();
      fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));

      expect(api.post).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    });

    // The input is type="email" + required, so the browser (and jsdom) refuses
    // to submit a malformed address before our own guard ever runs. That is the
    // desired outcome here; the guard itself is covered in the hook test.
    it('blocks submission of a malformed address via native validation', () => {
      renderFooter();
      subscribe('not-an-email');

      expect(api.post).not.toHaveBeenCalled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Email address')).toHaveValue('not-an-email');
    });
  });
});