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
  const category = searchParams.get('category') ?? '';
  const status = searchParams.get('status') ?? '';
  const search = searchParams.get('search') ?? '';
  const sortField = searchParams.get('sortField') ?? searchParams.get('sort_field') ?? '';
  const sortOrder = searchParams.get('sortOrder') ?? searchParams.get('sort_order') ?? '';
  const dateFrom = searchParams.get('date_from') ?? '';
  const dateTo = searchParams.get('date_to') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const size = Math.min(100, Math.max(1, parseInt(searchParams.get('size') ?? '20', 10)));
  const offset = (page - 1) * size;

  const backend = getBackendUrl();
  const caseParams = new URLSearchParams();
  caseParams.set('limit', String(size));
  caseParams.set('offset', String(offset));
  if (category) caseParams.set('category', category);
  if (status) caseParams.set('status', status);
  if (search) caseParams.set('search', search);
  if (sortField) caseParams.set('sort_field', sortField);
  if (sortOrder) caseParams.set('sort_order', sortOrder);
  if (dateFrom) caseParams.set('date_from', dateFrom);
  if (dateTo) caseParams.set('date_to', dateTo);

  try {
    const [casesRes, usersRes] = await Promise.all([
      fetch(`${backend}/api/v1/cases?${caseParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${backend}/api/v1/users`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    if (!casesRes.ok) {
      const err = await casesRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: (err?.error as string) || 'Gagal memuat berkas' },
        { status: casesRes.status }
      );
    }

    const casesData = await casesRes.json();
    const data = casesData.data ?? [];
    const total = casesData.total ?? 0;

    let userNames: Record<string, string> = {};
    if (usersRes.ok) {
      const users = await usersRes.json();
      if (Array.isArray(users)) {
        users.forEach((u: { id?: string; name?: string; email?: string }) => {
          if (u.id) userNames[u.id] = (u.name?.trim() || u.email || u.id) as string;
        });
      }
    }

    const enriched = data.map((row: { staf_penanggung_jawab_id?: string | null }) => ({
      ...row,
      pic_name: row.staf_penanggung_jawab_id ? (userNames[row.staf_penanggung_jawab_id] ?? row.staf_penanggung_jawab_id) : '',
    }));

    return NextResponse.json({ data: enriched, totalCount: total });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Gagal memuat berkas' },
      { status: 500 }
    );
  }
}
