import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, OAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { Chrome, Apple, Mail, X, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [view, setView] = useState<'options' | 'email'>('options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (error) {
      console.error("Auth error:", error);
      setError("Google sign-in failed.");
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const appleProvider = new OAuthProvider('apple.com');
      await signInWithPopup(auth, appleProvider);
      onClose();
    } catch (error: any) {
      console.error("Apple auth error:", error);
      if (error.code === 'auth/operation-not-allowed') {
        setError("Apple Sign-in is not enabled in Firebase Console. Please enable it in Authentication > Sign-in method.");
      } else {
        setError("Apple sign-in failed or was cancelled.");
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      onClose();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-4 z-[101] focus:outline-none">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="bg-[#121212] border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-primary/50 to-transparent" />
                  
                  <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                      {view === 'email' && (
                        <button onClick={() => setView('options')} className="p-2 hover:bg-white/5 rounded-full text-white/40">
                          <ArrowLeft className="w-5 h-5" />
                        </button>
                      )}
                      <div>
                        <Dialog.Title className="text-2xl font-display font-bold">
                          {view === 'email' ? (isLogin ? 'Sign In' : 'Sign Up') : 'Secure Access'}
                        </Dialog.Title>
                        <Dialog.Description className="text-white/40 text-sm">
                          {view === 'email' ? 'Enter your credentials to continue.' : 'Select your preferred entry method.'}
                        </Dialog.Description>
                      </div>
                    </div>
                    <Dialog.Close asChild>
                      <button className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/40">
                        <X className="w-5 h-5" />
                      </button>
                    </Dialog.Close>
                  </div>

                  {error && <p className="mb-4 text-xs text-red-500 bg-red-500/10 p-2 rounded border border-red-500/20">{error}</p>}

                  <div className="space-y-4">
                    {view === 'options' ? (
                      <>
                        <button 
                          onClick={handleGoogleSignIn}
                          className="w-full py-4 bg-white text-black rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all text-sm"
                        >
                          <Chrome className="w-5 h-5" />
                          Continue with Google
                        </button>

                        <button 
                          onClick={handleAppleSignIn}
                          className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-white/10 hover:scale-[1.02] active:scale-95 transition-all text-sm group"
                        >
                          <Apple className="w-5 h-5 text-white/60 group-hover:text-white" />
                          Continue with Apple
                        </button>

                        <div className="flex items-center gap-4 py-2">
                          <div className="flex-1 h-px bg-white/5" />
                          <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">or</span>
                          <div className="flex-1 h-px bg-white/5" />
                        </div>

                        <button 
                          onClick={() => setView('email')}
                          className="w-full py-4 bg-transparent border border-white/10 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-white/5 transition-all text-sm"
                        >
                          <Mail className="w-5 h-5 text-brand-primary" />
                          Email & Password
                        </button>
                      </>
                    ) : (
                      <form onSubmit={handleEmailAuth} className="space-y-4">
                        <input 
                          type="email"
                          placeholder="Email Address"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary text-white"
                        />
                        <input 
                          type="password"
                          placeholder="Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary text-white"
                        />
                        <button 
                          type="submit"
                          className="w-full py-4 bg-brand-primary text-white rounded-2xl font-bold hover:scale-[1.02] active:scale-95 transition-all text-sm shadow-xl shadow-brand-primary/20"
                        >
                          {isLogin ? 'Sign In' : 'Create Account'}
                        </button>
                        <button 
                          type="button"
                          onClick={() => setIsLogin(!isLogin)}
                          className="w-full text-center text-xs text-white/40 hover:text-white transition-colors"
                        >
                          {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                        </button>
                      </form>
                    )}
                  </div>

                  <p className="mt-8 text-center text-[10px] text-white/20 uppercase tracking-widest leading-loose">
                    By continuing, you agree to Aegis AI <br />
                    <span className="text-white/40 underline cursor-pointer">Terms of Service</span> and <span className="text-white/40 underline cursor-pointer">Privacy Policy</span>.
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
