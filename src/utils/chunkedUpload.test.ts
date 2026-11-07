// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { describe, expect, it, vi } from "vitest";
import {
  createChunkedUpload,
  type ChunkApi,
  type UploadProgress,
  type UploadSession,
} from "@/utils/chunkedUpload";

const conflict = (received: number) => ({
  response: { status: 409, data: { received } },
});

// 30 bytes in parts of 10; put answers come from the list, in order
function upload(session: Partial<UploadSession>, answers: (() => unknown)[]) {
  const api: ChunkApi = {
    start: vi.fn(async () => ({ id: 1, received: 0, ...session }) as never),
    status: vi.fn(async () => ({ received: 0 })),
    put: vi.fn(async () => {
      const answer = answers.shift();
      if (!answer) throw new Error("no more answers");
      return answer() as { received: number };
    }),
    remove: vi.fn(async () => undefined),
  };
  const seen: UploadProgress[] = [];
  const up = createChunkedUpload(
    new Blob(["x".repeat(30)]),
    api,
    (p) => seen.push({ ...p }),
    async () => {},
  );
  return { api, up, last: () => seen[seen.length - 1] };
}

const starts = (api: ChunkApi) =>
  vi.mocked(api.put).mock.calls.map(([, , start]) => start);

describe("createChunkedUpload", () => {
  it("resumes at the offset of a 409", async () => {
    const { api, up, last } = upload({ chunk_size: 10 }, [
      () => {
        throw conflict(20);
      },
      () => ({ received: 30 }),
    ]);
    expect(await up.run()).toBe(true);
    expect(starts(api)).toEqual([0, 20]);
    expect(last().state).toBe("uploaded");
  });

  it.each([
    ["no chunk_size", {}],
    ["chunk_size 0", { chunk_size: 0 }],
    ["chunk_size NaN", { chunk_size: NaN }],
    ["received missing", { chunk_size: 10, received: undefined }],
  ])("rejects a session with %s", async (_, session) => {
    const { api, up, last } = upload(session, []);
    expect(await up.run()).toBe(false);
    expect(last().state).toBe("failed");
    expect((last().error as Error).message).toBe("Upload session is invalid");
    expect(api.put).not.toHaveBeenCalled();
  });

  it.each([
    ["the offset the part started at", [0, 0, 0], [0]],
    ["an offset that keeps moving", [1, 2, 3, 4, 5], [0, 1, 2, 3]],
  ])("fails on 409s with %s", async (_, offsets, expected) => {
    const { api, up, last } = upload(
      { chunk_size: 10 },
      offsets.map((n) => () => {
        throw conflict(n);
      }),
    );
    expect(await up.run()).toBe(false);
    expect(last().state).toBe("failed");
    expect(last().error).toMatchObject({ response: { status: 409 } });
    expect(starts(api)).toEqual(expected);
  });

  it("fails when part answers keep missing the offset", async () => {
    const { api, up, last } = upload(
      { chunk_size: 10 },
      Array.from({ length: 4 }, () => () => ({})),
    );
    expect(await up.run()).toBe(false);
    expect(starts(api)).toEqual([0, 0, 0, 0]);
    expect((last().error as Error).message).toBe(
      "The server did not say how much it received",
    );
  });
});
