import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import api from '../../../utils/api';
import AdminSubscribersPage from '../../../pages/admin/AdminSubscribersPage';

vi.mock('../../../utils/api', () => ({
  default: { get: vi.fn() },
}));

const daysAgo = (n) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

const SUBSCRIBERS = [
  { _id: 's1', email: 'ada@example.com', source: 'home', createdAt: daysAgo(1) },
  { _id: 's2', email: 'grace@example.com', source: 'footer', createdAt: daysAgo(30) },
  { _id: 's3', email: 'alan@example.com', source: 'home', createdAt: daysAgo(45) },
];

const ok = (subscribers) =>
  api.get.mockResolvedValue({
    data: { success: true, subscribers, total: subscribers.length },
  });

const renderPage = () => render(<AdminSubscribersPage />);

// AdminTable renders a desktop <table> and a mobile card list at the same time,
// so scope row assertions to the table to keep matchers unique.
const table = () => within(screen.getByRole('table'));
const bodyRows = () => table().getAllByRole('row').slice(1);
const emails = () => table().queryAllByText(/@example\.com/);
const searchBox = () => screen.getByLabelText('Search subscribers');
const statCard = (label) => within(screen.getByText(label).parentElement);
const exportButton = () => screen.getByRole('button', { name: /export csv/i });

const typeSearch = (value) => fireEvent.change(searchBox(), { target: { value } });

describe('AdminSubscribersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ok(SUBSCRIBERS);
  });

  it('fetches subscribers from the newsletter endpoint on mount', async () => {
    renderPage();

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/newsletter'));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('lists a row per subscriber with source and signup date', async () => {
    renderPage();
    await screen.findByRole('table');

    expect(bodyRows()).toHaveLength(3);
    expect(emails().map((el) => el.textContent)).toEqual([
      'ada@example.com',
      'grace@example.com',
      'alan@example.com',
    ]);

    // Two banner signups, one footer signup.
    expect(table().getAllByText('Home page')).toHaveLength(2);
    expect(table().getAllByText('Footer')).toHaveLength(1);
  });

  it('renders the signup date for each subscriber', async () => {
    renderPage();
    await screen.findByRole('table');

    const row = within(bodyRows()[0]);
    expect(
      row.getByText(new Date(SUBSCRIBERS[0].createdAt).toLocaleDateString())
    ).toBeInTheDocument();
  });

  it('summarises totals per source and recent signups', async () => {
    renderPage();
    await screen.findByRole('table');

    expect(statCard('Total subscribers').getByText('3')).toBeInTheDocument();
    expect(statCard('From home page').getByText('2')).toBeInTheDocument();
    expect(statCard('From footer').getByText('1')).toBeInTheDocument();
    // Only the 1-day-old signup falls inside the 7 day window.
    expect(statCard('Last 7 days').getByText('1')).toBeInTheDocument();
  });

  it('filters by email', async () => {
    renderPage();
    await screen.findByRole('table');

    typeSearch('grace');

    expect(emails().map((el) => el.textContent)).toEqual(['grace@example.com']);
  });

  it('filters by source', async () => {
    renderPage();
    await screen.findByRole('table');

    typeSearch('home');

    expect(emails().map((el) => el.textContent)).toEqual([
      'ada@example.com',
      'alan@example.com',
    ]);
  });

  it('shows the empty state when there are no subscribers at all', async () => {
    ok([]);
    renderPage();

    expect(
      await screen.findByText(/no newsletter subscribers yet/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('distinguishes no matches from an empty list', async () => {
    renderPage();
    await screen.findByRole('table');

    typeSearch('zzzz');

    expect(
      screen.getByText(/no subscribers match your search/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('surfaces the API error message', async () => {
    api.get.mockRejectedValue({ response: { data: { message: 'Not authorised' } } });
    renderPage();

    expect(await screen.findByText('Not authorised')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('falls back to a generic message when the error has no response body', async () => {
    api.get.mockRejectedValue(new Error('network down'));
    renderPage();

    expect(
      await screen.findByText(/failed to load newsletter subscribers/i)
    ).toBeInTheDocument();
  });

  it('tolerates a malformed payload instead of crashing', async () => {
    api.get.mockResolvedValue({ data: {} });
    renderPage();

    expect(
      await screen.findByText(/no newsletter subscribers yet/i)
    ).toBeInTheDocument();
  });

  it('refetches when Refresh is clicked', async () => {
    renderPage();
    await screen.findByRole('table');

    api.get.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    expect(api.get).toHaveBeenCalledWith('/newsletter');
  });

  describe('CSV export', () => {
    let createObjectURL;
    let revokeObjectURL;

    beforeEach(() => {
      createObjectURL = vi.fn(() => 'blob:mock');
      revokeObjectURL = vi.fn();
      globalThis.URL.createObjectURL = createObjectURL;
      globalThis.URL.revokeObjectURL = revokeObjectURL;
    });

    afterEach(() => {
      delete globalThis.URL.createObjectURL;
      delete globalThis.URL.revokeObjectURL;
    });

    const csvText = () => createObjectURL.mock.calls[0][0].text();

    it('writes a header plus every subscriber', async () => {
      renderPage();
      await screen.findByRole('table');
      fireEvent.click(exportButton());

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const text = await csvText();
      expect(text).toContain('email,source,subscribed_at');
      expect(text).toContain('ada@example.com,home');
      expect(text).toContain('grace@example.com,footer');
      expect(text).toContain('alan@example.com,home');
    });

    it('prefixes a BOM and uses CRLF so Excel parses it cleanly', async () => {
      renderPage();
      await screen.findByRole('table');
      fireEvent.click(exportButton());

      // Read raw bytes: Blob.text() decodes through TextDecoder, which strips a
      // leading BOM, so the marker is only observable at the byte level.
      const bytes = new Uint8Array(
        await createObjectURL.mock.calls[0][0].arrayBuffer()
      );
      expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);

      const text = await csvText();
      expect(text).toContain('\r\n');
    });

    it('revokes the object URL and removes the temporary link', async () => {
      renderPage();
      await screen.findByRole('table');
      fireEvent.click(exportButton());

      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
      expect(document.querySelector('a[download]')).toBeNull();
    });

    it('only exports the current search results', async () => {
      renderPage();
      await screen.findByRole('table');

      typeSearch('grace');
      fireEvent.click(exportButton());

      const text = await csvText();
      expect(text).toContain('grace@example.com');
      expect(text).not.toContain('ada@example.com');
    });

    it('escapes values that contain commas or quotes', async () => {
      ok([
        {
          _id: 's1',
          email: '"odd",name@example.com',
          source: 'home',
          createdAt: daysAgo(1),
        },
      ]);
      renderPage();
      await screen.findByRole('table');
      fireEvent.click(exportButton());

      const text = await csvText();
      expect(text).toContain('"""odd"",name@example.com"');
    });

    it('disables the button when there is nothing to export', async () => {
      ok([]);
      renderPage();
      await screen.findByText(/no newsletter subscribers yet/i);

      expect(exportButton()).toBeDisabled();
      expect(createObjectURL).not.toHaveBeenCalled();
    });
  });
});
