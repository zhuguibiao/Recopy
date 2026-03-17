import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { FavoriteStar } from "../FavoriteStar";
import { useClipboardStore } from "../../stores/clipboard-store";

const mockedInvoke = vi.mocked(invoke);

describe("FavoriteStar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refreshes via refreshOnChange instead of resetting search results", async () => {
    mockedInvoke.mockResolvedValue(true);

    const refreshOnChange = vi.fn().mockResolvedValue(undefined);
    const fetchItems = vi.fn().mockResolvedValue(undefined);
    const fetchFavorites = vi.fn().mockResolvedValue(undefined);

    useClipboardStore.setState({
      viewMode: "history",
      searchQuery: "needle",
      refreshOnChange,
      fetchItems,
      fetchFavorites,
    } as never);

    render(<FavoriteStar itemId="item-1" isFavorited={false} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Add to favorites"));
    });

    expect(mockedInvoke).toHaveBeenCalledWith("toggle_favorite", { id: "item-1" });
    expect(refreshOnChange).toHaveBeenCalledTimes(1);
    expect(fetchItems).not.toHaveBeenCalled();
    expect(fetchFavorites).not.toHaveBeenCalled();
  });
});
