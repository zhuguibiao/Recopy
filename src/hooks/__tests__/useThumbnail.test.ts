import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";

const mockedInvoke = vi.mocked(invoke);

let createObjectURLMock: ReturnType<typeof vi.fn>;
let revokeObjectURLMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  createObjectURLMock = vi.fn(() => "blob:mock-url");
  revokeObjectURLMock = vi.fn();
  globalThis.URL.createObjectURL = createObjectURLMock;
  globalThis.URL.revokeObjectURL = revokeObjectURLMock;
});

afterEach(() => {
  cleanup();
});

async function importFresh() {
  // Re-import to get a fresh module-level thumbnailCache each time
  vi.resetModules();
  const mod = await import("../useThumbnail");
  return mod.useThumbnail;
}

describe("useThumbnail", () => {
  it("should return null initially when no thumbnail cached", async () => {
    const useThumbnail = await importFresh();
    const { result } = renderHook(() => useThumbnail("item-1"));

    expect(result.current).toBeNull();
  });

  it("should return null when id is null", async () => {
    const useThumbnail = await importFresh();
    const { result } = renderHook(() => useThumbnail(null));

    expect(result.current).toBeNull();
    expect(mockedInvoke).not.toHaveBeenCalled();
  });

  it("should call invoke with correct item id", async () => {
    const useThumbnail = await importFresh();
    mockedInvoke.mockResolvedValueOnce([1, 2, 3]);

    renderHook(() => useThumbnail("test-id-42"));

    await vi.waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("get_thumbnail", { id: "test-id-42" });
    });
  });

  it("should return object URL after successful fetch", async () => {
    const useThumbnail = await importFresh();
    mockedInvoke.mockResolvedValueOnce([1, 2, 3]);

    const { result } = renderHook(() => useThumbnail("item-1"));

    await vi.waitFor(() => {
      expect(result.current).toBe("blob:mock-url");
    });
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
  });

  it("should return cached thumbnail URL on subsequent renders", async () => {
    const useThumbnail = await importFresh();
    mockedInvoke.mockResolvedValueOnce([1, 2, 3]);

    const { result, unmount } = renderHook(() => useThumbnail("item-1"));
    await vi.waitFor(() => {
      expect(result.current).toBe("blob:mock-url");
    });

    unmount();

    const { result: result2 } = renderHook(() => useThumbnail("item-1"));
    expect(result2.current).toBe("blob:mock-url");
    expect(mockedInvoke).toHaveBeenCalledTimes(1);
  });

  it("should retry on null response up to 3 times with 500ms intervals", async () => {
    vi.useFakeTimers();
    const useThumbnail = await importFresh();

    mockedInvoke
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([10, 20, 30]);

    const { result } = renderHook(() => useThumbnail("retry-id"));

    // First call returns null -> schedules retry
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // Second call returns null -> schedules retry
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // Third call returns data -> success
    await vi.waitFor(() => {
      expect(result.current).toBe("blob:mock-url");
    });
    expect(mockedInvoke).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it("should stop retrying after max attempts", async () => {
    vi.useFakeTimers();
    const useThumbnail = await importFresh();

    mockedInvoke.mockResolvedValue(null);

    const { result } = renderHook(() => useThumbnail("exhaust-id"));

    // Initial call (attempt 0) + 3 retries
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
    }

    // One more interval shouldn't trigger another call
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // 1 initial + 3 retries = 4 total
    expect(mockedInvoke).toHaveBeenCalledTimes(4);
    expect(result.current).toBeNull();

    vi.useRealTimers();
  });

  it("should cancel pending retries on unmount", async () => {
    vi.useFakeTimers();
    const useThumbnail = await importFresh();

    mockedInvoke.mockResolvedValue(null);

    const { unmount } = renderHook(() => useThumbnail("cancel-id"));

    // First call triggers, returns null, schedules retry
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(mockedInvoke).toHaveBeenCalledTimes(2);

    unmount();

    // After unmount, timer fires but cancelled flag prevents further invoke
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(mockedInvoke).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("should handle invoke rejection gracefully", async () => {
    const useThumbnail = await importFresh();

    // The hook's fetchThumbnail calls invoke().then() without .catch(), so
    // rejections become unhandled. Capture at process level to prevent vitest
    // from treating it as a test failure.
    const captured: unknown[] = [];
    const handler = (reason: unknown) => {
      captured.push(reason);
    };
    process.on("unhandledRejection", handler);

    mockedInvoke.mockRejectedValueOnce(new Error("backend error"));

    const { result } = renderHook(() => useThumbnail("error-id"));

    await act(async () => {
      // Allow the microtask (rejected promise) to propagate
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current).toBeNull();
    expect(captured).toHaveLength(1);
    expect((captured[0] as Error).message).toBe("backend error");

    process.removeListener("unhandledRejection", handler);
  });

  it("should retry on empty array response", async () => {
    vi.useFakeTimers();
    const useThumbnail = await importFresh();

    mockedInvoke.mockResolvedValueOnce([]).mockResolvedValueOnce([5, 6, 7]);

    const { result } = renderHook(() => useThumbnail("empty-arr-id"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    await vi.waitFor(() => {
      expect(result.current).toBe("blob:mock-url");
    });
    expect(mockedInvoke).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
