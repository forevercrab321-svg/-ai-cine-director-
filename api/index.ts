import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import fetch from 'node-fetch';

// --- Polyfills ---
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

// --- Configuration ---
dotenv.config({ path: '.env.local' });
const app = express();

// --- Middleware ---
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// --- Helpers ---
const getGeminiAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured on server');
    return new GoogleGenAI({ apiKey });
};

const getReplicateToken = () => {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) throw new Error('REPLICATE_API_TOKEN not configured on server');
    return token;
};

// --- Gemini Logic ---
const geminiResponseSchema = {
    type: Type.OBJECT,
    properties: {
        project_title: { type: Type.STRING },
        visual_style: { type: Type.STRING },
        character_anchor: { type: Type.STRING },
        scenes: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    scene_number: { type: Type.INTEGER },
                    visual_description: { type: Type.STRING },
                    audio_description: { type: Type.STRING },
                    shot_type: { type: Type.STRING },
                },
                required: ['scene_number', 'visual_description', 'audio_description', 'shot_type'],
            },
        },
    },
    required: ['project_title', 'visual_style', 'character_anchor', 'scenes'],
};

// POST /api/gemini/generate
app.post('/api/gemini/generate', async (req, res) => {
    try {
        const { storyIdea, visualStyle, language, identityAnchor } = req.body;
        if (!storyIdea) return res.status(400).json({ error: 'Missing storyIdea' });

        const ai = getGeminiAI();
        const systemInstruction = `
**Role:** Professional Hollywood Screenwriter & Director of Photography.
**Task:** Break down the User's Story Concept into a production-ready script with 5 distinct scenes.

**CORE PHILOSOPHY: THE ANCHOR METHOD**
1. **Character Continuity:** ${identityAnchor ? `The character is LOCKED to: "${identityAnchor}"` : `Define a unique visual identity ("Anchor") for the protagonist.`}
2. **Technical Precision:** Describe camera movements, lighting, and action keywords.

**Language Rule:**
* **visual_description** & **shot_type**: ALWAYS in English.
* **audio_description** & **project_title**: ${language === 'zh' ? "Chinese (Simplified)" : "English"}.

**Output Format:** JSON strictly following the provided schema.
`;

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: `Draft a 5-scene storyboard for: ${storyIdea}. Style: ${visualStyle}`,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: geminiResponseSchema,
                temperature: 0.7,
            },
        });

        const text = response.text;
        if (!text) throw new Error('No response from AI Director.');

        const project = JSON.parse(text);
        project.scenes = project.scenes.map((s: any) => ({
            ...s,
            image_prompt: `${project.character_anchor}, ${s.visual_description}, ${s.shot_type}`,
            video_motion_prompt: s.shot_type,
        }));

        res.json(project);
    } catch (error: any) {
        console.error('[Gemini] Error:', error);
        res.status(500).json({
            error: error.message || 'Gemini generation failed',
            details: error.toString(),
            stack: error.stack
        });
    }
});

// POST /api/gemini/analyze
app.post('/api/gemini/analyze', async (req, res) => {
    try {
        const { base64Data } = req.body;
        if (!base64Data) return res.status(400).json({ error: 'Missing base64Data' });

        const ai = getGeminiAI();
        const cleanBase64 = base64Data.split(',')[1] || base64Data;
        const mimeType = base64Data.match(/:(.*?);/)?.[1] || 'image/png';

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType, data: cleanBase64 } },
                    { text: 'Analyze this character and extract a dense Identity Anchor description: face, hair, and key outfit elements.' },
                ],
            },
        });

        res.json({ anchor: (response.text || 'A cinematic character').trim() });
    } catch (error: any) {
        console.error('[Gemini Analyze] Error:', error.message);
        res.json({ anchor: 'A cinematic character' });
    }
});

// --- Replicate Logic ---
const REPLICATE_API_BASE = 'https://api.replicate.com/v1';

// POST /api/replicate/predict
app.post('/api/replicate/predict', async (req, res) => {
    try {
        const token = getReplicateToken();
        const { version, input } = req.body;
        if (!version || !input) return res.status(400).json({ error: 'Missing version or input' });

        const isModelPath = version.includes('/') && !version.match(/^[a-f0-9]{64}$/);
        const targetUrl = isModelPath
            ? `${REPLICATE_API_BASE}/models/${version}/predictions`
            : `${REPLICATE_API_BASE}/predictions`;

        const maxRetries = 3;
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
                const waitMs = 2000 * (attempt + 1);
                await new Promise(r => setTimeout(r, waitMs));
                continue;
            }

            if (!response.ok) {
                const errText = await response.text();
                return res.status(response.status).json({ error: errText });
            }

            const data = await response.json();
            return res.json(data);
        }
    } catch (error: any) {
        console.error('[Replicate] Error:', error.message);
        res.status(500).json({ error: error.message || 'Replicate prediction failed' });
    }
});

// GET /api/replicate/status/:id
app.get('/api/replicate/status/:id', async (req, res) => {
    try {
        const token = getReplicateToken();
        const { id } = req.params;
        const response = await fetch(`${REPLICATE_API_BASE}/predictions/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) return res.status(response.status).json({ error: await response.text() });
        res.json(await response.json());
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- Health Check ---
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        build: 'monolithic-v1',
        geminiKey: !!process.env.GEMINI_API_KEY ? '✅ configured' : '❌ missing',
    });
});

export default app;
