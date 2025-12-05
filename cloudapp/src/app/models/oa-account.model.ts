export interface OAAccount {
  id: string;
  username: string;
  status: 'active' | 'pending' | 'suspended';
  expiry: string;
  attributes: {
    forenames: string;
    surname: string;
    emailAddress: string;
    uniqueEmailAddress?: string;
  };
  groups: string[];
  permissionSets: string[];
}

export interface OAVerifyRequest {
  username?: string;
  email?: string;
}

export interface OAVerifyResponse {
  found: boolean;
  normalizedUsername: string | null;
  raw: any;
}

export interface OAGetRequest {
  username?: string;
  email?: string;
}

export interface OAGetResponse {
  account: OAAccount;
  normalizedUsername: string | null;
}

export interface OAAccountCreate {
  username?: string;
  email: string;
  first_name: string;
  last_name: string;
  expires: string;
  alma_group_key?: string;
  alma_group_code?: string;
  password?: string;
  status?: 'active' | 'pending';
  groups?: string[];
  permissionSets?: string[];
}

export interface OAAccountCreateResponse {
  /** True if a new OA account was created */
  created: boolean;

  /** True if no new account was created because one already exists */
  alreadyExists?: boolean;

  /** Full raw OA account object from the Admin API */
  raw: any;

  /** Normalized summary used by the UI */
  summary?: {
    id: string;
    username: string;
    status: string;
    expiry: string;
    activationCode?: string | null;
    activationExpires?: string | null;
    groups?: string[];
    permissionSets?: string[];
  };

  /** Optional applied policy from OA, if your proxy exposes it */
  appliedPolicy?: any;

  /** Optional explanation when created === false (e.g. "uniqueEmailAddress in use") */
  reason?: string;
}

export interface OAAccountModify {
  openathens_id?: string;
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  expires?: string;
  status?: 'active' | 'suspended' | 'pending';
  alma_group_key?: string;
  alma_group_code?: string;
  groups?: string[];
  permissionSets?: string[];
}

export interface OAAccountModifyResponse {
  modified: boolean;
  id: string;
  raw: any;
  appliedPolicy: any;
}

export interface OAResendRequest {
  openathens_id?: string;
  username?: string;
  email?: string;
}

export interface OAResendResponse {
  resent: boolean;
  id: string;
  raw: any;
}

export interface OAEnvResponse {
  allowed: string[];
  base: string;
  tenant: string;
  hasKey: boolean;
}
