import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AuthQuerySync from "@/components/AuthQuerySync";

type AuthState = {
  loading: boolean;
  userId: string | null;
};

const authState: AuthState = {
  loading: true,
  userId: null,
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    loading: authState.loading,
    session: authState.userId ? { user: { id: authState.userId } } : null,
  }),
}));

function renderSync(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthQuerySync />
    </QueryClientProvider>,
  );
}

describe("AuthQuerySync", () => {
  it("clears cache when user changes and does not clear repeatedly for same user", () => {
    const queryClient = new QueryClient();
    const clearSpy = vi.spyOn(queryClient, "clear");

    authState.loading = false;
    authState.userId = "user-a";
    const { rerender } = renderSync(queryClient);

    expect(clearSpy).not.toHaveBeenCalled();

    authState.userId = "user-a";
    rerender(
      <QueryClientProvider client={queryClient}>
        <AuthQuerySync />
      </QueryClientProvider>,
    );
    expect(clearSpy).not.toHaveBeenCalled();

    authState.userId = "user-b";
    rerender(
      <QueryClientProvider client={queryClient}>
        <AuthQuerySync />
      </QueryClientProvider>,
    );
    expect(clearSpy).toHaveBeenCalledTimes(1);

    authState.userId = "user-b";
    rerender(
      <QueryClientProvider client={queryClient}>
        <AuthQuerySync />
      </QueryClientProvider>,
    );
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it("clears on logout transition", () => {
    const queryClient = new QueryClient();
    const clearSpy = vi.spyOn(queryClient, "clear");

    authState.loading = false;
    authState.userId = "user-a";
    const { rerender } = renderSync(queryClient);

    authState.userId = null;
    rerender(
      <QueryClientProvider client={queryClient}>
        <AuthQuerySync />
      </QueryClientProvider>,
    );

    expect(clearSpy).toHaveBeenCalledTimes(1);
  });
});
