import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../api";
import { renderWithProviders } from "../test/renderWithProviders";
import { NewProjectPage } from "./NewProjectPage";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../api", () => ({
  api: {
    createProject: vi.fn(),
    uploadProjectVideo: vi.fn(),
  },
}));

describe("NewProjectPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.mocked(api.createProject).mockReset();
    vi.mocked(api.uploadProjectVideo).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows inline validation when a non-video file is selected", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = renderWithProviders(<NewProjectPage />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, new File(["hello"], "episode.mp4", { type: "text/plain" }));

    expect(screen.getByText(/selected file type is not supported/i)).toBeInTheDocument();
  });

  it("shows an inline upload failure notice when the backend rejects the file", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createProject).mockResolvedValue({ id: 17 } as never);
    vi.mocked(api.uploadProjectVideo).mockRejectedValue(new Error("Upload failed from API"));

    const { container } = renderWithProviders(<NewProjectPage />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const titleInput = screen.getAllByPlaceholderText(/Podcast episode/i)[0];

    await user.type(titleInput, "Failure case");
    await user.upload(input, new File(["video"], "episode.mp4", { type: "video/mp4" }));
    await user.click(screen.getByRole("button", { name: /Create Project/i }));

    expect((await screen.findAllByText("Video upload failed")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Upload failed from API").length).toBeGreaterThan(0);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("navigates to the project detail page after a successful upload", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createProject).mockResolvedValue({ id: 24 } as never);
    vi.mocked(api.uploadProjectVideo).mockResolvedValue({ id: 24 } as never);

    const { container } = renderWithProviders(<NewProjectPage />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const titleInput = screen.getAllByPlaceholderText(/Podcast episode/i)[0];

    await user.type(titleInput, "Success case");
    await user.upload(input, new File(["video"], "episode.mp4", { type: "video/mp4" }));
    await user.click(screen.getByRole("button", { name: /Create Project/i }));

    await waitFor(() => {
      expect(api.createProject).toHaveBeenCalled();
      expect(api.uploadProjectVideo).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith("/projects/24");
    });
  });
});
