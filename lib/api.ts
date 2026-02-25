/**
 * API client for enotaris-services.
 * Uses NEXT_PUBLIC_API_URL (e.g. http://localhost:8080).
 */

import type { LoginRequest, LoginResult, UserResponse } from './auth-types';

const getApiUrl = (): string => {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    if (typeof window !== 'undefined') {
      return '';
    }
    return 'http://localhost:8080';
  }
  return base.replace(/\/$/, '');
};

/**
 * Fetch to API with optional Bearer token.
 */
export async function apiFetch(
  path: string,
  init?: RequestInit,
  token?: string | null,
): Promise<Response> {
  const base = getApiUrl();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...init, headers });
}

/**
 * POST /api/v1/auth/login
 */
export async function loginApi(body: LoginRequest): Promise<LoginResult> {
  const res = await apiFetch('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data?.error === 'string' ? data.error : 'Login failed';
    throw new Error(message);
  }
  return data as LoginResult;
}

/**
 * POST /api/v1/auth/logout (requires Bearer token).
 */
export async function logoutApi(token: string): Promise<void> {
  const res = await apiFetch('/api/v1/auth/logout', { method: 'POST' }, token);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data?.error === 'string' ? data.error : 'Logout failed');
  }
}

export interface OfficeItem {
  id: string;
  name: string;
}

/** Profile kantor notaris (GET/PUT /api/v1/offices/current). */
export interface OfficeProfile {
  id: string;
  name: string;
  address: string;
  active: boolean;
  nama_notaris: string;
  sk_notaris: string;
  npwp: string;
  phone: string;
  email: string;
}

/** Body untuk update profile kantor + metadata notaris. */
export interface UpdateOfficeBody {
  name: string;
  address?: string;
  nama_notaris?: string;
  sk_notaris?: string;
  npwp?: string;
  phone?: string;
  email?: string;
}

/**
 * GET /api/v1/offices — list active offices (for signin dropdown).
 */
export async function getOfficesApi(): Promise<OfficeItem[]> {
  const res = await apiFetch('/api/v1/offices', { method: 'GET' });
  const data = await res.json().catch(() => []);
  if (!res.ok) {
    throw new Error(Array.isArray(data) ? 'Failed to load offices' : (data?.error as string) || 'Failed to load offices');
  }
  return Array.isArray(data) ? data : [];
}

/** GET /api/v1/offices/current — get current office profile (kantor notaris, from JWT). */
export async function getCurrentOfficeApi(token: string | null): Promise<OfficeProfile> {
  const res = await apiFetch('/api/v1/offices/current', { method: 'GET' }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Gagal memuat profile kantor');
  return data as OfficeProfile;
}

/** PUT /api/v1/offices/current — update current office profile + metadata notaris (admin only). */
export async function updateOfficeApi(
  token: string | null,
  body: UpdateOfficeBody
): Promise<OfficeProfile> {
  const res = await apiFetch('/api/v1/offices/current', { method: 'PUT', body: JSON.stringify(body) }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Gagal menyimpan profile kantor');
  return data as OfficeProfile;
}

export interface RoleItem {
  id: string;
  name: string;
  description?: string;
}

/** GET /api/v1/roles — list roles (current office from JWT). */
export async function getRolesApi(token: string | null): Promise<RoleItem[]> {
  const res = await apiFetch('/api/v1/roles', { method: 'GET' }, token);
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data?.error as string) || 'Failed to load roles');
  return Array.isArray(data) ? data : [];
}

/** GET /api/v1/users — list users (admin only, office from JWT). */
export async function getUsersApi(token: string | null): Promise<UserResponse[]> {
  const res = await apiFetch('/api/v1/users', { method: 'GET' }, token);
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data?.error as string) || 'Failed to load users');
  return Array.isArray(data) ? data : [];
}

export interface CreateUserBody {
  office_id: string;
  email: string;
  password: string;
  name?: string;
  role_id?: string;
}

/** POST /api/v1/users — create user (admin only). */
export async function createUserApi(token: string | null, body: CreateUserBody): Promise<UserResponse> {
  const res = await apiFetch('/api/v1/users', { method: 'POST', body: JSON.stringify(body) }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Failed to create user');
  return data as UserResponse;
}

export interface UpdateUserBody {
  name?: string;
  role_id?: string;
  active?: boolean;
}

/** PUT /api/v1/users/:id — update user (admin only). */
export async function updateUserApi(
  token: string | null,
  userId: string,
  body: UpdateUserBody
): Promise<UserResponse> {
  const res = await apiFetch(`/api/v1/users/${userId}`, { method: 'PUT', body: JSON.stringify(body) }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Failed to update user');
  return data as UserResponse;
}

// --- Jenis Pekerjaan (manajemen pekerjaan per kantor) ---

export type JenisPekerjaanCategory = 'notaris' | 'ppat' | 'pengurusan';

export interface JenisPekerjaanResponse {
  id: string;
  office_id: string;
  name: string;
  singkatan?: string | null;
  category: JenisPekerjaanCategory;
  biaya?: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/** GET /api/v1/jenis-pekerjaan — list (optional category filter). */
export async function getJenisPekerjaanApi(
  token: string | null,
  params?: { category?: JenisPekerjaanCategory }
): Promise<JenisPekerjaanResponse[]> {
  const sp = new URLSearchParams();
  if (params?.category) sp.set('category', params.category);
  const q = sp.toString();
  const path = q ? `/api/v1/jenis-pekerjaan?${q}` : '/api/v1/jenis-pekerjaan';
  const res = await apiFetch(path, { method: 'GET' }, token);
  const data = await res.json().catch(() => ([]));
  if (!res.ok) throw new Error((typeof data?.error === 'string' ? data.error : 'Gagal memuat jenis pekerjaan') as string);
  return Array.isArray(data) ? data : [];
}

/** GET /api/v1/jenis-pekerjaan/:id */
export async function getJenisPekerjaanByIdApi(token: string | null, id: string): Promise<JenisPekerjaanResponse> {
  const res = await apiFetch(`/api/v1/jenis-pekerjaan/${id}`, { method: 'GET' }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Jenis pekerjaan tidak ditemukan');
  return data as JenisPekerjaanResponse;
}

export interface CreateJenisPekerjaanBody {
  name: string;
  singkatan?: string | null;
  category: JenisPekerjaanCategory;
  biaya?: number | null;
  active?: boolean;
}

/** POST /api/v1/jenis-pekerjaan — create (admin). */
export async function createJenisPekerjaanApi(
  token: string | null,
  body: CreateJenisPekerjaanBody
): Promise<JenisPekerjaanResponse> {
  const res = await apiFetch('/api/v1/jenis-pekerjaan', { method: 'POST', body: JSON.stringify(body) }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Gagal membuat jenis pekerjaan');
  return data as JenisPekerjaanResponse;
}

export interface UpdateJenisPekerjaanBody {
  name?: string | null;
  singkatan?: string | null;
  category?: JenisPekerjaanCategory | null;
  biaya?: number | null;
  active?: boolean | null;
}

/** PUT /api/v1/jenis-pekerjaan/:id — update (admin). */
export async function updateJenisPekerjaanApi(
  token: string | null,
  id: string,
  body: UpdateJenisPekerjaanBody
): Promise<JenisPekerjaanResponse> {
  const res = await apiFetch(`/api/v1/jenis-pekerjaan/${id}`, { method: 'PUT', body: JSON.stringify(body) }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Gagal memperbarui jenis pekerjaan');
  return data as JenisPekerjaanResponse;
}

// --- Clients (klien notaris/PPAT) ---

export type ClientType = 'individual' | 'entity';

export interface ClientResponse {
  id: string;
  office_id: string;
  type: ClientType;
  full_name: string;
  nik?: string | null;
  npwp?: string | null;
  place_of_birth?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  religion?: string | null;
  marital_status?: string | null;
  occupation?: string | null;
  nationality?: string | null;
  establishment_deed_number?: string | null;
  establishment_date?: string | null;
  nib?: string | null;
  contact_person_name?: string | null;
  address_line?: string | null;
  kelurahan?: string | null;
  kecamatan?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  email?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListClientsResult {
  data: ClientResponse[];
  total: number;
}

/** GET /api/v1/clients — list clients (paginated). */
export async function getClientsApi(
  token: string | null,
  params?: { limit?: number; offset?: number }
): Promise<ListClientsResult> {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));
  const q = sp.toString();
  const path = q ? `/api/v1/clients?${q}` : '/api/v1/clients';
  const res = await apiFetch(path, { method: 'GET' }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Gagal memuat klien');
  return { data: data.data ?? [], total: data.total ?? 0 };
}

/** GET /api/v1/clients/:id */
export async function getClientApi(token: string | null, id: string): Promise<ClientResponse> {
  const res = await apiFetch(`/api/v1/clients/${id}`, { method: 'GET' }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Klien tidak ditemukan');
  return data as ClientResponse;
}

export interface CreateClientBody {
  type: ClientType;
  full_name: string;
  nik?: string | null;
  npwp?: string | null;
  place_of_birth?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  religion?: string | null;
  marital_status?: string | null;
  occupation?: string | null;
  nationality?: string | null;
  establishment_deed_number?: string | null;
  establishment_date?: string | null;
  nib?: string | null;
  contact_person_name?: string | null;
  address_line?: string | null;
  kelurahan?: string | null;
  kecamatan?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  email?: string | null;
}

/** POST /api/v1/clients — create client (office from JWT). */
export async function createClientApi(
  token: string | null,
  body: CreateClientBody
): Promise<ClientResponse> {
  const res = await apiFetch('/api/v1/clients', { method: 'POST', body: JSON.stringify(body) }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Gagal membuat klien');
  return data as ClientResponse;
}

export interface UpdateClientBody {
  full_name?: string | null;
  nik?: string | null;
  npwp?: string | null;
  place_of_birth?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  religion?: string | null;
  marital_status?: string | null;
  occupation?: string | null;
  nationality?: string | null;
  establishment_deed_number?: string | null;
  establishment_date?: string | null;
  nib?: string | null;
  contact_person_name?: string | null;
  address_line?: string | null;
  kelurahan?: string | null;
  kecamatan?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  email?: string | null;
}

/** PUT /api/v1/clients/:id */
export async function updateClientApi(
  token: string | null,
  clientId: string,
  body: UpdateClientBody
): Promise<ClientResponse> {
  const res = await apiFetch(`/api/v1/clients/${clientId}`, { method: 'PUT', body: JSON.stringify(body) }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Gagal memperbarui klien');
  return data as ClientResponse;
}

// --- Cases (perkara/berkas akta) & Tasks (CLIO_ADAPT) ---

export type CaseStatus = 'drafting' | 'signed' | 'registered' | 'closed';
export type CaseCategory = 'notaris' | 'ppat';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked' | 'waiting';

// --- Dashboard aggregate stats ---

export interface DashboardCaseCounts {
  drafting: number;
  signed: number;
  registered: number;
  closed: number;
  closed_this_month: number;
}

export interface DashboardCaseTypeItem {
  jenis_akta: string;
  count: number;
}

export interface DashboardTaskStats {
  overdue: number;
  due_today: number;
}

export interface DashboardStats {
  case_counts: DashboardCaseCounts;
  cases_by_type: DashboardCaseTypeItem[];
  tasks: DashboardTaskStats;
  generated_at: string;
}

/** GET /api/v1/dashboard/stats — aggregate stats per office for main dashboard. */
export async function getDashboardStatsApi(token: string | null): Promise<DashboardStats> {
  const res = await apiFetch('/api/v1/dashboard/stats', { method: 'GET' }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data?.error as string) || 'Gagal memuat statistik dashboard');
  }
  return data as DashboardStats;
}

export interface CaseResponse {
  id: string;
  office_id: string;
  category: CaseCategory;
  nomor_draft: string;
  jenis_akta: string;
  nama_para_pihak: string;
  staf_penanggung_jawab_id?: string | null;
  status: CaseStatus;
  tanggal_mulai?: string | null;
  target_selesai?: string | null;
  nilai_transaksi?: number | null;
  jenis_pekerjaan_ppat?: string | null;
  luas_tanah_m2?: number | null;
  luas_bangunan_m2?: number | null;
  njop?: number | null;
  nop?: string | null;
  tahun_nop?: string | null;
  created_at: string;
  updated_at: string;
  /** Tahapan yang sedang berjalan (status proses). Hanya ada di response list cases. */
  current_task_name?: string | null;
  /** Nama klien dari case parties (list). */
  nama_klien?: string | null;
  /** Nama PIC (staf penanggung jawab). */
  staf_penanggung_jawab_name?: string | null;
  /** Singkatan jenis pekerjaan (untuk badge). */
  jenis_pekerjaan_singkatan?: string | null;
  /** Tanggal terakhir task yang status selesai (ISO string). */
  last_done_task_at?: string | null;
  /** Persentase progress tahapan (0-100). */
  progress_percent?: number | null;
}

export interface TaskResponse {
  id: string;
  case_id: string;
  nama_task: string;
  assigned_to?: string | null;
  due_date?: string | null;
  status: TaskStatus;
  blocked_note?: string | null;
  priority: number;
  sort_order: number;
  depends_on_task_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListCasesResult {
  data: CaseResponse[];
  total: number;
}

/** GET /api/v1/cases */
export async function getCasesApi(
  token: string | null,
  params?: { limit?: number; offset?: number; status?: string; category?: CaseCategory; hide_closed_older_than_months?: number }
): Promise<ListCasesResult> {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));
  if (params?.status) sp.set('status', params.status);
  if (params?.category) sp.set('category', params.category);
  if (params?.hide_closed_older_than_months != null) sp.set('hide_closed_older_than_months', String(params.hide_closed_older_than_months));
  const q = sp.toString();
  const path = q ? `/api/v1/cases?${q}` : '/api/v1/cases';
  const res = await apiFetch(path, { method: 'GET' }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Gagal memuat perkara');
  return { data: data.data ?? [], total: data.total ?? 0 };
}

/** GET /api/v1/cases/:id */
export async function getCaseApi(token: string | null, id: string): Promise<CaseResponse> {
  const res = await apiFetch(`/api/v1/cases/${id}`, { method: 'GET' }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Perkara tidak ditemukan');
  return data as CaseResponse;
}

export interface CreateCaseBody {
  category?: CaseCategory;
  nomor_draft?: string;
  jenis_akta: string;
  nama_para_pihak?: string;
  staf_penanggung_jawab_id?: string | null;
  status?: CaseStatus;
  tanggal_mulai?: string | null;
  target_selesai?: string | null;
  nilai_transaksi?: number | null;
  parties?: { client_id: string; role: string }[];
  task_names?: string[];
  workflow_template_id?: string;
  // PPAT
  jenis_pekerjaan_ppat?: string;
  luas_tanah_m2?: number | null;
  luas_bangunan_m2?: number | null;
  njop?: number | null;
  nop?: string | null;
  tahun_nop?: string | null;
}

/** POST /api/v1/cases */
export async function createCaseApi(token: string | null, body: CreateCaseBody): Promise<CaseResponse> {
  const res = await apiFetch('/api/v1/cases', { method: 'POST', body: JSON.stringify(body) }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Gagal membuat perkara');
  return data as CaseResponse;
}

export interface UpdateCaseBody {
  category?: CaseCategory | null;
  nomor_draft?: string | null;
  jenis_akta?: string | null;
  nama_para_pihak?: string | null;
  staf_penanggung_jawab_id?: string | null;
  status?: CaseStatus | null;
  tanggal_mulai?: string | null;
  target_selesai?: string | null;
  nilai_transaksi?: number | null;
}

/** PUT /api/v1/cases/:id */
export async function updateCaseApi(
  token: string | null,
  caseId: string,
  body: UpdateCaseBody
): Promise<CaseResponse> {
  const res = await apiFetch(`/api/v1/cases/${caseId}`, { method: 'PUT', body: JSON.stringify(body) }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Gagal memperbarui perkara');
  return data as CaseResponse;
}

/** GET /api/v1/tasks — list all tasks (notaris: all; staff: only assigned). */
export interface TaskListItem {
  id: string;
  case_id: string;
  nama_task: string;
  status: string;
  due_date?: string | null;
  assigned_to?: string | null;
  assigned_to_name?: string;
  assigned_by_name?: string;
  case_nama_para_pihak?: string;
  case_nomor_draft?: string;
  depends_on_task_id?: string | null;
  time_estimate?: string;
  created_at: string;
  updated_at: string;
}

export interface ListTasksResult {
  data: TaskListItem[];
  total: number;
}

export async function getTasksListApi(
  token: string | null,
  params?: { limit?: number; offset?: number; status?: string; due_from?: string; due_to?: string }
): Promise<ListTasksResult> {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));
  if (params?.status) sp.set('status', params.status);
  if (params?.due_from) sp.set('due_from', params.due_from);
  if (params?.due_to) sp.set('due_to', params.due_to);
  const q = sp.toString();
  const path = q ? `/api/v1/tasks?${q}` : '/api/v1/tasks';
  const res = await apiFetch(path, { method: 'GET' }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Gagal memuat daftar tugas');
  return { data: data.data ?? [], total: data.total ?? 0 };
}

/** GET /api/v1/cases/:case_id/tasks */
export async function getTasksByCaseApi(token: string | null, caseId: string): Promise<TaskResponse[]> {
  const res = await apiFetch(`/api/v1/cases/${caseId}/tasks`, { method: 'GET' }, token);
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data?.error as string) || 'Gagal memuat tahapan');
  return Array.isArray(data) ? data : [];
}

export interface CreateTaskBody {
  case_id: string;
  nama_task: string;
  description?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
  priority?: number;
  sort_order?: number;
  depends_on_task_id?: string | null;
}

/** POST /api/v1/tasks */
export async function createTaskApi(token: string | null, body: CreateTaskBody): Promise<TaskResponse> {
  const res = await apiFetch('/api/v1/tasks', { method: 'POST', body: JSON.stringify(body) }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Gagal membuat tahapan');
  return data as TaskResponse;
}

export interface UpdateTaskBody {
  nama_task?: string | null;
  description?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
  status?: TaskStatus | null;
  blocked_note?: string | null;
  priority?: number | null;
  sort_order?: number | null;
}

/** PUT /api/v1/tasks/:id */
export async function updateTaskApi(
  token: string | null,
  taskId: string,
  body: UpdateTaskBody
): Promise<TaskResponse> {
  const res = await apiFetch(`/api/v1/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(body) }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Gagal memperbarui tahapan');
  return data as TaskResponse;
}

/** POST /api/v1/cases/:id/apply-workflow-template — append tasks from template to case */
export async function applyWorkflowTemplateToCaseApi(
  token: string | null,
  caseId: string,
  body: { workflow_template_id: string }
): Promise<void> {
  const res = await apiFetch(`/api/v1/cases/${caseId}/apply-workflow-template`, { method: 'POST', body: JSON.stringify(body) }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Gagal menerapkan template');
}

export interface TaskHistoryItem {
  id: string;
  task_id: string;
  field: string;
  old_value?: string;
  new_value?: string;
  changed_by?: string;
  created_at: string;
}

/** GET /api/v1/tasks/:id/history */
export async function getTaskHistoryApi(token: string | null, taskId: string): Promise<TaskHistoryItem[]> {
  const res = await apiFetch(`/api/v1/tasks/${taskId}/history`, { method: 'GET' }, token);
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(Array.isArray(data) ? 'Gagal memuat riwayat' : (data?.error as string) || 'Gagal memuat riwayat');
  return Array.isArray(data) ? data : [];
}

// --- Workflow templates (admin kantor) ---

export interface WorkflowTemplateStepItem {
  id: string;
  nama_task: string;
  sort_order: number;
  assignee_default_id?: string | null;
  due_date_rule?: string;
  sla_days?: number | null;
  status_suggestion?: string;
}

export interface WorkflowTemplateItem {
  id: string;
  office_id: string;
  name: string;
  category: string;
  jenis_pekerjaan?: string;
  description?: string;
  steps?: WorkflowTemplateStepItem[];
  created_at: string;
  updated_at: string;
}

/** GET /api/v1/workflow-templates */
export async function getWorkflowTemplatesApi(
  token: string | null,
  params?: { category?: string; jenis_pekerjaan?: string }
): Promise<WorkflowTemplateItem[]> {
  const sp = new URLSearchParams();
  if (params?.category) sp.set('category', params.category);
  if (params?.jenis_pekerjaan) sp.set('jenis_pekerjaan', params.jenis_pekerjaan);
  const q = sp.toString();
  const path = q ? `/api/v1/workflow-templates?${q}` : '/api/v1/workflow-templates';
  const res = await apiFetch(path, { method: 'GET' }, token);
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(Array.isArray(data) ? 'Gagal memuat template workflow' : (data?.error as string) || 'Gagal memuat template workflow');
  return Array.isArray(data) ? data : [];
}

export interface CreateWorkflowTemplateStepBody {
  nama_task: string;
  sort_order?: number;
  assignee_default_id?: string | null;
  due_date_rule?: string;
  sla_days?: number | null;
  status_suggestion?: string;
}

export interface CreateWorkflowTemplateBody {
  name: string;
  category?: string;
  jenis_pekerjaan?: string;
  description?: string;
  steps: CreateWorkflowTemplateStepBody[];
}

/** POST /api/v1/workflow-templates */
export async function createWorkflowTemplateApi(
  token: string | null,
  body: CreateWorkflowTemplateBody
): Promise<WorkflowTemplateItem> {
  const res = await apiFetch('/api/v1/workflow-templates', { method: 'POST', body: JSON.stringify(body) }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Gagal membuat template workflow');
  return data as WorkflowTemplateItem;
}

// --- Schedule / Calendar events ---

export type ScheduleEventType = 'plotting' | 'tanda_tangan_akad' | 'batas_pajak' | 'lainnya';

export interface ScheduleEventItem {
  id: string;
  office_id: string;
  case_id?: string | null;
  task_id?: string | null;
  title: string;
  description?: string;
  location?: string;
  event_type: ScheduleEventType;
  start_at: string;
  end_at?: string | null;
  all_day: boolean;
  reminder_minutes_before?: number | null;
  created_at: string;
  updated_at: string;
}

/** GET /api/v1/schedule-events?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function getScheduleEventsApi(
  token: string | null,
  params: { from: string; to: string; case_id?: string; task_id?: string }
): Promise<ScheduleEventItem[]> {
  const sp = new URLSearchParams({ from: params.from, to: params.to });
  if (params.case_id) sp.set('case_id', params.case_id);
  if (params.task_id) sp.set('task_id', params.task_id);
  const res = await apiFetch(`/api/v1/schedule-events?${sp}`, { method: 'GET' }, token);
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(Array.isArray(data) ? 'Gagal memuat jadwal' : (data?.error as string) || 'Gagal memuat jadwal');
  return Array.isArray(data) ? data : [];
}

export interface CreateScheduleEventBody {
  title: string;
  description?: string;
  location?: string;
  event_type?: ScheduleEventType;
  start_at: string;
  end_at?: string;
  all_day?: boolean;
  reminder_minutes_before?: number | null;
  case_id?: string;
  task_id?: string;
}

/** POST /api/v1/schedule-events */
export async function createScheduleEventApi(
  token: string | null,
  body: CreateScheduleEventBody
): Promise<ScheduleEventItem> {
  const res = await apiFetch('/api/v1/schedule-events', { method: 'POST', body: JSON.stringify(body) }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Gagal membuat jadwal');
  return data as ScheduleEventItem;
}

export interface UpdateScheduleEventBody {
  title?: string;
  description?: string;
  location?: string | null;
  event_type?: ScheduleEventType;
  start_at?: string;
  end_at?: string | null;
  all_day?: boolean;
  reminder_minutes_before?: number | null;
  case_id?: string | null;
  task_id?: string | null;
}

/** PUT /api/v1/schedule-events/:id */
export async function updateScheduleEventApi(
  token: string | null,
  id: string,
  body: UpdateScheduleEventBody
): Promise<ScheduleEventItem> {
  const res = await apiFetch(`/api/v1/schedule-events/${id}`, { method: 'PUT', body: JSON.stringify(body) }, token);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) || 'Gagal memperbarui jadwal');
  return data as ScheduleEventItem;
}

/** DELETE /api/v1/schedule-events/:id */
export async function deleteScheduleEventApi(token: string | null, id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/schedule-events/${id}`, { method: 'DELETE' }, token);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data?.error as string) || 'Gagal menghapus jadwal');
  }
}
