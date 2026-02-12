
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { UserCreditState, Language, ImageModel, VideoModel, VideoStyle, AspectRatio, VideoQuality, VideoDuration, VideoFps, VideoResolution } from '../types';

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
  login: () => void; // Triggered after successful auth
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
      const saved = localStorage.getItem('app_settings');
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
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
        setProfile({ id: data.id, name: data.name, role: data.role });
        setUserState({
          balance: data.credits,
          isPro: data.is_pro,
          isAdmin: data.is_admin
        });
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  };

  const login = () => {
    // This is now handled by onAuthStateChange
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
