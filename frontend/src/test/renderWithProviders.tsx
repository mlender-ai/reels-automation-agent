import { render, type RenderOptions } from "@testing-library/react";
import type { PropsWithChildren, ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";

import { ToastProvider } from "../components/ToastProvider";

type ProviderOptions = RenderOptions & {
  route?: string;
};

function Providers({ children, route = "/" }: PropsWithChildren<{ route?: string }>) {
  return (
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>{children}</ToastProvider>
    </MemoryRouter>
  );
}

export function renderWithProviders(ui: ReactElement, options: ProviderOptions = {}) {
  const { route, ...rest } = options;
  return render(ui, {
    wrapper: ({ children }) => <Providers route={route}>{children}</Providers>,
    ...rest,
  });
}
