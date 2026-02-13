/**
 * Replicate Service - 前端代理层
 * 所有请求通过后端 API Server 转发，不包含任何 API Token
 */
import { VideoStyle, ImageModel, AspectRatio, GenerationMode, VideoQuality, VideoDuration, VideoFps, VideoResolution, VideoModel } from '../types';

export interface ReplicateResponse {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: any;
  error?: string;
  logs?: string;
}

const API_BASE = '/api/replicate';

// Helper: 从 localStorage 读取配置
const getConfig = () => {
  if (typeof window === 'undefined') return { useMockMode: true };
  const saved = localStorage.getItem('app_settings');
  if (!saved) return { useMockMode: true };
  const parsed = JSON.parse(saved);
  return { useMockMode: parsed.useMockMode ?? true };
};

const REPLICATE_MODEL_MAP: Record<string, string> = {
  // Image models
  flux: "black-forest-labs/flux-1.1-pro",
  flux_schnell: "black-forest-labs/flux-schnell",
  // Video models — 5 best cost-performance I2V models (2025-07)
  wan_2_2_fast: "wan-video/wan-2.2-i2v-fast",          // ~$0.05/video ⚡
  hailuo_02_fast: "minimax/hailuo-02-fast",             // ~$0.12/video ⭐
  seedance_lite: "bytedance/seedance-1-lite",           // ~$0.18/video
  kling_2_5: "kwaivgi/kling-v2.5-turbo-pro",            // ~$0.35/video 🏆
  hailuo_live: "minimax/video-01-live",                 // ~$0.50/video 🎭
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- MOCK 模式 ---
const generateMockImage = async (prompt: string): Promise<string> => {
  console.log("[Mock Mode] Generating Image:", prompt);
  await sleep(2000 + Math.random() * 2000);
  return `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/1280/720`;
};

const generateMockVideo = async (prompt: string): Promise<ReplicateResponse> => {
  console.log("[Mock Mode] Starting Video Task:", prompt);
  await sleep(1000);
  return {
    id: "mock-video-" + Date.now(),
    status: "starting",
    logs: "Mock video generation started..."
  };
};

/**
 * 生成图片 - 通过后端代理调用 Replicate
 */
export const generateImage = async (
  prompt: string,
  modelType: ImageModel = 'flux',
  videoStyle: VideoStyle = 'none',
  aspectRatio: AspectRatio = '16:9',
  characterAnchor?: string
): Promise<string> => {
  const { useMockMode } = getConfig();
  if (useMockMode) return generateMockImage(prompt);

  const finalPrompt = characterAnchor ? `${characterAnchor}, ${prompt}` : prompt;
  const modelIdentifier = REPLICATE_MODEL_MAP[modelType] || REPLICATE_MODEL_MAP['flux'];

  const response = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: modelIdentifier,
      input: {
        prompt: finalPrompt,
        aspect_ratio: aspectRatio,
        output_format: "jpg"
      }
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error('⏳ 排队繁忙，请稍后再试');
  }

  let prediction = await response.json();

  // 轮询直到完成
  while (prediction.status !== "succeeded" && prediction.status !== "failed" && prediction.status !== "canceled") {
    await sleep(3000);
    prediction = await checkPredictionStatus(prediction.id);
  }

  if (prediction.status === "succeeded") {
    const output = prediction.output;
    return Array.isArray(output) ? output[0] : output;
  }

  throw new Error('⏳ 排队繁忙，请稍后再试');
};

/**
 * 构建每个模型的 input 参数 — 不同模型接受不同字段名
 */
// 强制的一致性 Prompt 前缀
const STRICT_CONSISTENCY = "High fidelity. Strict consistency with the first frame. Do not change the character face or costume. Smooth motion.";

/**
 * 构建每个模型的 input 参数 — 不同模型接受不同字段名
 */
function buildVideoInput(modelType: VideoModel, prompt: string, imageUrl: string): Record<string, any> {
  // 组合最终 prompt
  const strictPrompt = `${STRICT_CONSISTENCY} ${prompt}`;

  switch (modelType) {
    case 'wan_2_2_fast':
      return {
        prompt: strictPrompt,
        image: imageUrl,
        prompt_optimizer: true,
      };
    case 'hailuo_02_fast':
      return {
        prompt: strictPrompt,
        first_frame_image: imageUrl,
        duration: 6,
        resolution: "1280x720", // 强制 720p 以提高细节一致性 (Was 512P)
        prompt_optimizer: true, // Minimax optimizers usually help, but sometimes drift. Keep it for now.
      };
    case 'seedance_lite':
      return {
        prompt: strictPrompt,
        image: imageUrl,
        duration: 5,
        resolution: "720p",
      };
    case 'kling_2_5':
      return {
        prompt: strictPrompt,
        image: imageUrl,
        duration: 5,
        cfg_scale: 0.8, // 增加相关性权重
      };
    case 'hailuo_live':
      return {
        prompt: strictPrompt,
        first_frame_image: imageUrl,
        prompt_optimizer: true,
      };
    default:
      return {
        prompt: strictPrompt,
        first_frame_image: imageUrl,
        prompt_optimizer: true,
      };
  }
}

/**
 * 生成视频 - 通过后端代理调用 Replicate
 */
export const startVideoTask = async (
  prompt: string,
  startImageUrl: string,
  modelType: VideoModel,
  videoStyle: VideoStyle,
  generationMode: GenerationMode,
  quality: VideoQuality,
  duration: VideoDuration,
  fps: VideoFps,
  resolution: VideoResolution,
  characterAnchor?: string
): Promise<ReplicateResponse> => {
  const { useMockMode } = getConfig();
  if (useMockMode) return generateMockVideo(prompt);

  const finalPrompt = characterAnchor ? `${characterAnchor}, ${prompt}` : prompt;
  const modelIdentifier = REPLICATE_MODEL_MAP[modelType] || REPLICATE_MODEL_MAP['hailuo_02_fast'];

  const response = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: modelIdentifier,
      input: buildVideoInput(modelType, finalPrompt, startImageUrl)
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error('⏳ 排队繁忙，请稍后再试');
  }

  return await response.json();
};

/**
 * 查询任务状态 - 通过后端代理轮询
 */
export async function checkPredictionStatus(id: string): Promise<ReplicateResponse> {
  const { useMockMode } = getConfig();

  // Mock 模式
  if (useMockMode && id.startsWith("mock-video-")) {
    const elapsed = Date.now() - Number(id.split('-')[2]);
    if (elapsed < 3000) return { id, status: "starting" };
    if (elapsed < 8000) return { id, status: "processing", logs: "Rendering frames..." };
    return {
      id,
      status: "succeeded",
      output: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4"
    };
  }

  const response = await fetch(`${API_BASE}/status/${id}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error('⏳ 排队繁忙，请稍后再试');
  }

  return await response.json();
}
