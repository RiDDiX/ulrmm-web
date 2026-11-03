// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// asset and worker imports resolved by vite

declare module "*?worker" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workerConstructor: any;
  export default workerConstructor;
}

declare module "*.png" {
  const url: string;
  export default url;
}
