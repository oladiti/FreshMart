import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import ProfilePage from "../../pages/ProfilePage";

vi.mock("../../utils/avatarImage", () => ({
  fileToAvatarDataUrl: vi.fn(),
}));

import { fileToAvatarDataUrl } from "../../utils/avatarImage";

const user = {
  _id: "u1",
  name: "Test User",
  email: "user@test.com",
  role: "user",
  avatar: "",
};

function renderProfile(updateProfile) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user, updateProfile }}>
        <ProfilePage />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe("ProfilePage avatar upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fileToAvatarDataUrl.mockResolvedValue("data:image/jpeg;base64,avatar");
  });

  it("previews a selected photo and saves it with the profile", async () => {
    const updateProfile = vi.fn().mockResolvedValue({ success: true });
    const actor = userEvent.setup();
    renderProfile(updateProfile);

    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    await actor.upload(screen.getByLabelText("Upload photo"), file);

    await waitFor(() =>
      expect(screen.getByRole("img", { name: "Test User avatar" })).toHaveAttribute(
        "src",
        "data:image/jpeg;base64,avatar"
      )
    );

    await actor.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test User",
          email: "user@test.com",
          avatar: "data:image/jpeg;base64,avatar",
        })
      )
    );
  });

  it("removes the uploaded photo before saving", async () => {
    const updateProfile = vi.fn().mockResolvedValue({ success: true });
    const actor = userEvent.setup();
    renderProfile(updateProfile);

    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    await actor.upload(screen.getByLabelText("Upload photo"), file);
    await screen.findByRole("button", { name: /remove photo/i });

    await actor.click(screen.getByRole("button", { name: /remove photo/i }));
    await actor.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ avatar: "" })
      )
    );
  });
});
