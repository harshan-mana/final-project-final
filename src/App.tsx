import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, ShieldAlert, User, Phone, Save, X, Zap } from 'lucide-react';
import AegisNavbar from './components/AegisNavbar';
import HelmetView from './components/HelmetView';
import AuthorityView from './components/AuthorityView';
import SettingsView from './components/SettingsView';
import AuthModal from './components/AuthModal';

export default function App() {
  const [user, setUser] = useState(auth.currentUser);
  const [guestUser, setGuestUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('aegis_guest_active');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [userRole, setUserRole] = useState<string | null>(() => {
    try {
      return localStorage.getItem('aegis_guest_role') || null;
    } catch {
      return null;
    }
  });
  const [currentView, setCurrentView] = useState<'helmet' | 'authority' | 'profile' | 'settings'>('helmet');
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingErrors, setOnboardingErrors] = useState<{[key: string]: string}>({});
  const [onboardingData, setOnboardingData] = useState({
    name: '',
    phone: '',
    guardianName: '',
    guardianPhone: ''
  });

  const effectiveUser = user || guestUser;

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (unsubscribeProfile) unsubscribeProfile();

      if (u) {
        // Real-time listener for user profile
        unsubscribeProfile = onSnapshot(doc(db, 'users', u.uid), (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setUserRole(data.role || 'Driver');
            
            // Onboarding logic: check for missing essential fields
            const isMissingInfo = !data.phone || !data.emergencyContact1?.phone || data.phone === '' || data.emergencyContact1?.phone === '';
            setNeedsProfile(isMissingInfo);
            
            // Only show onboarding if user just logged in and info is missing
            if (isMissingInfo && !showOnboarding) {
              setShowOnboarding(true);
            }
            
            // If missing info and currently on helmet view, force settings view
            if (isMissingInfo && currentView === 'helmet') {
              setCurrentView('settings');
            }
          } else {
            // New user setup
            handleNewUser(u.uid, u.email || '');
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
          setLoading(false);
        });
      } else {
        if (!guestUser) {
          setUserRole(null);
          setNeedsProfile(false);
          setShowOnboarding(false);
        } else {
          setUserRole('Driver');
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [currentView, guestUser]);

  const handleGuestLogin = () => {
    const guest = {
      uid: 'guest_sentry_node',
      displayName: 'Guest Sentry Pilot',
      email: 'guest@aegis-sentry.local',
      isAnonymous: true,
    };
    try {
      localStorage.setItem('aegis_guest_active', JSON.stringify(guest));
      localStorage.setItem('aegis_guest_role', 'Driver');
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    setGuestUser(guest);
    setUserRole('Driver');
    setNeedsProfile(false);
    setShowOnboarding(false);
    setCurrentView('helmet');
    setIsAuthModalOpen(false);
  };

  const handleSignOut = async () => {
    try {
      localStorage.removeItem('aegis_guest_active');
      localStorage.removeItem('aegis_guest_role');
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    setGuestUser(null);
    setUser(null);
    setUserRole(null);
    try {
      await auth.signOut();
    } catch (e) {
      console.warn('Firebase sign out error:', e);
    }
  };

  const handleNewUser = async (uid: string, email: string) => {
    const defaultRole = email.includes('admin') || email.includes('rto') ? 'RTO' : 'Driver';
    try {
      await setDoc(doc(db, 'users', uid), {
        userId: uid,
        email: email,
        role: defaultRole,
        name: auth.currentUser?.displayName || '',
        createdAt: new Date().toISOString(),
        phone: '',
        emergencyContact1: { name: '', phone: '' },
        emergencyContact2: { name: '', phone: '' },
        autoReport: true,
        guardianNotifications: false
      });
      setUserRole(defaultRole);
      setNeedsProfile(true);
      setShowOnboarding(true);
      setCurrentView('settings');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  };

  const submitOnboarding = async () => {
    if (!effectiveUser) return;
    const nameRegex = /^[a-zA-Z\s]+$/;
    const phoneRegex = /^\d{10,15}$/;
    const newErrors: {[key: string]: string} = {};

    if (!onboardingData.name || !nameRegex.test(onboardingData.name)) {
      newErrors.name = "Full Name must contain letters and spaces only.";
    }
    if (!onboardingData.phone || !phoneRegex.test(onboardingData.phone)) {
      newErrors.phone = "Mobile Number must be 10-15 digits only.";
    }
    if (!onboardingData.guardianName || !nameRegex.test(onboardingData.guardianName)) {
      newErrors.guardianName = "Guardian Name must contain letters only.";
    }
    if (!onboardingData.guardianPhone || !phoneRegex.test(onboardingData.guardianPhone)) {
      newErrors.guardianPhone = "Guardian Contact must be 10-15 digits only.";
    }

    if (Object.keys(newErrors).length > 0) {
      setOnboardingErrors(newErrors);
      return;
    }

    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          name: onboardingData.name,
          phone: onboardingData.phone,
          emergencyContact1: {
            name: onboardingData.guardianName,
            phone: onboardingData.guardianPhone
          }
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      }
    }
    setShowOnboarding(false);
    setNeedsProfile(false);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#050816] relative overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-20" />
        
        <motion.div
           initial={{ opacity: 0, scale: 0.8 }}
           animate={{ opacity: 1, scale: 1 }}
           className="relative z-10 flex flex-col items-center"
        >
          <div className="relative mb-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute -inset-8 border-2 border-dashed border-cyber-blue/20 rounded-full"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              className="absolute -inset-12 border border-cyber-orange/10 rounded-full"
            />
            <div className="p-8 bg-cyber-blue/10 rounded-full backdrop-blur-3xl border border-cyber-blue/30 relative overflow-hidden group">
              <Shield className="w-16 h-16 text-cyber-blue animate-pulse" />
              <div className="absolute inset-0 bg-gradient-to-tr from-cyber-blue/20 to-transparent pointer-events-none" />
            </div>
          </div>

          <div className="space-y-4 text-center">
            <h1 className="text-2xl font-display font-black tracking-[0.3em] text-white uppercase neon-text-blue">
              AEGIS AI
            </h1>
            <div className="flex flex-col items-center gap-2">
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-[10px] font-mono text-cyber-blue/60 uppercase tracking-widest"
              >
                Initializing Safety Grid Protocol...
              </motion.p>
              <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden relative border border-white/5">
                <motion.div 
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 w-full bg-cyber-blue shadow-[0_0_10px_#00D1FF]"
                />
              </div>
            </div>
          </div>
        </motion.div>

        <div className="absolute bottom-12 left-12 font-mono text-[8px] text-white/20 uppercase space-y-1">
          <p>System: Online</p>
          <p>Auth Layer: Verifying</p>
          <p>Neural Engine: Warm</p>
          <p>Region: AIS-SEA-GCP-NODE-32</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808]">
      <AegisNavbar 
        userRole={userRole} 
        onViewChange={setCurrentView} 
        currentView={currentView}
        onSignOut={handleSignOut}
      />
      
      <main>
        {!effectiveUser ? (
          <div className="min-h-screen flex items-center justify-center px-4 py-20 relative">
             <div className="absolute inset-0 z-0 opacity-10 pointer-events-none overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-primary rounded-full blur-[200px]" />
             </div>
             
             <div className="max-w-2xl text-center z-10">
               <motion.div 
                 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                 className="flex justify-center mb-8"
               >
                 <div className="p-4 bg-brand-primary rounded-3xl shadow-2xl shadow-brand-primary/20">
                   <ShieldAlert className="w-16 h-16 text-white" />
                 </div>
               </motion.div>
               <h1 className="text-5xl sm:text-7xl font-display font-bold tracking-tighter mb-6 leading-none">
                 AI TRAFFIC <br /> <span className="text-brand-primary">SAFETY</span> FOR ALL
               </h1>
               <p className="text-white/40 text-lg mb-10 max-w-md mx-auto leading-relaxed">
                 Integrating real-time image recognition with RTO databases to prevent accidents and enforce safety standards.
               </p>
               
               <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                 <button 
                   id="btn-get-started"
                   onClick={() => setIsAuthModalOpen(true)}
                   className="w-full sm:w-auto px-10 py-4 bg-white text-black text-sm font-bold uppercase tracking-widest rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10"
                 >
                   Get Started
                 </button>
                 <button 
                   id="btn-hero-continue-as-guest"
                   onClick={handleGuestLogin}
                   className="w-full sm:w-auto px-8 py-4 bg-cyber-blue/15 border border-cyber-blue/40 text-cyber-blue text-sm font-black uppercase tracking-widest rounded-full hover:bg-cyber-blue hover:text-black hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyber-blue/10"
                 >
                   <Zap className="w-4 h-4" />
                   Continue as Guest
                 </button>
               </div>
             </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {currentView === 'helmet' && !needsProfile && <HelmetView />}
              {currentView === 'helmet' && needsProfile && (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 pt-32">
                   <ShieldAlert className="w-12 h-12 text-brand-primary animate-pulse" />
                   <h2 className="text-2xl font-bold uppercase tracking-tighter">Profile Setup Required</h2>
                   <p className="text-white/40 max-w-xs mx-auto">Please complete your personal and guardian contact details in settings to activate Aegis features.</p>
                   <button 
                    onClick={() => setCurrentView('settings')}
                    className="px-8 py-3 bg-brand-primary text-white rounded-full font-bold text-xs"
                   >
                     GO TO SETTINGS
                   </button>
                </div>
              )}
              {currentView === 'authority' && <AuthorityView />}
              {currentView === 'settings' && <SettingsView />}
              {currentView === 'profile' && <div>Profile Settings (Coming Soon)</div>}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)}
        onGuestLogin={handleGuestLogin}
      />

      {/* Mandatory Onboarding Modal */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-panel w-full max-w-md p-8 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-brand-primary" />
              
              <div className="flex items-center gap-4 mb-6">
                 <div className="p-3 bg-brand-primary/10 rounded-2xl">
                    <User className="w-6 h-6 text-brand-primary" />
                 </div>
                 <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter">Profile Activation</h2>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Verify identity & Safety links</p>
                 </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-white/40 uppercase">Your Full Name <span className="text-red-500">*</span></label>
                  <input 
                    type="text"
                    placeholder="Enter name (Letters only)"
                    value={onboardingData.name}
                    onChange={e => {
                      setOnboardingData({...onboardingData, name: e.target.value});
                      if (onboardingErrors.name) {
                        const next = {...onboardingErrors};
                        delete next.name;
                        setOnboardingErrors(next);
                      }
                    }}
                    className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary transition-colors ${onboardingErrors.name ? 'border-red-500 bg-red-500/5' : 'border-white/10'}`}
                  />
                  {onboardingErrors.name && <p className="text-[9px] text-red-500 font-bold uppercase">{onboardingErrors.name}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-white/40 uppercase">Your Mobile Number <span className="text-red-500">*</span></label>
                  <input 
                    type="tel"
                    placeholder="10-15 digits only"
                    value={onboardingData.phone}
                    onChange={e => {
                      setOnboardingData({...onboardingData, phone: e.target.value});
                       if (onboardingErrors.phone) {
                        const next = {...onboardingErrors};
                        delete next.phone;
                        setOnboardingErrors(next);
                      }
                    }}
                    className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary transition-colors ${onboardingErrors.phone ? 'border-red-500 bg-red-500/5' : 'border-white/10'}`}
                  />
                  {onboardingErrors.phone && <p className="text-[9px] text-red-500 font-bold uppercase">{onboardingErrors.phone}</p>}
                </div>
                <div className="space-y-1 p-4 bg-brand-primary/5 rounded-2xl border border-brand-primary/10">
                  <p className="text-[10px] font-black text-brand-primary uppercase mb-3 flex items-center gap-2">
                    <ShieldAlert className="w-3 h-3" /> Guardian Information
                  </p>
                  <div className="space-y-3">
                    <div>
                      <input 
                        type="text"
                        placeholder="Guardian Name"
                        value={onboardingData.guardianName}
                        onChange={e => {
                          setOnboardingData({...onboardingData, guardianName: e.target.value});
                          if (onboardingErrors.guardianName) {
                            const next = {...onboardingErrors};
                            delete next.guardianName;
                            setOnboardingErrors(next);
                          }
                        }}
                        className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary transition-colors ${onboardingErrors.guardianName ? 'border-red-500 bg-red-500/5' : 'border-white/10'}`}
                      />
                      {onboardingErrors.guardianName && <p className="text-[8px] text-red-500 font-bold uppercase mt-1">{onboardingErrors.guardianName}</p>}
                    </div>
                    <div>
                      <input 
                        type="tel"
                        placeholder="Guardian Phone"
                        value={onboardingData.guardianPhone}
                        onChange={e => {
                          setOnboardingData({...onboardingData, guardianPhone: e.target.value});
                          if (onboardingErrors.guardianPhone) {
                            const next = {...onboardingErrors};
                            delete next.guardianPhone;
                            setOnboardingErrors(next);
                          }
                        }}
                        className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary transition-colors ${onboardingErrors.guardianPhone ? 'border-red-500 bg-red-500/5' : 'border-white/10'}`}
                      />
                      {onboardingErrors.guardianPhone && <p className="text-[8px] text-red-500 font-bold uppercase mt-1">{onboardingErrors.guardianPhone}</p>}
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={submitOnboarding}
                className="w-full py-4 mt-8 bg-brand-primary text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-brand-primary/90 transition-all shadow-xl shadow-brand-primary/20 active:scale-95"
              >
                Save & Proceed
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Background Ambience */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-brand-accent/5 rounded-full blur-[100px]" />
      </div>
    </div>
  );
}
