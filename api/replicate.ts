/**
 * Vercel Serverless Function - Replicate API 代理
 * 处理 /api/replicate/predict
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const REPLICATE_API_BASE = 'https://api.replicate.com/v1';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return res.status(500).json({ error: 'REPLICATE_API_TOKEN not configured' });

    try {
        const { version, input } = req.body;
        if (!version || !input) {
            return res.status(400).json({ error: 'Missing version or input' });
        }

        const isModelPath = version.includes('/') && !version.match(/^[a-f0-9]{64}$/);
        let targetUrl: string;

        if (isModelPath) {
            targetUrl = `${REPLICATE_API_BASE}/models/${version}/predictions`;
        } else {
            targetUrl = `${REPLICATE_API_BASE}/predictions`;
        }

        // Vercel serverless 有 60s 超时，尝试最多 2 次
        const maxRetries = 2;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Prefer: 'wait',
                },
                body: JSON.stringify(isModelPath ? { input } : { version, input }),
            });

            if (response.status === 429 && attempt < maxRetries) {
                let retryAfter = 5;
                try {
                    const errData = JSON.parse(await response.text());
                    retryAfter = errData.retry_after || 5;
                } catch { }
                await new Promise(r => setTimeout(r, (Number(retryAfter) + 1) * 1000));
                continue;
            }

            if (!response.ok) {
                const errText = await response.text();
                return res.status(response.status).json({ error: errText });
            }

            const data = await response.json();
            return res.json(data);
        }

        return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    } catch (error: any) {
        console.error('[Replicate] Error:', error.message);
        return res.status(500).json({ error: error.message || 'Replicate prediction failed' });
    }
}
