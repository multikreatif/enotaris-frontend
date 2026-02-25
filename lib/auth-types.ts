/**
 * Types matching enotaris-services auth API.
 */

export interface LoginRequest {
  office_id: string;
  email: string;
  password: string;
}

export interface UserResponse {
  id: string;
  office_id: string;
  email: string;
  name: string;
  role_id?: string;
  role_name?: string;
  active?: boolean;
}

export interface LoginResult {
  token: string;
  expires_at: string;
  user: UserResponse;
}
