
export interface Scene {
  id?: string; // Database ID
  scene_number: number;
  visual_description: string;
  audio_description: string;
  shot_type: string;

  image_prompt?: string;
  video_motion_prompt?: string;
  image_url?: string;
  video_url?: string;
}

export interface StoryboardProject {
  id?: string; // Database ID
  project_title: string;
  visual_style: string;
  character_anchor: string;
  identity_strength?: number;
  scenes: Scene[];
}

export interface GenerateRequest {
  storyIdea: string;
  visualStyle: string;
  identityAnchor?: string;
  identityStrength?: number;
}

export enum VisualStyle {
  POP_MART = "Pop Mart 3D",
  GHIBLI = "Studio Ghibli Anime",
  REALISM = "Cinematic Realism",
  CYBERPUNK = "Cyberpunk / Synthwave",
  PIXAR = "Disney / Pixar 3D",
  WATERCOLOR = "Abstract Watercolor"
}

export type Language = 'en' | 'zh';
export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export type ImageModel = 'flux' | 'flux_schnell' | 'nano_banana';

export type VideoModel =
  | 'wan_2_5'
  | 'hailuo_02'
  | 'veo_3_1'
  | 'pixverse_v5'
  | 'seedance_1_5_pro'
  | 'sora_2_pro';

export type GenerationMode = 'storyboard' | 'story';

export type VideoMethod = 'stable' | 'ai';
export type MotionIntensity = 'low' | 'medium' | 'high';
export type VideoQuality = 'draft' | 'standard' | 'pro';
export type VideoDuration = 4 | 6 | 8;
export type VideoFps = 12 | 24;
export type VideoResolution = '720p' | '1080p';

export type VideoStyle =
  | 'none'
  | 'chinese_3d'
  | 'chinese_ink'
  | 'pop_mart'
  | 'realism'
  | 'blockbuster_3d'
  | 'cyberpunk'
  | 'ghibli'
  | 'shinkai';

export interface StylePreset {
  id: VideoStyle;
  label: string;
  category: string;
  promptModifier: string;
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'chinese_3d',
    label: 'Chinese 3D Anime (国漫)',
    category: '🇨🇳 Chinese Aesthetics',
    promptModifier: ', 3D donghua style, Light Chaser Animation aesthetic, White Snake inspired, oriental fantasy, highly detailed 3D render, blind box texture, 8k, ethereal lighting, martial arts vibe, consistent character features'
  },
  {
    id: 'chinese_ink',
    label: 'Chinese Ink Wash (水墨)',
    category: '🇨🇳 Chinese Aesthetics',
    promptModifier: ', traditional Chinese ink wash painting, shuimo style, watercolor texture, flowing ink, negative space, oriental landscape, artistic, Shanghai Animation Film Studio style, masterpiece'
  },
  {
    id: 'pop_mart',
    label: 'Pop Mart 3D (盲盒)',
    category: '🇨🇳 Chinese Aesthetics',
    promptModifier: ', Pop Mart style, blind box toy, C4D render, clay material, cute proportions, studio lighting, clean background, 3D character design, plastic texture'
  },
  {
    id: 'realism',
    label: 'Hyper Realism (4K ARRI)',
    category: '🎥 Cinema & Realism',
    promptModifier: ', photorealistic, shot on ARRI Alexa, 35mm lens, cinematic lighting, depth of field, hyper-realistic, live action footage, raytracing, 8k, raw photo'
  },
  {
    id: 'blockbuster_3d',
    label: 'Hollywood Blockbuster',
    category: '🎥 Cinema & Realism',
    promptModifier: ', hollywood blockbuster style, Unreal Engine 5 render, IMAX quality, cinematic composition, dramatic lighting, highly detailed VFX, transformers style, sci-fi masterpiece'
  },
  {
    id: 'cyberpunk',
    label: 'Cinematic Cyberpunk',
    category: '🎥 Cinema & Realism',
    promptModifier: ', futuristic sci-fi masterpiece, neon lights, high tech, cybernetic atmosphere, blade runner style, night city, volumetric fog, cinematic'
  },
  {
    id: 'ghibli',
    label: 'Studio Ghibli (吉卜力)',
    category: '🎨 Art & Anime',
    promptModifier: ', Studio Ghibli style, Hayao Miyazaki, hand drawn anime, cel shading, vibrant colors, picturesque scenery, 2D animation, cinematic'
  },
  {
    id: 'shinkai',
    label: 'Makoto Shinkai (新海诚)',
    category: '🎨 Art & Anime',
    promptModifier: ', Makoto Shinkai style, Your Name style, vibrant vivid colors, highly detailed background art, lens flare, emotional lighting, anime masterpiece, 8k wallpaper'
  }
];

export const MODEL_COSTS: Record<VideoModel | 'DEFAULT', number> = {
  wan_2_5: 50,
  hailuo_02: 60,
  veo_3_1: 80,
  pixverse_v5: 90,
  seedance_1_5_pro: 110,
  sora_2_pro: 150,
  DEFAULT: 60
};

export const MODEL_METADATA: Record<VideoModel, { label: string; tags: string[]; audio?: boolean; badge?: string }> = {
  wan_2_5: {
    label: "Wan 2.5 (Alibaba)",
    tags: ["⚡ Fast Draft", "💰 Best Value"],
    badge: "Recommended"
  },
  hailuo_02: {
    label: "Hailuo-02 (MiniMax)",
    tags: ["🏃 Complex Motion", "Fluidity"]
  },
  veo_3_1: {
    label: "Veo 3.1 Fast (Google)",
    tags: ["🎬 Narrative", "Consistency"]
  },
  pixverse_v5: {
    label: "PixVerse v5",
    tags: ["🎨 Anime/Style Top", "Visuals"]
  },
  seedance_1_5_pro: {
    label: "Seedance 1.5 Pro",
    tags: ["🎵 Audio Sync", "Stable"],
    audio: true,
    badge: "🎵 Audio"
  },
  sora_2_pro: {
    label: "Sora 2.0 Pro",
    tags: ["💎 Cinema Quality", "14B Parameters"],
    audio: true,
    badge: "🔥 Ultimate"
  }
};

export const CREDIT_COSTS = {
  IMAGE_FLUX: 2,
  IMAGE_FLUX_SCHNELL: 1,
  IMAGE_NANO: 0,
  VIDEO_STABLE: 1,
  QUALITY_PRO_EXTRA: 5,
  RES_1080P_EXTRA: 5
};

export interface UserCreditState {
  balance: number;
  isPro: boolean;
  isAdmin?: boolean;
}

export const STRIPE_PRICES = {
  CREATOR_MONTHLY: 'price_mock_creator_monthly',
  CREATOR_YEARLY: 'price_mock_creator_yearly',
  DIRECTOR_MONTHLY: 'price_mock_director_monthly',
  DIRECTOR_YEARLY: 'price_mock_director_yearly',
};

export const STRIPE_PUBLISHABLE_KEY = 'pk_test_mock_key';
