import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Chrome, Apple, Mail, X, ArrowLeft, Zap, CheckCircle2, Loader2, Lock, Shield, User, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AegisAuthUser, LOCAL_AUTH_STORAGE_KEY, LOCAL_PROFILE_STORAGE_KEY } from '../types/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: AegisAuthUser) => void;
}

type AuthProvider = 'google' | 'apple' | 'email' | null;

export default function AuthModal({ isOpen, onClose, onLogin }: AuthModalProps) {
  const [view, setView] = useState<'options' | 'email'>('options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  
  // Realistic simulated OAuth Handshake state
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [activeProvider, setActiveProvider] = useState<AuthProvider>(null);
  const [authStep, setAuthStep] = useState<'connecting' | 'verifying' | 'success'>('connecting');
  const [simulatedAccount, setSimulatedAccount] = useState<{
    name: string;
    email: string;
    avatar: string;
    role: 'Driver' | 'RTO';
  }>({
    name: '',
    email: '',
    avatar: '',
    role: 'Driver',
  });

  const resetState = () => {
    setView('options');
    setEmail('');
    setPassword('');
    setFullName('');
    setError('');
    setIsAuthenticating(false);
    setActiveProvider(null);
  };

  const handleModalClose = () => {
    resetState();
    onClose();
  };

  // 1. Google OAuth Simulation with realistic handshake
  const handleGoogleSignIn = () => {
    setError('');
    setActiveProvider('google');
    setAuthStep('connecting');
    setIsAuthenticating(true);

    const mockAccount = {
      name: 'Sasidhar R',
      email: 'sasidhar.23ise@cambridge.edu.in',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80',
      role: 'Driver' as const,
    };
    setSimulatedAccount(mockAccount);

    setTimeout(() => {
      setAuthStep('verifying');
      setTimeout(() => {
        setAuthStep('success');
        setTimeout(() => {
          const authUser: AegisAuthUser = {
            uid: `google_user_${Date.now()}`,
            displayName: mockAccount.name,
            email: mockAccount.email,
            photoURL: mockAccount.avatar,
            provider: 'google',
            role: mockAccount.role,
          };

          // Persist user and profile in localStorage
          localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(authUser));
          localStorage.setItem(
            LOCAL_PROFILE_STORAGE_KEY,
            JSON.stringify({
              name: mockAccount.name,
              email: mockAccount.email,
              phone: '9876543210',
              role: mockAccount.role,
              emergencyContact1: { name: 'Emergency Control Room', phone: '1120001122' },
              emergencyContact2: { name: 'Safety Guardian', phone: '9988776655' },
              autoReport: true,
              guardianNotifications: true,
              photoURL: mockAccount.avatar,
            })
          );

          onLogin(authUser);
          handleModalClose();
        }, 600);
      }, 700);
    }, 600);
  };

  // 2. Apple OAuth Simulation with realistic handshake
  const handleAppleSignIn = () => {
    setError('');
    setActiveProvider('apple');
    setAuthStep('connecting');
    setIsAuthenticating(true);

    const mockAccount = {
      name: 'Jordan Reed',
      email: 'jordan.reed@privaterelay.appleid.com',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80',
      role: 'Driver' as const,
    };
    setSimulatedAccount(mockAccount);

    setTimeout(() => {
      setAuthStep('verifying');
      setTimeout(() => {
        setAuthStep('success');
        setTimeout(() => {
          const authUser: AegisAuthUser = {
            uid: `apple_user_${Date.now()}`,
            displayName: mockAccount.name,
            email: mockAccount.email,
            photoURL: mockAccount.avatar,
            provider: 'apple',
            role: mockAccount.role,
          };

          // Persist user and profile in localStorage
          localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(authUser));
          localStorage.setItem(
            LOCAL_PROFILE_STORAGE_KEY,
            JSON.stringify({
              name: mockAccount.name,
              email: mockAccount.email,
              phone: '9845012345',
              role: mockAccount.role,
              emergencyContact1: { name: 'Dispatch Station 112', phone: '1120001122' },
              emergencyContact2: { name: 'Medical Response', phone: '1080001088' },
              autoReport: true,
              guardianNotifications: true,
              photoURL: mockAccount.avatar,
            })
          );

          onLogin(authUser);
          handleModalClose();
        }, 600);
      }, 700);
    }, 600);
  };

  // 3. Email & Password Local Authentication
  const handleEmailAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (cleanPassword.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    const emailNamePart = cleanEmail.split('@')[0];
    const derivedName = fullName.trim() || emailNamePart.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const role: 'Driver' | 'RTO' = cleanEmail.toLowerCase().includes('rto') || cleanEmail.toLowerCase().includes('admin') ? 'RTO' : 'Driver';

    const authUser: AegisAuthUser = {
      uid: `email_user_${Date.now()}`,
      displayName: derivedName,
      email: cleanEmail,
      provider: 'email',
      role,
    };

    // Save session to localStorage
    localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(authUser));
    
    // Check if profile exists already or generate a clean one
    const existingProfile = localStorage.getItem(LOCAL_PROFILE_STORAGE_KEY);
    if (!existingProfile) {
      localStorage.setItem(
        LOCAL_PROFILE_STORAGE_KEY,
        JSON.stringify({
          name: derivedName,
          email: cleanEmail,
          phone: '9876543210',
          role,
          emergencyContact1: { name: 'Emergency Control', phone: '1120001122' },
          emergencyContact2: { name: 'Guardian Dispatch', phone: '1080001088' },
          autoReport: true,
          guardianNotifications: true,
        })
      );
    }

    onLogin(authUser);
    handleModalClose();
  };

  // 4. Continue as Guest / Skip
  const handleGuestAccess = () => {
    const guestUser: AegisAuthUser = {
      uid: 'guest_sentry_node',
      displayName: 'Guest Sentry Pilot',
      email: 'guest@aegis-sentry.local',
      provider: 'guest',
      role: 'Driver',
      isAnonymous: true,
    };

    localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(guestUser));
    onLogin(guestUser);
    handleModalClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleModalClose()}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-4 z-[101] focus:outline-none">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="bg-[#121216] border border-white/10 rounded-3xl p-7 shadow-2xl relative overflow-hidden text-white"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-blue to-transparent" />
                  
                  {/* Top Header */}
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      {view === 'email' && !isAuthenticating && (
                        <button 
                          onClick={() => { setView('options'); setError(''); }} 
                          className="p-2 hover:bg-white/5 rounded-full text-white/50 hover:text-white transition-colors"
                        >
                          <ArrowLeft className="w-5 h-5" />
                        </button>
                      )}
                      <div>
                        <Dialog.Title className="text-xl font-display font-black tracking-tight">
                          {isAuthenticating
                            ? activeProvider === 'google'
                              ? 'Google Authentication'
                              : 'Apple ID Verification'
                            : view === 'email'
                            ? (isLogin ? 'Sign In with Email' : 'Create Rider Account')
                            : 'Secure Access & Entry'}
                        </Dialog.Title>
                        <Dialog.Description className="text-white/40 text-xs">
                          {isAuthenticating
                            ? 'Connecting to identity provider credentials'
                            : view === 'email'
                            ? 'Enter your credentials to access the telemetry cockpit.'
                            : 'Select your preferred entry method or continue instantly.'}
                        </Dialog.Description>
                      </div>
                    </div>
                    <Dialog.Close asChild>
                      <button 
                        disabled={isAuthenticating}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white disabled:opacity-30"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </Dialog.Close>
                  </div>

                  {/* Error Notification */}
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 text-xs text-red-400 bg-red-500/10 p-3 rounded-xl border border-red-500/20 flex flex-col gap-1.5"
                    >
                      <p className="font-mono">{error}</p>
                    </motion.div>
                  )}

                  {/* Simulated OAuth Handshake Animation */}
                  {isAuthenticating ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="py-8 flex flex-col items-center justify-center text-center space-y-5"
                    >
                      <div className="relative">
                        <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center p-3 shadow-inner">
                          {activeProvider === 'google' ? (
                            <Chrome className="w-10 h-10 text-white" />
                          ) : (
                            <Apple className="w-10 h-10 text-white" />
                          )}
                        </div>
                        {authStep === 'success' ? (
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -bottom-2 -right-2 p-1.5 bg-cyber-green rounded-full shadow-lg shadow-cyber-green/50"
                          >
                            <CheckCircle2 className="w-5 h-5 text-black" />
                          </motion.div>
                        ) : (
                          <div className="absolute -bottom-2 -right-2 p-1.5 bg-cyber-blue rounded-full shadow-lg shadow-cyber-blue/50 animate-spin">
                            <Loader2 className="w-5 h-5 text-black" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm font-bold text-white flex items-center justify-center gap-2">
                          {authStep === 'connecting' && 'Connecting to Identity Service...'}
                          {authStep === 'verifying' && 'Verifying Security Token & Passkey...'}
                          {authStep === 'success' && 'Authenticated Successfully!'}
                        </div>
                        <div className="text-xs font-mono text-white/50">
                          {simulatedAccount.name} ({simulatedAccount.email})
                        </div>
                      </div>

                      <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/5">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-cyber-blue to-cyber-green"
                          initial={{ width: '10%' }}
                          animate={{ 
                            width: authStep === 'connecting' ? '40%' : authStep === 'verifying' ? '85%' : '100%' 
                          }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    </motion.div>
                  ) : (
                    <div className="space-y-3.5">
                      {view === 'options' ? (
                        <>
                          {/* 1. Google Sign-In */}
                          <button 
                            id="btn-google-auth"
                            onClick={handleGoogleSignIn}
                            className="w-full py-3.5 px-4 bg-white text-black rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-95 transition-all text-sm shadow-md group cursor-pointer"
                          >
                            <Chrome className="w-4 h-4 text-black group-hover:scale-110 transition-transform" />
                            <span>Continue with Google</span>
                          </button>

                          {/* 2. Apple Sign-In */}
                          <button 
                            id="btn-apple-auth"
                            onClick={handleAppleSignIn}
                            className="w-full py-3.5 px-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-white/10 hover:scale-[1.01] active:scale-95 transition-all text-sm group cursor-pointer"
                          >
                            <Apple className="w-4 h-4 text-white/70 group-hover:text-white group-hover:scale-110 transition-all" />
                            <span>Continue with Apple</span>
                          </button>

                          {/* 3. Email & Password Toggle */}
                          <button 
                            id="btn-email-auth-toggle"
                            onClick={() => { setView('email'); setError(''); }}
                            className="w-full py-3 bg-transparent border border-white/10 text-white/80 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/5 transition-all text-xs cursor-pointer"
                          >
                            <Mail className="w-4 h-4 text-brand-primary" />
                            <span>Email & Password</span>
                          </button>

                          <div className="flex items-center gap-4 py-1.5">
                            <div className="flex-1 h-px bg-white/10" />
                            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest font-mono">or instant access</span>
                            <div className="flex-1 h-px bg-white/10" />
                          </div>

                          {/* 4. Continue as Guest Button */}
                          <button 
                            id="btn-continue-as-guest"
                            onClick={handleGuestAccess}
                            className="w-full py-4 px-5 bg-gradient-to-r from-cyber-blue to-[#00A3FF] text-black font-black rounded-2xl flex items-center justify-between hover:scale-[1.02] active:scale-95 transition-all text-sm shadow-lg shadow-cyber-blue/25 group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-1.5 bg-black/10 rounded-lg">
                                <Zap className="w-4 h-4 text-black" />
                              </div>
                              <div className="text-left">
                                <div className="font-display font-black leading-tight">Continue as Guest</div>
                                <div className="text-[10px] text-black/70 font-mono tracking-wider">Instant Dashboard Access • No Sign-In</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-mono bg-black/10 px-3 py-1.5 rounded-full group-hover:translate-x-0.5 transition-transform">
                              <span>Skip</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </div>
                          </button>
                        </>
                      ) : (
                        /* Expanded Email & Password Form */
                        <form onSubmit={handleEmailAuth} className="space-y-3.5">
                          {!isLogin && (
                            <div>
                              <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1">
                                Full Name
                              </label>
                              <div className="relative">
                                <User className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input 
                                  id="input-auth-name"
                                  type="text"
                                  placeholder="e.g. Alex Rider"
                                  value={fullName}
                                  onChange={(e) => setFullName(e.target.value)}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-cyber-blue text-white placeholder:text-white/20 transition-colors"
                                />
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1">
                              Email Address
                            </label>
                            <div className="relative">
                              <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                              <input 
                                id="input-auth-email"
                                type="email"
                                placeholder="name@domain.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-cyber-blue text-white placeholder:text-white/20 transition-colors"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1">
                              Password
                            </label>
                            <div className="relative">
                              <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                              <input 
                                id="input-auth-password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-cyber-blue text-white placeholder:text-white/20 transition-colors"
                              />
                            </div>
                          </div>

                          <button 
                            id="btn-auth-submit"
                            type="submit"
                            className="w-full py-3.5 bg-cyber-blue text-black font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all text-sm shadow-lg shadow-cyber-blue/20 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Shield className="w-4 h-4" />
                            {isLogin ? 'Sign In & Launch Cockpit' : 'Create Account & Launch'}
                          </button>
                          
                          <div className="flex items-center justify-between pt-1 text-xs">
                            <button 
                              type="button"
                              onClick={() => { setIsLogin(!isLogin); setError(''); }}
                              className="text-white/50 hover:text-white transition-colors cursor-pointer"
                            >
                              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                            </button>
                            <button 
                              type="button"
                              onClick={handleGuestAccess}
                              className="text-cyber-blue hover:underline font-mono cursor-pointer flex items-center gap-1"
                            >
                              <Zap className="w-3 h-3" /> Skip to Guest
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  <p className="mt-6 text-center text-[10px] text-white/30 uppercase tracking-widest leading-loose font-mono">
                    Aegis AI Sentry Grid • Traffic Safety Mobile & RTO
                  </p>
                </motion.div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
