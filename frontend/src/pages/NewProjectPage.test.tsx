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
    ingestProjectYouTube: vi.fn(),
  },
}));

describe("NewProjectPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.mocked(api.createProject).mockReset();
    vi.mocked(api.uploadProjectVideo).mockReset();
    vi.mocked(api.ingestProjectYouTube).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("비디오가 아닌 파일을 선택하면 인라인 검증 메시지를 보여준다", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = renderWithProviders(<NewProjectPage />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, new File(["hello"], "episode.mp4", { type: "text/plain" }));

    expect(screen.getByText(/선택한 파일 형식은 지원하지 않습니다/i)).toBeInTheDocument();
  });

  it("백엔드가 업로드를 거부하면 인라인 오류 안내를 보여준다", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createProject).mockResolvedValue({ id: 17 } as never);
    vi.mocked(api.uploadProjectVideo).mockRejectedValue(new Error("Upload failed from API"));

    const { container } = renderWithProviders(<NewProjectPage />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const titleInput = screen.getByPlaceholderText(/마이클 타이슨 경기 분석 숏츠/i);

    await user.type(titleInput, "Failure case");
    await user.upload(input, new File(["video"], "episode.mp4", { type: "video/mp4" }));
    await user.click(screen.getByRole("button", { name: /프로젝트 만들기/i }));

    expect((await screen.findAllByText("영상 업로드에 실패했습니다")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Upload failed from API").length).toBeGreaterThan(0);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("업로드가 성공하면 프로젝트 상세 화면으로 이동한다", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createProject).mockResolvedValue({ id: 24 } as never);
    vi.mocked(api.uploadProjectVideo).mockResolvedValue({ id: 24 } as never);

    const { container } = renderWithProviders(<NewProjectPage />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const titleInput = screen.getByPlaceholderText(/마이클 타이슨 경기 분석 숏츠/i);

    await user.type(titleInput, "Success case");
    await user.upload(input, new File(["video"], "episode.mp4", { type: "video/mp4" }));
    await user.click(screen.getByRole("button", { name: /프로젝트 만들기/i }));

    await waitFor(() => {
      expect(api.createProject).toHaveBeenCalled();
      expect(api.uploadProjectVideo).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith("/projects/24");
    });
  });

  it("유튜브 링크 모드에서 링크 가져오기가 성공하면 프로젝트 상세 화면으로 이동한다", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createProject).mockResolvedValue({ id: 41 } as never);
    vi.mocked(api.ingestProjectYouTube).mockResolvedValue({ id: 41 } as never);

    renderWithProviders(<NewProjectPage />);

    await user.click(screen.getByRole("button", { name: /youtube 링크/i }));
    await user.type(screen.getByPlaceholderText(/마이클 타이슨 경기 분석 숏츠/i), "Tyson YouTube import");
    await user.type(screen.getByPlaceholderText(/https:\/\/www\.youtube\.com\/watch\?v=/i), "https://www.youtube.com/watch?v=abc123xyz");
    await user.click(screen.getByRole("button", { name: /프로젝트 만들기/i }));

    await waitFor(() => {
      expect(api.createProject).toHaveBeenCalledWith({ title: "Tyson YouTube import", source_type: "youtube" });
      expect(api.ingestProjectYouTube).toHaveBeenCalledWith(41, "https://www.youtube.com/watch?v=abc123xyz");
      expect(navigateMock).toHaveBeenCalledWith("/projects/41");
    });
  });

  it("유튜브 링크가 잘못되면 인라인 오류를 보여준다", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewProjectPage />);

    await user.click(screen.getByRole("button", { name: /youtube 링크/i }));
    await user.type(screen.getByPlaceholderText(/마이클 타이슨 경기 분석 숏츠/i), "Bad URL");
    await user.type(screen.getByPlaceholderText(/https:\/\/www\.youtube\.com\/watch\?v=/i), "https://vimeo.com/12345");
    await user.click(screen.getByRole("button", { name: /프로젝트 만들기/i }));

    expect(screen.getByText(/YouTube watch 링크 또는 Shorts 링크를 입력해 주세요/i)).toBeInTheDocument();
    expect(api.createProject).not.toHaveBeenCalled();
  });
});
