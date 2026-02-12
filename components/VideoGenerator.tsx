
import React, { useState, useEffect } from 'react';
import { StoryboardProject, Scene, MODEL_COSTS, CREDIT_COSTS } from '../types';
import SceneCard from './SceneCard';
import { generateImage, startVideoTask, checkPredictionStatus } from '../services/replicateService';
import { updateSceneMedia } from '../services/storyboardService';
import { LoaderIcon, VideoCameraIcon, PhotoIcon } from './IconComponents';
import { useAppContext } from '../context/AppContext';
import { t } from '../i18n';

const HARD_TIMEOUT_MS = 10 * 60 * 1000;
const POLL_INTERVAL_MS = 5000;

type RenderStatus = 'idle' | 'queued' | 'starting' | 'processing' | 'done' | 'failed' | 'timed_out';

// 将 API 错误转为用户友好的中文提示
const friendlyError = (_error: string): string => '⏳ 排队繁忙，请稍后再试';

interface JobInfo {
    id: string;
    startTime: number;
}

interface VideoGeneratorProps {
    project: StoryboardProject;
    onBackToScript: () => void;
}

const ProgressBar: React.FC<{ current: number; total: number; label: string }> = ({ current, total, label }) => {
    const percentage = Math.min(100, Math.round((current / total) * 100));
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 rounded-full px-6 py-3 shadow-2xl flex items-center gap-4 z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
            <LoaderIcon className="w-5 h-5 text-indigo-400" />
            <div className="flex flex-col min-w-[200px]">
                <div className="flex justify-between text-xs font-bold text-white mb-1 uppercase tracking-wider">
                    <span>{label}</span>
                    <span>{percentage}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 ease-out"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

const VideoGenerator: React.FC<VideoGeneratorProps> = ({ project, onBackToScript }) => {
    const { settings, userState, deductCredits } = useAppContext();

    const [sceneImages, setSceneImages] = useState<Record<number, string>>({});
    const [sceneVideoUrls, setSceneVideoUrls] = useState<Record<number, string>>({});
    const [activeVideoJobs, setActiveVideoJobs] = useState<Record<number, JobInfo>>({});
    const [sceneStatus, setSceneStatus] = useState<Record<number, { status: RenderStatus, error?: string, message?: string }>>({});
    const [scenePredictionIds, setScenePredictionIds] = useState<Record<number, string>>({});
    const [isRenderingImages, setIsRenderingImages] = useState(false);
    const [imageProgress, setImageProgress] = useState({ completed: 0, total: 0 });

    useEffect(() => {
        // initialize from project if available
        const initialImages: Record<number, string> = {};
        const initialVideos: Record<number, string> = {};
        project.scenes.forEach(s => {
            if (s.image_url) initialImages[s.scene_number] = s.image_url;
            if (s.video_url) initialVideos[s.scene_number] = s.video_url;
        });
        setSceneImages(prev => ({ ...prev, ...initialImages }));
        setSceneVideoUrls(prev => ({ ...prev, ...initialVideos }));
    }, [project]);

    useEffect(() => {
        const pollJobs = async () => {
            const activeScenes = Object.keys(activeVideoJobs).map(Number);
            if (activeScenes.length === 0) return;

            const updates: Record<number, JobInfo> = { ...activeVideoJobs };
            const statusUpdates: Record<number, any> = {};
            const urlUpdates: Record<number, string> = {};

            await Promise.all(activeScenes.map(async (sceneNum) => {
                const job = activeVideoJobs[sceneNum];

                if (Date.now() - job.startTime > HARD_TIMEOUT_MS) {
                    statusUpdates[sceneNum] = { status: 'timed_out', message: '⏱️ Timeout', error: 'Render exceeded 10 minutes' };
                    delete updates[sceneNum];
                    return;
                }

                try {
                    const status = await checkPredictionStatus(job.id);

                    if (status.status === 'succeeded') {
                        if (status.output) {
                            urlUpdates[sceneNum] = status.output;
                            statusUpdates[sceneNum] = { status: 'done', message: '✅ Ready' };
                            delete updates[sceneNum];

                            // Save to Supabase
                            const scene = project.scenes.find(s => s.scene_number === sceneNum);
                            if (scene && scene.id) {
                                updateSceneMedia(scene.id, 'video', status.output);
                            }

                        } else {
                            statusUpdates[sceneNum] = { status: 'failed', error: 'No output URL', message: '❌ Error' };
                            delete updates[sceneNum];
                        }
                    } else if (status.status === 'failed') {
                        statusUpdates[sceneNum] = { status: 'failed', error: status.error || 'Unknown', message: '❌ Failed' };
                        delete updates[sceneNum];
                    } else {
                        statusUpdates[sceneNum] = {
                            status: 'processing',
                            message: `⏳ Rendering Video... (${status.status})`
                        };
                    }
                } catch (e) {
                    console.warn(`Polling error for job ${job.id}`, e);
                }
            }));

            if (Object.keys(statusUpdates).length > 0) setSceneStatus(prev => ({ ...prev, ...statusUpdates }));
            if (Object.keys(urlUpdates).length > 0) setSceneVideoUrls(prev => ({ ...prev, ...urlUpdates }));
            setActiveVideoJobs(updates);
        };

        const interval = setInterval(pollJobs, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [activeVideoJobs, project]);

    const executeImageGeneration = async (scene: Scene) => {
        const cost = settings.imageModel === 'flux_schnell' ? CREDIT_COSTS.IMAGE_FLUX_SCHNELL : CREDIT_COSTS.IMAGE_FLUX;
        if (userState.balance < cost) throw new Error("Insufficient credits");

        const prompt = `${scene.visual_description}, ${scene.shot_type}`;
        const url = await generateImage(
            prompt,
            settings.imageModel,
            settings.videoStyle,
            settings.aspectRatio,
            project.character_anchor
        );

        deductCredits(cost);
        setSceneImages(prev => ({ ...prev, [scene.scene_number]: url }));

        // Save to Supabase
        if (scene.id) {
            updateSceneMedia(scene.id, 'image', url);
        }

        return url;
    };

    const handleRenderImages = async () => {
        setIsRenderingImages(true);
        setImageProgress({ completed: 0, total: project.scenes.length });

        for (const scene of project.scenes) {
            if (sceneImages[scene.scene_number]) {
                setImageProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
                continue;
            }
            try {
                await executeImageGeneration(scene);
            } catch (e: any) {
                console.error(e);
                setSceneStatus(prev => ({ ...prev, [scene.scene_number]: { status: 'failed', message: friendlyError(e.message) } }));
                // 不 break，继续尝试下一个场景
            }
            setImageProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
        }
        setIsRenderingImages(false);
    };

    const handleRenderVideos = async () => {
        for (const scene of project.scenes) {
            const sNum = scene.scene_number;
            if (activeVideoJobs[sNum] || sceneStatus[sNum]?.status === 'done') continue;

            let imgUrl = sceneImages[sNum];
            if (!imgUrl) {
                try {
                    imgUrl = await executeImageGeneration(scene);
                } catch (e) {
                    continue;
                }
            }

            const singleVideoCost = MODEL_COSTS[settings.videoModel] || 60;
            if (userState.balance < singleVideoCost) break;

            try {
                const res = await startVideoTask(
                    scene.shot_type || "cinematic motion",
                    imgUrl,
                    settings.videoModel,
                    settings.videoStyle,
                    settings.generationMode,
                    settings.videoQuality,
                    settings.videoDuration,
                    settings.videoFps,
                    settings.videoResolution,
                    project.character_anchor
                );

                deductCredits(singleVideoCost);
                setActiveVideoJobs(prev => ({ ...prev, [sNum]: { id: res.id, startTime: Date.now() } }));
                setScenePredictionIds(prev => ({ ...prev, [sNum]: res.id }));
                setSceneStatus(prev => ({ ...prev, [sNum]: { status: 'starting', message: '🚀 Sent to Replicate' } }));
            } catch (e: any) {
                console.error(e);
                setSceneStatus(prev => ({ ...prev, [sNum]: { status: 'failed', error: e.message, message: friendlyError(e.message) } }));
            }
        }
    };

    const handleGenerateSingleVideo = async (sceneNum: number) => {
        const scene = project.scenes.find(s => s.scene_number === sceneNum);
        const imgUrl = sceneImages[sceneNum];
        if (!scene || !imgUrl) return;

        const cost = MODEL_COSTS[settings.videoModel] || 60;
        if (userState.balance < cost) return;

        setSceneStatus(prev => ({ ...prev, [sceneNum]: { status: 'queued', message: 'Starting...' } }));
        try {
            const res = await startVideoTask(
                scene.shot_type || "cinematic motion",
                imgUrl,
                settings.videoModel,
                settings.videoStyle,
                settings.generationMode,
                settings.videoQuality,
                settings.videoDuration,
                settings.videoFps,
                settings.videoResolution,
                project.character_anchor
            );
            deductCredits(cost);
            setActiveVideoJobs(prev => ({ ...prev, [sceneNum]: { id: res.id, startTime: Date.now() } }));
            setScenePredictionIds(prev => ({ ...prev, [sceneNum]: res.id }));
            setSceneStatus(prev => ({ ...prev, [sceneNum]: { status: 'starting', message: '🚀 Started' } }));
        } catch (e: any) {
            console.error(e);
            setSceneStatus(prev => ({ ...prev, [sceneNum]: { status: 'failed', error: e.message, message: friendlyError(e.message) } }));
        }
    };

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 relative pb-20">

            {/* Sticky Header / Controls */}
            <div className="sticky top-4 z-40 space-y-4">
                <div className="bg-slate-950/80 p-4 rounded-xl backdrop-blur border border-slate-800 shadow-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-1">{project.project_title}</h2>
                        <div className="flex gap-2 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                            <span>{project.scenes.length} Scenes</span>
                            <span>•</span>
                            <span>{settings.videoStyle}</span>
                        </div>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                        <button
                            onClick={handleRenderImages}
                            disabled={isRenderingImages}
                            className={`flex-1 md:flex-none px-6 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 text-sm
                            ${isRenderingImages ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-800 hover:bg-sky-600 text-white hover:shadow-lg hover:shadow-sky-500/20'}
                        `}
                        >
                            {isRenderingImages ? <LoaderIcon className="w-4 h-4" /> : <PhotoIcon className="w-4 h-4" />}
                            Render All Images
                        </button>
                        <button
                            onClick={handleRenderVideos}
                            className="flex-1 md:flex-none px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 text-sm"
                        >
                            <VideoCameraIcon className="w-4 h-4" />
                            Render All Videos
                        </button>
                    </div>
                </div>
            </div>

            {/* Global Progress Indicator */}
            {isRenderingImages && (
                <ProgressBar current={imageProgress.completed} total={imageProgress.total} label="Generating Source Frames..." />
            )}

            {/* Video Batch Progress (if many jobs active) */}
            {!isRenderingImages && Object.keys(activeVideoJobs).length > 0 && (
                <ProgressBar
                    current={project.scenes.length - Object.keys(activeVideoJobs).length}
                    total={project.scenes.length}
                    label="Rendering Video Batch..."
                />
            )}

            <div className="space-y-8">
                {project.scenes.map((scene) => (
                    <div key={scene.scene_number} className="relative">
                        <SceneCard
                            scene={scene}
                            lang={settings.lang}
                            imageModel={settings.imageModel}
                            videoModel={settings.videoModel}
                            videoStyle={settings.videoStyle}
                            aspectRatio={settings.aspectRatio}
                            userCredits={userState.balance}
                            onDeductCredits={deductCredits}
                            generationMode={settings.generationMode}
                            globalVideoQuality={settings.videoQuality}
                            globalVideoDuration={settings.videoDuration}
                            globalVideoFps={settings.videoFps}
                            globalVideoResolution={settings.videoResolution}
                            imageUrl={sceneImages[scene.scene_number] || null}
                            previousImage={sceneImages[scene.scene_number - 1] || null}
                            onImageGenerated={(url) => setSceneImages(prev => ({ ...prev, [scene.scene_number]: url }))}
                            onGenerateVideo={() => handleGenerateSingleVideo(scene.scene_number)}
                            externalVideoUrl={sceneVideoUrls[scene.scene_number]}
                            externalVideoStatus={
                                sceneStatus[scene.scene_number]?.status === 'processing' || sceneStatus[scene.scene_number]?.status === 'starting'
                                    ? 'loading'
                                    : sceneStatus[scene.scene_number]?.status === 'done' ? 'success' : undefined
                            }
                            predictionId={scenePredictionIds[scene.scene_number]}
                            errorDetails={sceneStatus[scene.scene_number]?.error}
                            characterAnchor={project.character_anchor}
                        />
                    </div>
                ))}
            </div>

            <div className="text-center">
                <button onClick={onBackToScript} className="text-slate-500 hover:text-white text-sm underline decoration-slate-700 hover:decoration-white underline-offset-4 transition-all">
                    &larr; {t(settings.lang, 'backToWriter')}
                </button>
            </div>
        </div>
    );
};

export default VideoGenerator;
