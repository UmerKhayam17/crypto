import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FaceVideoRecorder } from "../routes/kyc";

describe("FaceVideoRecorder camera access", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window.navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
  });

  it("shows a friendly error when getUserMedia is unavailable", async () => {
    render(<FaceVideoRecorder dataUrl="" onChange={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /enable camera/i }));

    expect(await screen.findByText(/Camera access is not supported/i)).toBeInTheDocument();
  });
});
