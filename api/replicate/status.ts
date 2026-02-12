/**
 * Vercel Serverless Function - Replicate Status 查询
 * 处理 /api/replicate/status/:id
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const REPLICATE_API_BASE = 'https://api.replicate.com/v1';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return res.status(500).json({ error: 'REPLICATE_API_TOKEN not configured' });

  try {
    // 从查询参数或 URL 路径获取 id
    const url = new URL(req.url || '', `https://${req.headers.host}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // /api/replicate/status/abc123 → pathParts = ['api', 'replicate', 'status', 'abc123']
    const id = pathParts[3] || (req.query.id as string);

    if (!id) {
      return res.status(400).json({ error: 'Missing prediction id' });
    }

    const response = await fetch(`${REPLICATE_API_BASE}/predictions/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error: any) {
    console.error('[Replicate Status] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to check status' });
  }
}
