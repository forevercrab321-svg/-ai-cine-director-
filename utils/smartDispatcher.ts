
import { VideoModel } from '../types';

export interface RecommendationResult {
  model: VideoModel;
  reason: string;
  isDialogue?: boolean;
}

export const analyzePromptAndRecommendModel = (
  prompt: string
): RecommendationResult | null => {
  const p = prompt.toLowerCase();

  // 1. Dialogue / Audio Check (Highest Priority - Seedance/Sora)
  // Check for explicit speech indicators
  const dialogueKeywords = ['speak', 'talk', 'say', 'sing', 'voice', 'sound', 'dialogue', 'monologue', 'speech', 'chat', 'shout', 'whisper', '"'];
  const isDialogue = dialogueKeywords.some(k => p.includes(k));

  if (isDialogue) {
     return { model: 'seedance_1_5_pro', reason: 'Audio/Lip-Sync Detected', isDialogue: true };
  }

  // 2. High Motion / Action (Hailuo)
  const motionKeywords = ['run', 'fight', 'dance', 'fast', 'jump', 'action', 'chase', 'explode', 'crash', 'fly', 'spin', 'rapid'];
  if (motionKeywords.some(k => p.includes(k))) {
     return { model: 'hailuo_02', reason: 'Complex Motion Detected' };
  }

  // 3. Narrative / Sequence (Veo)
  const narrativeKeywords = ['story', 'sequence', 'transition', 'journey', 'timeline', 'montage', 'plot', 'unfold'];
  if (narrativeKeywords.some(k => p.includes(k))) {
      return { model: 'veo_3_1', reason: 'Narrative Flow Detected' };
  }

  // 4. Aesthetics / Visuals (PixVerse)
  const visualKeywords = ['view', 'landscape', 'cinematic', 'beautiful', 'style', 'aesthetic', 'scenery', 'panorama', 'detailed', 'artistic'];
  if (visualKeywords.some(k => p.includes(k))) {
      return { model: 'pixverse_v5', reason: 'High Fidelity Visuals Detected' };
  }
  
  // 5. Default fallback handled by caller (usually Wan 2.5)
  return null;
};
