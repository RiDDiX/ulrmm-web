// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { fetchIsoLibrary, fetchIsoProgress } from "@/api/deploy";
import { useIsoDownloads } from "@/stores/isoDownloads";

vi.mock("@/api/deploy", () => ({
  fetchIsoLibrary: vi.fn(),
  fetchIsoProgress: vi.fn(),
  startIsoDownload: vi.fn(),
  cancelIsoDownload: vi.fn(),
  retryIsoDownload: vi.fn(),
  isoFitsFamily: vi.fn(),
}));

const library = vi.mocked(fetchIsoLibrary);
const active = [{ id: 1, status: "downloading" }] as never;

describe("useIsoDownloads", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    library.mockReset();
    vi.mocked(fetchIsoProgress).mockResolvedValue([]);
  });
  afterEach(() => {
    useIsoDownloads().stop();
    vi.useRealTimers();
  });

  it("ignores a reply that arrives after a newer one", async () => {
    const dl = useIsoDownloads();
    let answerOld: (rows: never) => void = () => {};
    library.mockReturnValueOnce(new Promise((r) => (answerOld = r)));
    library.mockResolvedValueOnce([{ id: 2, status: "ready" }] as never);
    const older = dl.refresh();
    await dl.refresh();
    answerOld(active);
    await older;
    expect(dl.library.map((i) => i.id)).toEqual([2]);
    expect(dl.loading).toBe(false);
  });

  it("polls again after 5 s when a refresh fails, else after 1 s", async () => {
    const dl = useIsoDownloads();
    library.mockResolvedValueOnce(active);
    await dl.refresh();
    library.mockRejectedValueOnce(new Error("down"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(library).toHaveBeenCalledTimes(2);
    expect(dl.error).toBe("down");
    library.mockResolvedValue(active);
    await vi.advanceTimersByTimeAsync(4999);
    expect(library).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(library).toHaveBeenCalledTimes(3);
    expect(dl.error).toBe("");
  });
});
