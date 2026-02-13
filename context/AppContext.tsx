
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { UserCreditState, Language, ImageModel, VideoModel, VideoStyle, AspectRatio, VideoQuality, VideoDuration, VideoFps, VideoResolution, MODEL_COSTS } from '../types';

interface UserProfile {
  id: string;
  name: string;
  role: string;
}

interface AppSettings {
  lang: Language;
  imageModel: ImageModel;
  videoModel: VideoModel;
  videoStyle: VideoStyle;
  aspectRatio: AspectRatio;
  videoQuality: VideoQuality;
  videoDuration: VideoDuration;
  videoFps: VideoFps;
  videoResolution: VideoResolution;
  generationMode: 'storyboard' | 'story';

  // Backend Configuration
  useMockMode: boolean; // Keep for fallback or dev
  backendUrl: string;
}

interface AppContextType {
  userState: UserCreditState;
  isAuthenticated: boolean;
  profile: UserProfile | null;
  settings: AppSettings;

  // Actions
  login: (bypass?: boolean) => void; // Triggered after successful auth
  completeProfile: (name: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
  toggleLang: () => void;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  deductCredits: (amount: number) => Promise<boolean>;
  upgradeUser: (tier: 'creator' | 'director') => Promise<void>;
  enableGodMode: () => void;
}

const DEFAULT_CREDITS = 50;

const defaultSettings: AppSettings = {
  lang: 'en',
  imageModel: 'flux',
  videoModel: 'hailuo_02_fast',
  videoStyle: 'pop_mart',
  aspectRatio: '16:9',
  videoQuality: 'standard',
  videoDuration: 6,
  videoFps: 12,
  videoResolution: '720p',
  generationMode: 'storyboard',

  useMockMode: false,
  backendUrl: ''
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userState, setUserState] = useState<UserCreditState>({ balance: 0, isPro: false, isAdmin: false });

  const [settings, setSettings] = useState<AppSettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('app_settings');
        if (saved) {
          const parsed = JSON.parse(saved);

          // Migration: Validate videoModel against current available models
          // If the saved model is no longer in our list (e.g. 'veo_3_1'), reset to default
          // @ts-ignore
          if (parsed.videoModel && !MODEL_COSTS[parsed.videoModel]) {
            console.warn(`[Migration] Found obsolete video model: ${parsed.videoModel}. Resetting to default.`);
            parsed.videoModel = defaultSettings.videoModel;
          }

          return { ...defaultSettings, ...parsed };
        }
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
    return defaultSettings;
  });

  // Persist settings
  useEffect(() => {
    localStorage.setItem('app_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsAuthenticated(!!session);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setUserState({ balance: 0, isPro: false, isAdmin: false });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        // Auto-topup for testing if credits are low (< 5)
        let balance = data.credits;
        if (balance < 5) {
          balance = 50;
          // Fire and forget update
          supabase.from('profiles').update({ credits: 50 }).eq('id', data.id).then(({ error }) => {
            if (error) console.error("Auto-topup failed", error);
            else console.log("Auto-topup to 50 credits successful");
          });
        }

        setProfile({ id: data.id, name: data.name, role: data.role });
        setUserState({
          balance: balance,
          isPro: data.is_pro,
          isAdmin: data.is_admin
        });
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  };

  // Check for bypass flag on mount
  useEffect(() => {
    if (localStorage.getItem('dev_bypass') === 'true') {
      setIsAuthenticated(true);
      setProfile({ id: 'dev-id', name: 'Dev Director', role: 'Director' });
      // Restore infinite credits for dev mode, or set to 50 if user requested normal credits
      setUserState({ balance: 9999, isPro: true, isAdmin: true });
    } else {
      // Logic for real users who might have low credits due to testing glitches
      // This is a temporary "fix script" running in the client
      const savedProfile = localStorage.getItem('user_profile'); // if logic existed
    }
  }, []);

  const login = (bypass: boolean = false) => {
    if (bypass) {
      setIsAuthenticated(true);
      setProfile({ id: 'dev-id', name: 'Dev Director', role: 'Director' });
      setUserState({ balance: 9999, isPro: true, isAdmin: true });
      localStorage.setItem('dev_bypass', 'true');
    }
  };

  const completeProfile = async (name: string, role: string) => {
    if (!session?.user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          name,
          role,
          credits: DEFAULT_CREDITS
        });

      if (error) throw error;

      // Refresh profile
      fetchProfile(session.user.id);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('is_authenticated');
    localStorage.removeItem('user_profile');
  };

  const toggleLang = () => {
    setSettings(prev => ({ ...prev, lang: prev.lang === 'en' ? 'zh' : 'en' }));
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const deductCredits = async (amount: number): Promise<boolean> => {
    if (userState.isAdmin) return true;
    if (userState.balance < amount) return false;

    if (session?.user) {
      const { error } = await supabase.rpc('deduct_credits', { amount_to_deduct: amount });
      if (error) {
        // Fallback: client side update then sync? No, better to stick to server source of truth or optimistic update
        // For now, let's do optimistic update locally and let subscription/fetch fix it?
        // Since we don't have the RPC function defined in schema yet, let's do direct update
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ credits: userState.balance - amount })
          .eq('id', session.user.id);

        if (updateError) {
          console.error("Failed to deduct credits", updateError);
          return false;
        }

        setUserState(prev => ({ ...prev, balance: prev.balance - amount }));
        return true;
      }
    }

    // Fallback for strictness
    setUserState(prev => ({ ...prev, balance: prev.balance - amount }));
    return true;
  };

  const upgradeUser = async (tier: 'creator' | 'director') => {
    if (!session?.user) return;
    const creditsToAdd = tier === 'creator' ? 1000 : 3500;

    // Optimistic update
    setUserState(prev => ({ ...prev, balance: prev.balance + creditsToAdd, isPro: true }));

    // Real update
    await supabase
      .from('profiles')
      .update({
        credits: userState.balance + creditsToAdd,
        is_pro: true
      })
      .eq('id', session.user.id);
  };

  const enableGodMode = () => {
    setUserState({ balance: 999999, isPro: true, isAdmin: true });
  };

  // Safe Service Worker Cleanup
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
          registration.unregister();
        }
      }).catch(err => console.log('SW Cleanup harmless error:', err));
    }
  }, []);

  return (
    <AppContext.Provider value={{
      userState,
      isAuthenticated,
      profile,
      settings,
      login,
      completeProfile,
      logout,
      toggleLang,
      updateSettings,
      deductCredits,
      upgradeUser,
      enableGodMode
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within an AppProvider");
  return context;
};
