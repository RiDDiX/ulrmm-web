// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

export interface User {
  id: number;
  username: string;
  name: string;
  email: string;
}

type Lifetime = { created: string; expiry: string };

// one login session as the sessions table lists it
export interface AuthToken extends Lifetime {
  user: string;
  digest: string;
}
