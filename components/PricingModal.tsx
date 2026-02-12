
import React, { useState } from 'react';
import { CheckIcon, LoaderIcon } from './IconComponents';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: (tier: 'creator' | 'director') => Promise<void>;
}

// Payment Links provided by user
const STRIPE_LINKS = {
  monthly: {
    creator: 'https://buy.stripe.com/7sY28s9I1bcW59O9TQgnK00',
    director: 'https://buy.stripe.com/5kQcN61bv0yiau81nkgnK02',
  },
  yearly: {
    creator: 'https://buy.stripe.com/bJe8wQ9I16WG1XCd62gnK03', 
    director: 'https://buy.stripe.com/dRmaEY5rL4Oyau86HEgnK04',
  }
};

const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, onUpgrade }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedTier, setSelectedTier] = useState<'free' | 'creator' | 'director'>('creator');

  if (!isOpen) return null;

  const handleSubscribe = (tier: 'creator' | 'director') => {
    // Open the corresponding Stripe Payment Link in a new tab
    const url = STRIPE_LINKS[billingCycle][tier];
    
    if (url) {
        window.open(url, '_blank');
    } else {
        alert("Payment link not configured for this selection.");
    }
  };

  const getCardStyles = (tier: 'free' | 'creator' | 'director') => {
    const isSelected = selectedTier === tier;
    return `
      relative rounded-2xl p-8 flex flex-col h-full transition-all duration-300 cursor-pointer
      ${isSelected 
        ? 'bg-slate-900 border-2 border-indigo-500 shadow-2xl shadow-indigo-500/20 transform md:-translate-y-2 z-10' 
        : 'bg-slate-900/50 border border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'}
    `;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl p-6 md:p-10 my-8">
        
        {/* Back Button (Top Left) */}
        <button 
          onClick={onClose}
          className="absolute top-4 left-4 text-slate-400 hover:text-white transition-colors flex items-center gap-2 p-2 hover:bg-slate-900 rounded-lg z-10 text-sm font-medium"
          aria-label="Go Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
          </svg>
          Back
        </button>

        {/* Close Button (Top Right) */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-900 rounded-full z-10"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>

        <div className="text-center mb-8 mt-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Choose Your Production Budget</h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-8">
            Secure payment via Stripe. Disruptive pricing for independent creators.
          </p>

          {/* SLIDING TOGGLE SWITCH */}
          <div className="relative inline-flex bg-slate-900 p-1 rounded-xl border border-slate-800">
             {/* Moving Background Pill */}
             <div 
               className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-indigo-600 rounded-lg shadow-sm transition-all duration-300 ease-out
               ${billingCycle === 'monthly' ? 'left-1' : 'left-[calc(50%+0px)]'}
               `}
             />
             
             {/* Monthly Button */}
             <button
                onClick={() => setBillingCycle('monthly')}
                className={`relative z-10 px-8 py-2 text-sm font-medium rounded-lg transition-colors duration-200 
                  ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}
                `}
              >
                Monthly
              </button>

             {/* Yearly Button */}
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`relative z-10 px-8 py-2 text-sm font-medium rounded-lg transition-colors duration-200 flex items-center gap-2
                  ${billingCycle === 'yearly' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}
                `}
              >
                Yearly
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide border transition-colors
                   ${billingCycle === 'yearly' 
                      ? 'bg-amber-500 text-white border-amber-400' 
                      : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}
                `}>
                    2 Months Free
                </span>
              </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 items-start">
          
          {/* TIER 1: FREE */}
          <div 
            onClick={() => setSelectedTier('free')}
            className={getCardStyles('free')}
          >
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-slate-200">Free Trial</h3>
              <p className="text-slate-500 text-sm mt-1">For hobbyists & testing</p>
            </div>
            <div className="mb-6 flex flex-col">
              <div className="flex items-baseline gap-1">
                 <span className="text-4xl font-bold text-white">$0</span>
                 <span className="text-slate-500">/mo</span>
              </div>
            </div>
            
            <ul className="space-y-4 mb-8 flex-1">
              <Feature text="50 Credits / month" />
              <Feature text="Standard Generation Speed" />
              <Feature text="Access to SVD & Minimax" />
              <Feature text="Community Support" />
            </ul>

            <button 
              disabled
              className="w-full py-3 rounded-xl bg-slate-800 text-slate-500 font-semibold cursor-not-allowed border border-slate-700/50"
            >
              Current Plan
            </button>
          </div>

          {/* TIER 2: CREATOR (HIGHLIGHT) */}
          <div 
            onClick={() => setSelectedTier('creator')}
            className={getCardStyles('creator')}
          >
            {/* Badge is always visible for Creator tier to indicate value, but style changes on selection */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-1 rounded-full text-xs font-bold tracking-wide shadow-lg whitespace-nowrap z-20">
              BEST VALUE 🔥
            </div>

            <div className="mb-4">
              <h3 className="text-xl font-semibold text-white">Creator</h3>
              <p className="text-indigo-200/60 text-sm mt-1">Market disruptor deal</p>
            </div>
            
            <div className="mb-6 flex flex-col">
               <div className="flex items-baseline gap-1">
                 <span className="text-5xl font-bold text-white">
                    {billingCycle === 'monthly' ? '$9.90' : '$8.25'}
                 </span>
                 <span className="text-slate-400">/mo</span>
               </div>
               {billingCycle === 'yearly' ? (
                 <span className="text-xs text-indigo-300 mt-1 font-medium bg-indigo-500/10 inline-block px-2 py-1 rounded self-start">
                    Billed $99 yearly (Save $19.80)
                 </span>
               ) : (
                 <span className="text-xs text-slate-500 mt-1">Billed monthly</span>
               )}
            </div>
            
            <ul className="space-y-4 mb-8 flex-1">
              <Feature text={billingCycle === 'yearly' ? "12,000 Credits / year" : "1,000 Credits / month"} highlight={selectedTier === 'creator'} />
              <Feature text="~66 High-End Wan 2.1 Videos/mo" />
              <Feature text="Access to Wan 2.1 & Mochi" highlight={selectedTier === 'creator'} />
              <Feature text="Commercial License" />
              <Feature text="No Watermark" />
              <Feature text="Fast Priority Queue" />
            </ul>

            <button 
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering card selection again if button clicked
                handleSubscribe('creator');
              }}
              className="w-full py-3 rounded-xl font-bold transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25"
            >
              Subscribe via Stripe
            </button>
          </div>

          {/* TIER 3: DIRECTOR */}
          <div 
             onClick={() => setSelectedTier('director')}
             className={getCardStyles('director')}
          >
             <div className="mb-4">
              <h3 className="text-xl font-semibold text-slate-200">Director</h3>
              <p className="text-slate-500 text-sm mt-1">Power users & studios</p>
            </div>
            
            <div className="mb-6 flex flex-col">
               <div className="flex items-baseline gap-1">
                 <span className="text-4xl font-bold text-white">
                    {billingCycle === 'monthly' ? '$29.90' : '$24.91'}
                 </span>
                 <span className="text-slate-500">/mo</span>
               </div>
               {billingCycle === 'yearly' ? (
                 <span className="text-xs text-green-400 mt-1 font-medium">
                    Billed $299 yearly (Save $59.80)
                 </span>
               ) : (
                 <span className="text-xs text-slate-500 mt-1">Billed monthly</span>
               )}
            </div>
            
            <ul className="space-y-4 mb-8 flex-1">
              <Feature text={billingCycle === 'yearly' ? "42,000 Credits / year" : "3,500 Credits / month"} />
              <Feature text="~230 High-End Videos/mo" />
              <Feature text="Highest Priority Speed" />
              <Feature text="1-on-1 Direct Support" />
              <Feature text="Early Access to New Models" />
            </ul>

            <button 
               onClick={(e) => {
                 e.stopPropagation();
                 handleSubscribe('director');
               }}
              className="w-full py-3 rounded-xl font-semibold transition-colors border border-slate-600 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white hover:border-slate-500"
            >
               Subscribe via Stripe
            </button>
          </div>

        </div>
        
        {/* Footer Link & Text */}
        <div className="mt-10 pt-6 border-t border-slate-800 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-slate-500">
             <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 2C13.5 2.82843 12.8284 3.5 12 3.5C11.1716 3.5 10.5 2.82843 10.5 2C10.5 1.17157 11.1716 0.5 12 0.5C12.8284 0.5 13.5 1.17157 13.5 2ZM17.5 7C17.5 7.82843 16.8284 8.5 16 8.5C15.1716 8.5 14.5 7.82843 14.5 7C14.5 6.17157 15.1716 5.5 16 5.5C16.8284 5.5 17.5 6.17157 17.5 7ZM20.5 12C20.5 12.8284 19.8284 13.5 19 13.5C18.1716 13.5 17.5 12.8284 17.5 12C17.5 11.1716 18.1716 10.5 19 10.5C19.8284 10.5 20.5 11.1716 20.5 12ZM7.5 7C7.5 7.82843 6.82843 8.5 6 8.5C5.17157 8.5 4.5 7.82843 4.5 7C4.5 6.17157 5.17157 5.5 6 5.5C6.8284 5.5 7.5 6.17157 7.5 7ZM3.5 12C3.5 12.8284 2.82843 13.5 2 13.5C1.17157 13.5 0.5 12.8284 0.5 12C0.5 11.1716 1.17157 10.5 2 10.5C2.82843 10.5 3.5 11.1716 3.5 12ZM16 16.5C16.8284 16.5 17.5 17.1716 17.5 18C17.5 18.8284 16.8284 19.5 16 19.5C15.1716 19.5 14.5 18.8284 14.5 18C14.5 17.1716 15.1716 16.5 16 16.5ZM8 16.5C8.82843 16.5 9.5 17.1716 9.5 18C9.5 18.8284 8.8284 19.5 8 19.5C7.17157 19.5 6.5 18.8284 6.5 18C6.5 17.1716 7.17157 16.5 8 16.5ZM13.5 22C13.5 22.8284 12.8284 23.5 12 23.5C11.1716 23.5 10.5 22.8284 10.5 22C10.5 21.1716 11.1716 20.5 12 20.5C12.8284 20.5 13.5 21.1716 13.5 22Z" /></svg>
             <span className="text-xs">Powered by <strong>Stripe</strong>. Secure 256-bit SSL Encrypted Payment.</span>
          </div>
          
          <button 
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors hover:underline cursor-pointer"
          >
            Maybe Later, Back to Studio
          </button>
        </div>
      </div>
    </div>
  );
};

const Feature: React.FC<{ text: string; highlight?: boolean }> = ({ text, highlight }) => (
  <li className="flex items-start gap-3">
    <div className={`mt-0.5 rounded-full p-0.5 shrink-0 ${highlight ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
      <CheckIcon className="w-4 h-4" />
    </div>
    <span className={`text-sm ${highlight ? 'text-white font-medium' : 'text-slate-300'}`}>{text}</span>
  </li>
);

export default PricingModal;
