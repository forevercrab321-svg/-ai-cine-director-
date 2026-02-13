import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { geminiRouter } from '../server/routes/gemini';
import { replicateRouter } from '../server/routes/replicate';
import fetch from 'node-fetch';

// Polyfill fetch for Node environment
if (!globalThis.fetch) {
    // @ts-ignore
    globalThis.fetch = fetch;
    // @ts-ignore
    globalThis.Headers = fetch.Headers;
    // @ts-ignore
    globalThis.Request = fetch.Request;
    // @ts-ignore
    globalThis.Response = fetch.Response;
}

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/gemini', geminiRouter);
app.use('/api/replicate', replicateRouter);

// Health Check
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        geminiKey: !!process.env.GEMINI_API_KEY ? '✅ configured' : '❌ missing',
        replicateToken: !!process.env.REPLICATE_API_TOKEN ? '✅ configured' : '❌ missing',
    });
});

export default app;
