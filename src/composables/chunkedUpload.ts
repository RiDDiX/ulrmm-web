// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// The progress state and the run tail of a chunked upload form; the caller
// brings the requests and shows the error where its form shows errors.

import { computed, reactive, shallowRef } from "vue";
import { serverErrors } from "@/components/vault/stepUp";
import { fmtBytes } from "@/utils/format";
import {
  createChunkedUpload,
  type ChunkApi,
  type ChunkedUpload,
  type UploadProgress,
} from "@/utils/chunkedUpload";

export function useChunkedUpload() {
  const up = reactive<UploadProgress>({
    state: "idle",
    sent: 0,
    total: 0,
    retry: 0,
    error: null,
  });
  // set while an upload exists on the server and is not finished yet
  const uploader = shallowRef<ChunkedUpload | null>(null);

  const percent = computed(() =>
    up.total ? Math.floor((up.sent / up.total) * 100) : 0,
  );
  const uploading = computed(() =>
    ["uploading", "retrying", "pausing"].includes(up.state),
  );
  const progressText = computed(() => {
    const amount = `${fmtBytes(up.sent)} of ${fmtBytes(up.total)} uploaded (${percent.value} %)`;
    switch (up.state) {
      case "retrying":
        return `Connection problem, try ${up.retry} of 3 for this part... ${amount}`;
      case "pausing":
        return `Pausing after the current part... ${amount}`;
      case "paused":
        return `Paused, ${amount}. Resume continues from there.`;
      case "failed":
        return `${serverErrors(up.error).message} Resume continues at ${fmtBytes(up.sent)}.`;
      case "uploaded":
        return `${fmtBytes(up.total)} uploaded.`;
      default:
        return amount;
    }
  });

  // starts or resumes; the upload once every byte is on the server, else null
  async function run(
    file: File,
    api: ChunkApi,
    onError: (message: string) => void,
  ): Promise<ChunkedUpload | null> {
    const current = (uploader.value ??= createChunkedUpload(file, api, (p) =>
      Object.assign(up, p),
    ));
    const done = await current.run();
    // cancelled meanwhile
    if (uploader.value !== current) return null;
    if (done) return current;
    // nothing stored yet: the code prompt was cancelled or the server refused
    // the upload (e.g. no room); the file can be changed again
    if (current.id === null && up.state !== "paused") {
      if (up.state === "failed") onError(serverErrors(up.error).message);
      uploader.value = null;
    }
    return null;
  }

  return { up, uploader, percent, uploading, progressText, run };
}
