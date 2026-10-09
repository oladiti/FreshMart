import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import api from '../../utils/api';
import { CartContext } from '../../context/CartContext';
import { AuthContext } from '../../context/AuthContext';
import ProductDetailsPage from '../../pages/ProductDetailsPage';

vi.mock('../../utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const baseProduct = {
  _id: 'p1',
  slug: 'fresh-apples',
  name: 'Fresh Apples',
  price: 2.5,
  description: 'Crisp and juicy fresh apples',
  image: '/images/apples.jpg',
  images: [],
  category: 'Fruits',
  countInStock: 10,
  reviews: [],
  related: [],
  nutrition: {},
};

const signedInUser = { _id: 'u1', name: 'Test User', email: 'user@test.com' };

const renderPage = ({ user = null, product = baseProduct } = {}) => {
  api.get.mockResolvedValue({ data: product });
  return render(
    <MemoryRouter initialEntries={['/products/fresh-apples']}>
      <AuthContext.Provider value={{ user }}>
        <CartContext.Provider value={{ addToCart: vi.fn() }}>
          <Routes>
            <Route path="/products/:slug" element={<ProductDetailsPage />} />
          </Routes>
        </CartContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
};

const reviewBy = (user, rating, comment) => ({
  _id: 'r1',
  user: { _id: user._id, name: user.name },
  rating,
  comment,
  createdAt: '2026-01-15T10:00:00.000Z',
});

const openReviewForm = async (name) => {
  fireEvent.click(await screen.findByRole('button', { name }));
  return screen.findByRole('button', { name: /submit review|update review/i });
};

const pickRating = (n) =>
  fireEvent.click(screen.getByRole('radio', { name: `${n} out of 5` }));

// Queried by role rather than label text: the <form> itself carries an
// aria-label ("Write a review" / "Edit your review") that a /your review/i
// label query would also match.
const commentBox = () => screen.getByRole('textbox', { name: /your review/i });

const typeComment = (text) =>
  fireEvent.change(commentBox(), { target: { value: text } });

const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: /submit review|update review/i }));

describe('ProductDetailsPage reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the empty state and a login prompt when signed out', async () => {
    renderPage();
    expect(await screen.findByText('No reviews yet.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /log in to write a review/i })
    ).toHaveAttribute('href', '/login');
    expect(
      screen.queryByRole('button', { name: /be the first to review/i })
    ).not.toBeInTheDocument();
  });

  it('opens the review form when signed in', async () => {
    renderPage({ user: signedInUser });
    expect(
      await openReviewForm(/be the first to review/i)
    ).toBeInTheDocument();
    expect(commentBox()).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('requires a rating before submitting', async () => {
    renderPage({ user: signedInUser });
    await openReviewForm(/be the first to review/i);

    typeComment('Lovely apples');
    submit();

    expect(await screen.findByText(/please choose a star rating/i)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('requires a comment before submitting', async () => {
    renderPage({ user: signedInUser });
    await openReviewForm(/be the first to review/i);

    pickRating(4);
    submit();

    expect(await screen.findByText(/please write a short review/i)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('posts the review and renders it from the server response', async () => {
    const newReview = reviewBy(signedInUser, 5, 'Brilliant apples');
    api.post.mockResolvedValue({
      data: { message: 'Thanks for your review!', review: newReview, reviews: [newReview] },
    });

    renderPage({ user: signedInUser });
    await openReviewForm(/be the first to review/i);

    pickRating(5);
    typeComment('Brilliant apples');
    submit();

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith('/products/p1/reviews', {
      rating: 5,
      comment: 'Brilliant apples',
    });

    expect(await screen.findByText('Brilliant apples')).toBeInTheDocument();
    expect(screen.getByText(/thanks for your review/i)).toBeInTheDocument();
    // The empty state is replaced by the new review
    expect(screen.queryByText('No reviews yet.')).not.toBeInTheDocument();
    // Read-path regression guard: a real timestamp renders instead of "No date"
    expect(screen.queryByText('No date')).not.toBeInTheDocument();
  });

  it('surfaces the server error message when the request fails', async () => {
    api.post.mockRejectedValue({
      response: { data: { message: 'Rating must be a whole number between 1 and 5' } },
    });

    renderPage({ user: signedInUser });
    await openReviewForm(/be the first to review/i);

    pickRating(3);
    typeComment('Fine I suppose');
    submit();

    expect(
      await screen.findByText('Rating must be a whole number between 1 and 5')
    ).toBeInTheDocument();
  });

  it('falls back to a generic message when the error has no server text', async () => {
    api.post.mockRejectedValue(new Error('network down'));

    renderPage({ user: signedInUser });
    await openReviewForm(/be the first to review/i);

    pickRating(3);
    typeComment('Fine I suppose');
    submit();

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('offers a review form when reviews already exist', async () => {
    renderPage({
      user: signedInUser,
      product: {
        ...baseProduct,
        reviews: [reviewBy({ _id: 'u2', name: 'Someone Else' }, 4, 'Pretty good')],
      },
    });

    expect(await screen.findByText('Pretty good')).toBeInTheDocument();
    expect(
      await openReviewForm(/write a review/i)
    ).toBeInTheDocument();
  });

  it("marks and prefills the signed-in user's own review", async () => {
    renderPage({
      user: signedInUser,
      product: {
        ...baseProduct,
        reviews: [reviewBy(signedInUser, 2, 'Understated')],
      },
    });

    expect(await screen.findByText('(your review)')).toBeInTheDocument();
    await openReviewForm(/edit your review/i);

    expect(commentBox()).toHaveValue('Understated');
    expect(screen.getByRole('radio', { name: '2 out of 5' })).toBeChecked();
  });

  it('submits an update that overwrites the existing review', async () => {
    const existing = reviewBy(signedInUser, 2, 'Understated');
    const updated = reviewBy(signedInUser, 5, 'Changed my mind');
    api.post.mockResolvedValue({
      data: { message: 'Your review has been updated', review: updated, reviews: [updated] },
    });

    renderPage({ user: signedInUser, product: { ...baseProduct, reviews: [existing] } });
    await openReviewForm(/edit your review/i);

    pickRating(5);
    typeComment('Changed my mind');
    submit();

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith('/products/p1/reviews', {
      rating: 5,
      comment: 'Changed my mind',
    });
    expect(await screen.findByText('Changed my mind')).toBeInTheDocument();
    expect(screen.getByText(/your review has been updated/i)).toBeInTheDocument();
    expect(screen.queryByText('Understated')).not.toBeInTheDocument();
  });
});