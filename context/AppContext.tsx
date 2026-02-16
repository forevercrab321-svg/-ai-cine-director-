
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
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
  deductCredits: (amount: number, details?: { model: string, base: number, mult: number }) => Promise<boolean>;
  upgradeUser: (tier: 'creator' | 'director') => Promise<void>;
  buyCredits: (amount: number, cost: number) => Promise<void>;
  enableGodMode: () => void;

  // UI Contol
  isPricingOpen: boolean;
  openPricingModal: () => void;
  closePricingModal: () => void;
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
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [userState, setUserState] = useState<UserCreditState>({
    balance: 0,
    isPro: false,
    isAdmin: false,
    monthlyUsage: 0,
    planType: 'creator'
  });

  // ★ CRITICAL: Real-time balance ref for atomic credit checks
  // React state is stale in closures — this ref is the ONLY source of truth
  // for synchronous balance checking in deductCredits
  const balanceRef = useRef(0);

  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const toggleLang = () => {
    setSettings(prev => ({ ...prev, lang: prev.lang === 'en' ? 'zh' : 'en' }));
  };

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
        // Auto-topup REMOVED to fix infinite credit bug

        setProfile({ id: data.id, name: data.name, role: data.role });
        const newBalance = data.credits;
        balanceRef.current = newBalance; // ★ Sync ref immediately
        setUserState({
          balance: newBalance,
          isPro: data.is_pro,
          isAdmin: data.is_admin,
          monthlyUsage: data.monthly_credits_used || 0,
          planType: data.plan_type || 'creator'
        });
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  };

  // ... (bypass logic) ...

  // ... (bypass logic removed)

  const login = () => {
    // Standard login trigger - just updates state if needed or called after auth
    // In Supabase auth, the session listener handles the actual state update
    // This function might be redundant or used for specific triggers
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setIsAuthenticated(false);
    setProfile(null);
  };

  const completeProfile = async (name: string, role: string) => {
    if (!session?.user) return;
    const updates = {
      id: session.user.id,
      name,
      role,
      updated_at: new Date(),
    };

    const { error } = await supabase.from('profiles').upsert(updates);
    if (error) {
      console.error('Error updating profile:', error);
      return;
    }

    await fetchProfile(session.user.id);
  };

  const deductCredits = async (amount: number, details?: { model: string, base: number, mult: number }): Promise<boolean> => {
    if (userState.isAdmin) return true;

    // ★ CRITICAL: Use ref for atomic check-and-deduct (NOT React state!)
    // React state is stale in closures during async loops and rapid clicks.
    // The ref is the ONLY reliable way to prevent negative balances.
    if (balanceRef.current < amount) {
      console.warn(`[CREDIT GUARD] Blocked: ref=${balanceRef.current}, need=${amount}`);
      return false;
    }

    // ★ Synchronously deduct from ref BEFORE any async work
    // This ensures the next call (even in the same tick) sees the reduced balance
    balanceRef.current -= amount;
    console.log(`[CREDIT DEDUCT] Deducted ${amount}, ref now=${balanceRef.current}`);

    // Update React state for UI
    setUserState(prev => ({
      ...prev,
      balance: balanceRef.current, // Use ref as source of truth
      monthlyUsage: prev.monthlyUsage + amount
    }));

    // Persist to database (fire-and-forget, ref already updated)
    if (session?.user) {
      try {
        const { error } = await supabase.rpc('deduct_credits', {
          amount_to_deduct: amount,
          model_used: details?.model || 'unknown',
          base_cost: details?.base || 0,
          multiplier: details?.mult || 1
        });

        if (error) {
          console.warn("RPC failed, using direct update fallback", error);
          await supabase
            .from('profiles')
            .update({
              credits: balanceRef.current,
              monthly_credits_used: userState.monthlyUsage + amount
            })
            .eq('id', session.user.id);
        }
      } catch (e) {
        console.error("DB deduct error (ref already updated)", e);
      }
    }

    return true;
  };

  const buyCredits = async (amount: number, cost: number) => {
    if (!session?.user) return;

    // Simulate Stripe Payment here
    // In real app: createStripeCheckout -> wait for webhook -> webhook calls RPC to add credits
    // Here: Direct update
    const { error } = await supabase.rpc('add_credits', { amount_to_add: amount }); // assuming we might add this RPC later

    // Fallback direct update
    if (error) {
      await supabase
        .from('profiles')
        .update({
          credits: userState.balance + amount,
          has_purchased_credits: true
        })
        .eq('id', session.user.id);
    }

    balanceRef.current += amount; // ★ Sync ref
    setUserState(prev => ({ ...prev, balance: balanceRef.current }));
  };

  const upgradeUser = async (tier: 'creator' | 'director') => {
    if (!session?.user) return;
    const creditsToAdd = tier === 'creator' ? 1000 : 3500;

    balanceRef.current += creditsToAdd; // ★ Sync ref
    setUserState(prev => ({ ...prev, balance: balanceRef.current, isPro: true, planType: tier }));

    await supabase
      .from('profiles')
      .update({
        credits: userState.balance + creditsToAdd,
        is_pro: true,
        plan_type: tier
      })
      .eq('id', session.user.id);
  };

  // ... (enableGodMode) ...
  const enableGodMode = () => {
    balanceRef.current = 999999; // ★ Sync ref
    setUserState({ balance: 999999, isPro: true, isAdmin: true, monthlyUsage: 0, planType: 'director' });
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
      buyCredits,
      upgradeUser,
      enableGodMode,
      isPricingOpen,
      openPricingModal: () => setIsPricingOpen(true),
      closePricingModal: () => setIsPricingOpen(false)
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
