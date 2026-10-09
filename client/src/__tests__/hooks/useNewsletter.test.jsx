import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import api from '../../utils/api';
import useNewsletter from '../../hooks/useNewsletter';

vi.mock('../../utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

// Stand-in for the form's submit event; the hook only calls preventDefault.
const submitEvent = () => ({ preventDefault: vi.fn() });

describe('useNewsletter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockResolvedValue({ data: { message: 'Thanks for subscribing!' } });
  });

  it('starts empty with no status', () => {
    const { result } = renderHook(() => useNewsletter('home'));

    expect(result.current.email).toBe('');
    expect(result.current.status).toBeNull();
    expect(result.current.submitting).toBe(false);
  });

  it('rejects an empty address without calling the API', async () => {
    const { result } = renderHook(() => useNewsletter('home'));

    await act(async () => {
      await result.current.subscribe(submitEvent());
    });

    expect(api.post).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({
      type: 'error',
      text: 'Please enter your email address.',
    });
  });

  it('rejects a whitespace-only address', async () => {
    const { result } = renderHook(() => useNewsletter('home'));
    act(() => result.current.changeEmail('    '));

    await act(async () => {
      await result.current.subscribe(submitEvent());
    });

    expect(api.post).not.toHaveBeenCalled();
    expect(result.current.status.type).toBe('error');
  });

  // The form's native validation blocks these before the hook sees them, so
  // they are only reachable by calling the hook directly.
  it.each([
    ['no @', 'not-an-email'],
    ['no domain', 'user@'],
    ['no local part', '@example.com'],
    ['no TLD', 'user@example'],
    ['internal space', 'us er@example.com'],
  ])('rejects a malformed address (%s)', async (_label, address) => {
    const { result } = renderHook(() => useNewsletter('home'));
    act(() => result.current.changeEmail(address));

    await act(async () => {
      await result.current.subscribe(submitEvent());
    });

    expect(api.post).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({
      type: 'error',
      text: 'Please enter a valid email address.',
    });
  });

  it('posts the trimmed address with the given source and clears the field', async () => {
    const { result } = renderHook(() => useNewsletter('footer'));
    act(() => result.current.changeEmail('  shopper@example.com  '));

    await act(async () => {
      await result.current.subscribe(submitEvent());
    });

    expect(api.post).toHaveBeenCalledWith('/newsletter', {
      email: 'shopper@example.com',
      source: 'footer',
    });
    expect(result.current.email).toBe('');
    expect(result.current.status).toEqual({
      type: 'success',
      text: 'Thanks for subscribing!',
    });
  });

  it('prevents the default form submission', async () => {
    const { result } = renderHook(() => useNewsletter('home'));
    act(() => result.current.changeEmail('shopper@example.com'));
    const event = submitEvent();

    await act(async () => {
      await result.current.subscribe(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('tolerates being called without an event', async () => {
    const { result } = renderHook(() => useNewsletter('home'));
    act(() => result.current.changeEmail('shopper@example.com'));

    await act(async () => {
      await result.current.subscribe();
    });

    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('falls back to a default message if the server sends none', async () => {
    api.post.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useNewsletter('home'));
    act(() => result.current.changeEmail('shopper@example.com'));

    await act(async () => {
      await result.current.subscribe(submitEvent());
    });

    expect(result.current.status.text).toBe('Thanks for subscribing!');
  });

  it('surfaces the server error message', async () => {
    api.post.mockRejectedValue({
      response: { data: { message: 'Please provide a valid email address' } },
    });
    const { result } = renderHook(() => useNewsletter('home'));
    act(() => result.current.changeEmail('shopper@example.com'));

    await act(async () => {
      await result.current.subscribe(submitEvent());
    });

    expect(result.current.status).toEqual({
      type: 'error',
      text: 'Please provide a valid email address',
    });
  });

  it('falls back to a generic message when the error has no server text', async () => {
    api.post.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useNewsletter('home'));
    act(() => result.current.changeEmail('shopper@example.com'));

    await act(async () => {
      await result.current.subscribe(submitEvent());
    });

    expect(result.current.status.text).toBe(
      'Something went wrong. Please try again.'
    );
  });

  it('keeps the typed address after a failure so it can be retried', async () => {
    api.post.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useNewsletter('home'));
    act(() => result.current.changeEmail('shopper@example.com'));

    await act(async () => {
      await result.current.subscribe(submitEvent());
    });

    expect(result.current.email).toBe('shopper@example.com');
  });

  it('clears an error as soon as the user edits the field', async () => {
    const { result } = renderHook(() => useNewsletter('home'));

    await act(async () => {
      await result.current.subscribe(submitEvent());
    });
    expect(result.current.status.type).toBe('error');

    act(() => result.current.changeEmail('shopper@example.com'));
    expect(result.current.status).toBeNull();
  });

  it('does not let an edit wipe out a success message', async () => {
    const { result } = renderHook(() => useNewsletter('home'));
    act(() => result.current.changeEmail('shopper@example.com'));

    await act(async () => {
      await result.current.subscribe(submitEvent());
    });
    expect(result.current.status.type).toBe('success');

    act(() => result.current.changeEmail('someone@else.com'));
    expect(result.current.status.type).toBe('success');
  });

  it('reports submitting while the request is in flight', async () => {
    let resolvePost;
    api.post.mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      })
    );

    const { result } = renderHook(() => useNewsletter('home'));
    act(() => result.current.changeEmail('shopper@example.com'));

    let pending;
    act(() => {
      pending = result.current.subscribe(submitEvent());
    });
    await waitFor(() => expect(result.current.submitting).toBe(true));

    await act(async () => {
      resolvePost({ data: { message: 'Thanks for subscribing!' } });
      await pending;
    });
    expect(result.current.submitting).toBe(false);
  });

  describe('success auto-dismiss', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    });

    it('clears the confirmation after 5 seconds', async () => {
      const { result } = renderHook(() => useNewsletter('home'));
      act(() => result.current.changeEmail('shopper@example.com'));

      await act(async () => {
        await result.current.subscribe(submitEvent());
      });
      expect(result.current.status.type).toBe('success');

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(result.current.status).toBeNull();
    });

    it('leaves an error in place rather than auto-dismissing it', async () => {
      const { result } = renderHook(() => useNewsletter('home'));

      await act(async () => {
        await result.current.subscribe(submitEvent());
      });
      expect(result.current.status.type).toBe('error');

      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(result.current.status.type).toBe('error');
    });

    it('does not start a timer before anything is submitted', () => {
      renderHook(() => useNewsletter('home'));
      expect(vi.getTimerCount()).toBe(0);
    });

    it('restarts the window on a second successful signup', async () => {
      const { result } = renderHook(() => useNewsletter('home'));

      act(() => result.current.changeEmail('first@example.com'));
      await act(async () => {
        await result.current.subscribe(submitEvent());
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(result.current.status).toBeNull();

      act(() => result.current.changeEmail('second@example.com'));
      await act(async () => {
        await result.current.subscribe(submitEvent());
      });

      act(() => {
        vi.advanceTimersByTime(4999);
      });
      expect(result.current.status.type).toBe('success');
    });
  });
});