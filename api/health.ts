/**
 * Vercel Serverless Function - Health Check
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
    res.json({
        status: 'ok',
        geminiKey: !!process.env.GEMINI_API_KEY ? '✅ configured' : '❌ missing',
        replicateToken: !!process.env.REPLICATE_API_TOKEN ? '✅ configured' : '❌ missing',
    });
}
