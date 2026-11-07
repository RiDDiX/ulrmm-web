// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// One file in parts the server appends as they arrive, so a broken
// connection or a pause costs at most the part in flight. The requests come
// from the caller (src/api/packages.js).
//
// Nothing is aborted: the axios boot reads a cancelled request as "server
// offline", so pause and cancel take effect once the part in flight is done.

export type UploadId = string | number;

export interface UploadSession {
  id: UploadId;
  chunk_size: number;
  received: number;
}

export interface ChunkApi {
  // null when the step-up prompt was cancelled
  start(): Promise<UploadSession | null>;
  status(id: UploadId): Promise<{ received: number }>;
  put(
    id: UploadId,
    chunk: Blob,
    start: number,
    onProgress: (loaded: number) => void,
  ): Promise<{ received?: number } | null | undefined>;
  remove(id: UploadId): Promise<unknown>;
}

export type UploadState =
  | "idle"
  | "uploading"
  | "retrying"
  | "pausing"
  | "paused"
  | "failed"
  | "uploaded"
  | "cancelled";

export interface UploadProgress {
  state: UploadState;
  sent: number;
  total: number;
  // try of the current part after a failure, 0 while none
  retry: number;
  error: unknown;
}

export const CHUNK_RETRIES = 3;
export const RETRY_DELAYS_MS = [2000, 5000, 15000];

type HttpError = { response?: { status?: number; data?: unknown } };

const statusOf = (e: unknown) => (e as HttpError)?.response?.status;

// no answer, timeouts, rate limits and server errors are worth another try
export function retryable(e: unknown): boolean {
  const status = statusOf(e);
  return (
    status === undefined || status === 408 || status === 429 || status >= 500
  );
}

// 409 {received}: where the server stands
function conflictOffset(e: unknown): number | null {
  if (statusOf(e) !== 409) return null;
  const received = ((e as HttpError).response?.data as { received?: unknown })
    ?.received;
  return typeof received === "number" ? received : null;
}

// an offset from the server the loop can count on
const isOffset = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);

function offsetOf(reply: { received?: unknown } | null | undefined): number {
  if (!isOffset(reply?.received))
    throw new Error("The server did not say how much it received");
  return reply.received;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createChunkedUpload(
  file: Blob,
  api: ChunkApi,
  onChange: (progress: UploadProgress) => void,
  wait: (ms: number) => Promise<void> = sleep,
) {
  const total = file.size;
  let id: UploadId | null = null;
  let chunkSize = 0;
  let received = 0;
  let inFlight = 0;
  let state: UploadState = "idle";
  let retry = 0;
  let error: unknown = null;
  let stop: "pause" | "cancel" | null = null;
  let running: Promise<boolean> | null = null;
  // 409s in a row; a server that keeps moving the offset ends the upload
  let conflicts = 0;

  const emit = () =>
    onChange({
      state,
      sent: Math.min(received + inFlight, total),
      total,
      retry,
      error,
    });
  const set = (next: UploadState) => {
    state = next;
    emit();
  };

  async function sendPart(uploadId: UploadId) {
    for (let attempt = 0; ; attempt++) {
      const start = received;
      const end = Math.min(start + chunkSize, total);
      try {
        const reply = await api.put(
          uploadId,
          file.slice(start, end),
          start,
          (loaded) => {
            inFlight = Math.min(loaded, end - start);
            emit();
          },
        );
        inFlight = 0;
        received = offsetOf(reply);
        conflicts = 0;
        retry = 0;
        return;
      } catch (e) {
        inFlight = 0;
        const offset = conflictOffset(e);
        if (
          offset !== null &&
          offset !== start &&
          ++conflicts <= CHUNK_RETRIES
        ) {
          received = offset;
          return;
        }
        if (!retryable(e) || attempt >= CHUNK_RETRIES) throw e;
        if (stop) return;
        retry = attempt + 1;
        set("retrying");
        await wait(RETRY_DELAYS_MS[attempt] ?? 15000);
        try {
          // the part may have landed before the answer got lost
          received = offsetOf(await api.status(uploadId));
        } catch {
          // the next part gets a 409 if the server is further
        }
        if (stop) return;
        set("uploading");
        // the server moved on: the next part starts with fresh tries
        if (received !== start) return;
      }
    }
  }

  async function removeQuietly() {
    if (id === null) return;
    const gone = id;
    id = null;
    try {
      await api.remove(gone);
    } catch {
      // the server drops stale uploads after a day
    }
  }

  async function loop(): Promise<boolean> {
    stop = null;
    error = null;
    retry = 0;
    set("uploading");
    try {
      if (id === null) {
        const session = await api.start();
        if (!session) {
          set("idle");
          return false;
        }
        if (
          !(Number.isFinite(session.chunk_size) && session.chunk_size > 0) ||
          !isOffset(session.received)
        )
          throw new Error("Upload session is invalid");
        id = session.id;
        chunkSize = Math.max(1, session.chunk_size);
        received = session.received;
      } else {
        received = offsetOf(await api.status(id));
      }
      while (received < total && !stop) await sendPart(id);
    } catch (e) {
      if (stop !== "cancel") {
        error = e;
        set("failed");
        return false;
      }
    }
    if (stop === "cancel") {
      await removeQuietly();
      set("cancelled");
      return false;
    }
    if (received < total) {
      set("paused");
      return false;
    }
    set("uploaded");
    return true;
  }

  return {
    // starts or resumes; true once every byte is on the server
    run(): Promise<boolean> {
      if (state === "cancelled") return Promise.resolve(false);
      running ??= loop().finally(() => (running = null));
      return running;
    },
    pause() {
      if (state !== "uploading" && state !== "retrying") return;
      stop = "pause";
      set("pausing");
    },
    // removes the upload on the server; a part in flight finishes first
    async cancel() {
      stop = "cancel";
      if (running) {
        await running;
        return;
      }
      await removeQuietly();
      set("cancelled");
    },
    get id() {
      return id;
    },
  };
}

export type ChunkedUpload = ReturnType<typeof createChunkedUpload>;
