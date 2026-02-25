'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/components/layouts/layout-10/components/toolbar';
import { useAuth } from '@/providers/auth-provider';
import {
  getUsersApi,
  getRolesApi,
  createUserApi,
  updateUserApi,
  type RoleItem,
  type CreateUserBody,
  type UpdateUserBody,
} from '@/lib/api';
import type { UserResponse } from '@/lib/auth-types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABLE_ID = 'kt_datatable_users';

export default function UsersPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>(''); // '' = all, 'active' | 'inactive'

  const isAdmin = user?.role_name === 'admin';

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [userList, roleList] = await Promise.all([
        getUsersApi(token),
        getRolesApi(token),
      ]);
      setUsers(userList);
      setRoles(roleList);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const filteredUsers = useMemo(() => {
    let list = users;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          (u.name ?? '').toLowerCase().includes(q) ||
          (u.email ?? '').toLowerCase().includes(q)
      );
    }
    if (roleFilter) {
      list = list.filter((u) => u.role_id === roleFilter);
    }
    if (statusFilter === 'active') {
      list = list.filter((u) => u.active !== false);
    } else if (statusFilter === 'inactive') {
      list = list.filter((u) => u.active === false);
    }
    return list;
  }, [users, searchQuery, roleFilter, statusFilter]);

  const columns = useMemo<ColumnDef<UserResponse>[]>(
    () => [
      { accessorKey: 'name', header: 'Nama', cell: ({ getValue }) => getValue<string>() || '-' },
      { accessorKey: 'email', header: 'Email', cell: ({ getValue }) => getValue<string>() || '-' },
      { accessorKey: 'role_name', header: 'Role', cell: ({ getValue }) => getValue<string>() || '-' },
      {
        accessorKey: 'active',
        header: 'Status',
        cell: ({ getValue }) => {
          const active = getValue<boolean>();
          const label = active === false ? 'Nonaktif' : 'Aktif';
          const cls = active === false ? 'kt-badge kt-badge-secondary' : 'kt-badge kt-badge-success';
          return <span className={cls}>{label}</span>;
        },
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            title="Edit"
            aria-label="Edit"
            onClick={() => setEditUser(row.original)}
          >
            <Pencil className="size-4" />
          </Button>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredUsers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/dashboard');
      return;
    }
    loadUsers();
  }, [isAdmin, router, loadUsers]);

  if (!isAdmin) return null;

  const pagination = table.getState().pagination;
  const pageSize = pagination.pageSize;
  const pageIndex = pagination.pageIndex;
  const totalRows = filteredUsers.length;
  const start = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min((pageIndex + 1) * pageSize, totalRows);
  const pageCount = table.getPageCount();

  return (
    <>
      <Toolbar>
        <ToolbarHeading title="Manajemen User" />
        <ToolbarActions>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="me-2 size-4" />
            Tambah User
          </Button>
        </ToolbarActions>
      </Toolbar>

      <div className="container">
        {error && (
          <p className="mb-4 text-destructive">{error}</p>
        )}

        <div className="grid w-full space-y-5">
          <div className="kt-card">
            <div className="kt-card-header flex flex-row items-center justify-between gap-4 py-4 min-h-14 border-b border-border">
              <div className="relative w-full max-w-sm shrink-0">
                <Search className="pointer-events-none size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama atau email..."
                  className="kt-input h-9 w-full pl-9 pr-3"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select
                  value={roleFilter || 'all'}
                  onValueChange={(v) => setRoleFilter(v === 'all' ? '' : v)}
                >
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Semua role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua role</SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={statusFilter || 'all'}
                  onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}
                >
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Semua status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua status</SelectItem>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="inactive">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
                {(searchQuery.trim() || roleFilter || statusFilter) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 shrink-0 text-muted-foreground"
                    onClick={() => {
                      setSearchQuery('');
                      setRoleFilter('');
                      setStatusFilter('');
                    }}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
            <div id={TABLE_ID} className="kt-card-table">
              <div className="kt-table-wrapper kt-scrollable overflow-x-auto">
                <table className="kt-table w-full align-middle">
                  <thead>
                    <tr>
                      <th scope="col" className="w-[200px]">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Nama</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-48">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Email</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-32">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Role</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-28">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Status</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="text-center text-muted-foreground py-8">
                          Memuat...
                        </td>
                      </tr>
                    ) : table.getRowModel().rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-muted-foreground py-8">
                          Belum ada user.
                        </td>
                      </tr>
                    ) : (
                      table.getRowModel().rows.map((row) => (
                        <tr key={row.id}>
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="align-middle">
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="kt-datatable-toolbar">
                <div className="kt-datatable-length flex flex-wrap items-center gap-2">
                  Tampilkan
                  <select
                    className="kt-select kt-select-sm w-16"
                    value={pageSize}
                    onChange={(e) =>
                      table.setPageSize(Number(e.target.value))
                    }
                  >
                    {[10, 20, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  per halaman
                </div>
                <div className="kt-datatable-info flex flex-wrap items-center gap-2">
                  <span>
                    {totalRows === 0
                      ? '0 data'
                      : `${start}-${end} dari ${totalRows}`}
                  </span>
                  {pageCount > 1 && (() => {
                    const limit = 5;
                    const groupStart = Math.floor(pageIndex / limit) * limit;
                    const groupEnd = Math.min(groupStart + limit, pageCount);
                    return (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => table.previousPage()}
                          disabled={!table.getCanPreviousPage()}
                        >
                          <ChevronLeft className="size-4" />
                        </Button>
                        {groupStart > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-7 min-w-7 p-0 text-sm"
                            onClick={() => table.setPageIndex(groupStart - 1)}
                          >
                            ...
                          </Button>
                        )}
                        {Array.from({ length: groupEnd - groupStart }, (_, i) => groupStart + i).map((i) => (
                          <Button
                            key={i}
                            variant="ghost"
                            size="sm"
                            className={cn(
                              'size-7 min-w-7 p-0 text-sm',
                              pageIndex === i && 'bg-accent text-accent-foreground'
                            )}
                            onClick={() => table.setPageIndex(i)}
                          >
                            {i + 1}
                          </Button>
                        ))}
                        {groupEnd < pageCount && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-7 min-w-7 p-0 text-sm"
                            onClick={() => table.setPageIndex(groupEnd)}
                          >
                            ...
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => table.nextPage()}
                          disabled={!table.getCanNextPage()}
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        officeId={user?.office_id ?? ''}
        roles={roles}
        token={token}
        onSuccess={() => {
          setCreateOpen(false);
          loadUsers();
        }}
      />

      {editUser && (
        <EditUserDialog
          open={!!editUser}
          onOpenChange={(open) => !open && setEditUser(null)}
          user={editUser}
          roles={roles}
          token={token}
          onSuccess={() => {
            setEditUser(null);
            loadUsers();
          }}
        />
      )}
    </>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  officeId,
  roles,
  token,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  officeId: string;
  roles: RoleItem[];
  token: string | null;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = useCallback(() => {
    setEmail('');
    setPassword('');
    setName('');
    setRoleId('');
    setErr(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !email.trim() || !password.trim()) {
      setErr('Email dan password wajib.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const body: CreateUserBody = {
        office_id: officeId,
        email: email.trim(),
        password,
        name: name.trim() || undefined,
        role_id: roleId || undefined,
      };
      await createUserApi(token, body);
      reset();
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal membuat user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {err && <p className="text-sm text-destructive">{err}</p>}
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Password</Label>
              <Input
                id="create-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-name">Nama</Label>
              <Input
                id="create-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama lengkap"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  open,
  onOpenChange,
  user,
  roles,
  token,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserResponse;
  roles: RoleItem[];
  token: string | null;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(user.name ?? '');
  const [roleId, setRoleId] = useState<string>(user.role_id ?? '');
  const [active, setActive] = useState(user.active !== false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setErr(null);
    try {
      const body: UpdateUserBody = {
        name: name.trim() || undefined,
        role_id: roleId || undefined,
        active,
      };
      await updateUserApi(token, user.id, body);
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memperbarui user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {err && <p className="text-sm text-destructive">{err}</p>}
            <p className="text-sm text-muted-foreground">Email: {user.email}</p>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nama</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama lengkap"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="edit-active">Aktif</Label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
