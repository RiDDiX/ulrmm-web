// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import "axios";

// request options read by the response interceptor in boot/axios.js
declare module "axios" {
  interface AxiosRequestConfig {
    // no error toast, the caller shows the failure
    silent?: boolean;
    // a 401 does not send the browser to /expired
    noAuthRedirect?: boolean;
  }
}
