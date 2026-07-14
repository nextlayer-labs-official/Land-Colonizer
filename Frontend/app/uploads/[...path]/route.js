const BACKEND = process.env.BACKEND_INTERNAL_URL || 'http://localhost:4000';

export async function GET(request, { params }) {
  const filePath = (await params).path.join('/');
  try {
    const upstream = await fetch(`${BACKEND}/uploads/${filePath}`, { cache: 'no-store' });
    if (!upstream.ok) return new Response('Not found', { status: 404 });
    const body = await upstream.arrayBuffer();
    const contentType = upstream.headers.get('Content-Type') || 'application/octet-stream';
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
