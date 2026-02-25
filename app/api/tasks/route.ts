import { NextRequest, NextResponse } from 'next/server';

const getBackendUrl = () => {
  const base = process.env.NEXT_PUBLIC_API_URL;
  return base ? base.replace(/\/$/, '') : 'http://localhost:8080';
};

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = auth.slice(7);
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const size = Math.min(100, Math.max(1, parseInt(searchParams.get('size') ?? '20', 10)));
  const offset = (page - 1) * size;
  const status = searchParams.get('status') ?? '';
  const dueFrom = searchParams.get('due_from') ?? '';
  const dueTo = searchParams.get('due_to') ?? '';
  const search = searchParams.get('search') ?? '';
  const sortField = searchParams.get('sortField') ?? '';
  const sortOrder = searchParams.get('sortOrder') ?? '';

  const backend = getBackendUrl();
  const params = new URLSearchParams();
  params.set('limit', String(size));
  params.set('offset', String(offset));
  if (status) params.set('status', status);
  if (dueFrom) params.set('due_from', dueFrom);
  if (dueTo) params.set('due_to', dueTo);
  if (search) params.set('search', search);
  if (sortField) params.set('sort_field', sortField);
  if (sortOrder) params.set('sort_order', sortOrder);

  try {
    const res = await fetch(`${backend}/api/v1/tasks?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: (err?.error as string) || 'Gagal memuat daftar tugas' },
        { status: res.status }
      );
    }

    const json = await res.json();
    const data = json.data ?? [];
    const total = json.total ?? 0;

    return NextResponse.json({ data, totalCount: total });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Gagal memuat daftar tugas' },
      { status: 500 }
    );
  }
}
