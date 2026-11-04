import { describe, it, expect } from "vitest";
import {
  MAX_AVATAR_FILE_BYTES,
  validateAvatarFile,
} from "../../utils/avatarImage";

describe("validateAvatarFile", () => {
  it("requires a file", () => {
    expect(validateAvatarFile(null)).toMatch(/choose an image/i);
  });

  it("accepts PNG, JPEG, and WebP images", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp"]) {
      expect(validateAvatarFile({ type, size: 1024 })).toBe("");
    }
  });

  it("rejects unsupported image types", () => {
    expect(validateAvatarFile({ type: "image/svg+xml", size: 1024 })).toMatch(
      /png, jpeg, or webp/i
    );
  });

  it("rejects files larger than the limit", () => {
    expect(
      validateAvatarFile({
        type: "image/jpeg",
        size: MAX_AVATAR_FILE_BYTES + 1,
      })
    ).toMatch(/smaller than 5 mb/i);
  });
});
