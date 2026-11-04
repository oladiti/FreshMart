// zod schemas for authentication routes.
//
// These enforce shape/type at the edge. Business rules that need domain
// knowledge (password strength, duplicate emails, current-password checks)
// stay in the controller so their precise messages are preserved.

import { z } from 'zod';

const email = z.string().trim().email('A valid email is required');
const bounded = (max) => z.string().trim().min(1).max(max);

// Avatars are stored inline as data URLs. SVG is deliberately excluded because
// it can carry executable content; the client always re-encodes uploads as JPEG.
const AVATAR_DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const avatar = z
  .string()
  .max(700000)
  .refine((value) => value === '' || AVATAR_DATA_URL.test(value), {
    message: 'Avatar must be a PNG, JPEG, or WebP image',
  });

export const registerSchema = z.object({
  name: bounded(50),
  email,
  // Length is policy-checked in the controller; cap it here to bound input.
  password: z.string().min(1).max(200),
});

export const forgotPasswordSchema = z.object({
  email,
});

export const resetPasswordSchema = {
  params: z.object({ token: bounded(200) }),
  body: z.object({ password: z.string().min(1).max(200) }),
};

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  email: email.optional(),
  currentPassword: z.string().max(200).optional(),
  password: z.string().max(200).optional(),
  avatar: avatar.optional(),
});

export const enableTwoFactorSchema = z.object({
  code: bounded(10),
});

export const disableTwoFactorSchema = z.object({
  password: z.string().min(1).max(200),
});

export default {
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  enableTwoFactorSchema,
  disableTwoFactorSchema,
};
