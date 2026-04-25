import type { JSX } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppErrorBoundary } from "./AppErrorBoundary";

function BrokenComponent(): JSX.Element {
  throw new Error("boom");
}

describe("AppErrorBoundary", () => {
  it("런타임 오류가 나면 폴백 UI를 보여주고 다시 시도 버튼을 노출한다", async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <AppErrorBoundary>
        <BrokenComponent />
      </AppErrorBoundary>,
    );

    expect(await screen.findByText("화면을 불러오다 오류가 발생했습니다")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(screen.getByText("화면을 불러오다 오류가 발생했습니다")).toBeInTheDocument();

    consoleError.mockRestore();
  });
});
