/**
 * Vercel Serverless Function - Gemini API 代理
 * 处理 /api/gemini/generate 和 /api/gemini/analyze
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

// 动态导入避免打包问题
async function getGoogleGenAI() {
    const { GoogleGenAI, Type } = await import('@google/genai');
    return { GoogleGenAI, Type };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

    // 从 URL 路径解析 action: /api/gemini/generate 或 /api/gemini/analyze
    const url = new URL(req.url || '', `https://${req.headers.host}`);
    const pathParts = url.pathname.split('/').filter(Boolean); // ['api', 'gemini', 'generate']
    const action = pathParts[2] || 'generate';

    try {
        const { GoogleGenAI, Type } = await getGoogleGenAI();
        const ai = new GoogleGenAI({ apiKey });

        if (action === 'analyze') {
            // 分析角色锚点
            const { base64Data } = req.body;
            if (!base64Data) return res.status(400).json({ error: 'Missing base64Data' });

            const cleanBase64 = base64Data.split(',')[1] || base64Data;
            const mimeType = base64Data.match(/:(.*?);/)?.[1] || 'image/png';

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: {
                    parts: [
                        { inlineData: { mimeType, data: cleanBase64 } },
                        { text: 'Analyze this character and extract a dense Identity Anchor description: face, hair, and key outfit elements.' },
                    ],
                },
            });

            const result = (response.text || 'A cinematic character').trim();
            return res.json({ anchor: result });

        } else {
            // 生成故事板
            const { storyIdea, visualStyle, language, mode, identityAnchor } = req.body;
            if (!storyIdea) return res.status(400).json({ error: 'Missing storyIdea' });

            const responseSchema = {
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

            const systemInstruction = `
**Role:** Master Filmmaker & Director of Photography (Top Tier).
**Task:** Transform the User's Story Concept into a production-ready, highly logical storyboard with **10 distinct scenes**.

**CORE PHILOSOPHY: THE ANCHOR METHOD & LOGICAL FLOW**
1. **Character Consistency (The Anchor):** 
   ${identityAnchor
                    ? `Use the EXISTING Anchor: "${identityAnchor}" strictly. Every single scene description MUST explicitly mention this anchor's key features.`
                    : `First, define a unique, memorable visual identity (the "Anchor") for the protagonist. This anchor MUST appear in every scene description to ensure AI generation consistency.`}
   
2. **Visual Continuity (The "Flow"):**
   - Scene N must logically follow Scene N-1.
   - If Scene 1 is a close-up, Scene 2 might be a wider shot establishing context.
   - ***CRITICAL:*** Ensure the environment and lighting remain consistent unless the script explicitly changes location.

3. **Director's Logic:**
   - Write with the logic of a top-tier director. Why is the camera here? What is the motivation?
   - Avoid random jumps. Create a smooth visual narrative.

**Language Rule:**
* **visual_description** & **shot_type**: ALWAYS in English (Optimized for Video AI generation).
* **audio_description** & **project_title**: ${language === 'zh' ? "Chinese (Simplified)" : "English"}.

**Output Format:** JSON strictly following the provided schema, containing exactly **10 scenes**.
`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: `Draft a 10-scene masterpiece storyboard for: ${storyIdea}. Style: ${visualStyle}`,
                config: {
                    systemInstruction,
                    responseMimeType: 'application/json',
                    responseSchema,
                    thinkingConfig: { thinkingBudget: 8000 },
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

            return res.json(project);
        }
    } catch (error: any) {
        console.error('[Gemini] Error:', error.message);
        return res.status(500).json({ error: error.message || 'Gemini generation failed' });
    }
}
