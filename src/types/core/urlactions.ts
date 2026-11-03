// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

export type URLActionType = "web" | "rest";

export type RESTMethodType = "get" | "post" | "put" | "delete" | "patch";

// pattern, body and headers may hold {{placeholders}} the server fills in
interface URLActionTemplate {
  pattern: string;
  rest_method: RESTMethodType;
  rest_body: string;
  rest_headers: string;
}

export interface URLAction extends URLActionTemplate {
  id: number;
  name: string;
  desc?: string;
  action_type: URLActionType;
}

type RunInstance = {
  run_instance_type: string;
  run_instance_id: number | null;
};

export type TestRunURLActionRequest = URLActionTemplate & RunInstance;

export interface TestRunURLActionResponse {
  url: string;
  body: string;
  result: string;
}
