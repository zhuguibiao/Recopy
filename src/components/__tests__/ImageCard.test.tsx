import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ImageCard } from "../ImageCard";
import type { ClipboardItem } from "../../lib/types";

const mockItem = (overrides: Partial<ClipboardItem> = {}): ClipboardItem => ({
  id: "img-1",
  content_type: "image",
  plain_text: "",
  source_app: "com.test",
  source_app_name: "Preview",
  content_size: 102400,
  content_hash: "img-hash",
  is_favorited: false,
  created_at: "2026-02-23 10:00:00",
  updated_at: "2026-02-23 10:00:00",
  ...overrides,
});

describe("ImageCard", () => {
  it("renders image type label and size", () => {
    render(<ImageCard item={mockItem()} selected={false} onClick={vi.fn()} />);
    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(screen.getByText("100.0 KB")).toBeInTheDocument();
    expect(screen.getByText("Preview")).toBeInTheDocument();
  });

  it("renders placeholder when no thumbnail", () => {
    const { container } = render(
      <ImageCard item={mockItem()} selected={false} onClick={vi.fn()} />
    );
    // No img element
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders thumbnail image when available", () => {
    // 1x1 transparent PNG bytes
    const pngBytes = [
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
    ];
    const { container } = render(
      <ImageCard
        item={mockItem({ thumbnail: pngBytes })}
        selected={false}
        onClick={vi.fn()}
      />
    );
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img?.src).toContain("blob:");
  });
});
