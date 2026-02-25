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
  const search = searchParams.get('search') ?? '';
  const type = searchParams.get('type') ?? '';
  const dateFrom = searchParams.get('date_from') ?? '';
  const dateTo = searchParams.get('date_to') ?? '';

  const backend = getBackendUrl();
  const params = new URLSearchParams();
  params.set('limit', String(size));
  params.set('offset', String(offset));
  if (search) params.set('search', search);
  if (type) params.set('type', type);
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);

  try {
    const res = await fetch(`${backend}/api/v1/clients?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: (err?.error as string) || 'Gagal memuat klien' },
        { status: res.status }
      );
    }

    const json = await res.json();
    const raw = json.data ?? [];
    const total = json.total ?? 0;

    const data = raw.map((row: { type?: string; nik?: string | null; npwp?: string | null; phone?: string | null; email?: string | null; updated_at?: string | null }) => ({
      ...row,
      type_label: row.type === 'entity' ? 'Badan Hukum' : 'Perorangan',
      nik_npwp: [row.nik, row.npwp].filter(Boolean).join(' / ') || '-',
      kontak: [row.phone, row.email].filter(Boolean).join(' · ') || '-',
      last_activity: row.updated_at || null,
    }));

    return NextResponse.json({ data, totalCount: total });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Gagal memuat klien' },
      { status: 500 }
    );
  }
}
