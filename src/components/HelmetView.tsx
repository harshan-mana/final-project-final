import React, { useRef, useState, useEffect } from 'react';
import { Camera, AlertTriangle, Eye, ShieldCheck, Activity, Zap, Bell, MapPin, Phone, MessageSquare, Plus, ShieldAlert, X, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeHelmetFeed, AnalysisResult } from '../services/geminiService';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { addDoc, collection, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import * as Dialog from '@radix-ui/react-dialog';

export default function HelmetView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisDuration, setAnalysisDuration] = useState<number | null>(null);
  const [recentViolations, setRecentViolations] = useState<AnalysisResult[]>([]);
  const [isSOSModalOpen, setIsSOSModalOpen] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [streamSource, setStreamSource] = useState<'local' | 'esp32'>('local');
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (isCapturing) {
      setCameraError(null);
      startCamera();
    } else {
      stopCamera();
    }
  }, [isCapturing]);

  const startCamera = async () => {
    setIsCapturing(true);
    setCameraError(null);
    try {
      const espUrl = localStorage.getItem('esp32_url');
      const connectedModule = localStorage.getItem('connected_module');
      
      if (streamSource === 'esp32') {
        if (!espUrl || !connectedModule) {
          setCameraError("Module not connected. Please go to Settings to pair your Aegis Helmet.");
          setIsCapturing(false);
          return;
        }
        console.log("Syncing with Hardware Bridge at:", espUrl);
        const module = JSON.parse(connectedModule);
        console.log(`Active Hardware: ${module.name} [${module.id}]`);
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Camera access failed:", err);
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError("Hardware Error: Requested camera device not found. Please ensure your camera is connected.");
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError("Permission Error: Camera access was denied by the browser.");
      } else {
        setCameraError(err.message || "Failed to access camera interface.");
      }
      setIsCapturing(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsAnalyzing(true);
    const startTime = Date.now();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);

    const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
    const result = await analyzeHelmetFeed(base64);
    
    setAnalysisDuration(Date.now() - startTime);
    
    // Cross-reference with RTO Database
    if (result.vehicleNumber && result.vehicleNumber !== "Unknown") {
      try {
        const vehicleDoc = await getDoc(doc(db, 'vehicles', result.vehicleNumber));
        if (!vehicleDoc.exists()) {
          if (result.violationType === 'NONE') {
            result.violationType = 'FAKE_PLATE';
            result.description = `Vehicle ${result.vehicleNumber} not found in RTO registry.`;
          }
        }
      } catch (e) {
        console.error("RTO Check failed:", e);
      }
    }
    
    setAnalysis(result);
    setIsAnalyzing(false);

    // Automatic SOS Trigger on high-confidence accident detection
    if (result.violationType === 'ACCIDENT' && result.confidence > 0.8) {
      console.warn("CRITICAL: Accident detected. Triggering automated SOS protocol.");
      setIsSOSModalOpen(true);
    }

    if (result.violationType !== 'NONE' && result.confidence > 0.7) {
      await logViolation(result, canvas.toDataURL('image/jpeg'));
    }
  };

  const manualViolationCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    const photoUrl = canvas.toDataURL('image/jpeg');

    const manualResult: AnalysisResult = {
      violationType: 'MANUAL_REPORT',
      vehicleNumber: 'MANUAL',
      confidence: 1.0,
      description: 'User initiated manual violation capture.'
    };

    await logViolation(manualResult, photoUrl);
    alert("Manual violation captured and logged.");
  };

  const logViolation = async (violation: AnalysisResult, photoUrl: string) => {
    if (!auth.currentUser) return;
    
    const path = 'violations';
    try {
      await addDoc(collection(db, path), {
        vehicleNumber: violation.vehicleNumber,
        type: violation.violationType,
        description: violation.description,
        photoUrl: photoUrl,
        timestamp: serverTimestamp(),
        reporterId: auth.currentUser.uid,
        status: 'Pending'
      });
      setRecentViolations(prev => [violation, ...prev].slice(0, 5));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleSOSRequest = () => {
    setIsSOSModalOpen(true);
    // Non-blocking location acquisition
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => setLocationEnabled(true),
        () => setLocationEnabled(false),
        { timeout: 5000, enableHighAccuracy: true }
      );
    }
  };

  const executeSOSAction = async (type: 'whatsapp' | 'ambulance' | 'police' | 'other') => {
    if (!auth.currentUser) {
      alert("Session expired. Please log in again.");
      return;
    }

    setIsSOSModalOpen(false); // Close UI early for responsiveness

    // Attempt to get fresh location for the log, with a timeout
    let finalPos: GeolocationPosition | null = null;
    try {
      finalPos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
      });
    } catch (e) {
      console.warn("Fast location fix failed, using cached or null.");
    }

    const googleMapsUrl = finalPos ? `https://www.google.com/maps?q=${finalPos.coords.latitude},${finalPos.coords.longitude}` : "";

    const path = 'alerts';
    try {
      const userProfile = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const profileData = userProfile.exists() ? userProfile.data() : {};

      await addDoc(collection(db, path), {
        userId: auth.currentUser.uid,
        userName: profileData.name || auth.currentUser.displayName || "Unknown Driver",
        userPhone: profileData.phone || "No Contact info",
        type: 'SOS_TRIGGER',
        actionType: type,
        timestamp: serverTimestamp(),
        location: finalPos ? { lat: finalPos.coords.latitude, lng: finalPos.coords.longitude } : null,
        googleMapsUrl: googleMapsUrl
      });
    } catch (e) {
      console.error("Alert logging failed:", e);
    }

    // Process external actions
    switch(type) {
      case 'whatsapp':
        const waMsg = `EMERGENCY SOS! Aegis Helmet detected a critical situation. User requires immediate assistance. Location: ${googleMapsUrl || "Unavailable"}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(waMsg)}`, '_blank');
        break;
      case 'ambulance':
        window.location.href = "tel:102";
        break;
      case 'police':
        window.location.href = "tel:100";
        break;
      case 'other':
        window.location.href = "tel:112";
        break;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-24 pb-12 px-4 max-w-[1400px] mx-auto">
      <div className="lg:col-span-2 space-y-6">
        <div className="glass-panel overflow-hidden relative aspect-video bg-black flex items-center justify-center ring-2 ring-red-500/0 hover:ring-red-500/20 transition-all">
           <div className="absolute top-4 right-4 z-50 flex gap-2">
              <button 
                onClick={handleSOSRequest}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-black shadow-[0_0_50px_rgba(220,38,38,0.5)] transition-all active:scale-95 text-xs animate-pulse"
              >
                <ShieldAlert className="w-5 h-5" />
                EMERGENCY SOS
              </button>
           </div>

           <div className="absolute top-4 left-4 z-50 flex gap-2">
              <button 
                onClick={() => setStreamSource(prev => prev === 'local' ? 'esp32' : 'local')}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-bold backdrop-blur-md border border-white/10 transition-all"
              >
                <Wifi className={`w-3 h-3 ${streamSource === 'esp32' ? 'text-blue-400' : 'text-white/40'}`} />
                {streamSource === 'esp32' ? 'ESP32-CAM' : 'Local Camera'}
              </button>
           </div>

          <AnimatePresence mode="wait">
            {!isCapturing || cameraError ? (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-center z-10 px-6"
              >
                <div className={`w-16 h-16 ${cameraError ? 'bg-red-500/10' : 'bg-brand-primary/10'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                  {cameraError ? <ShieldAlert className="w-8 h-8 text-red-500" /> : <Camera className="w-8 h-8 text-brand-primary" />}
                </div>
                <h3 className="text-lg font-bold">{cameraError ? 'Camera Access Failed' : 'Helmet Camera Offline'}</h3>
                <p className="text-sm text-white/40 mb-6">
                  {cameraError ? cameraError : 'Initialize feed to start AI monitoring'}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button 
                    onClick={() => {
                      setCameraError(null);
                      setIsCapturing(true);
                      if (isCapturing) startCamera();
                    }}
                    className="px-6 py-2 bg-brand-primary rounded-full font-bold hover:scale-105 transition-transform shadow-lg shadow-brand-primary/20"
                  >
                    {cameraError ? 'Try Again' : 'Start Live Feed'}
                  </button>
                  {isCapturing && (
                    <button 
                      onClick={() => setIsCapturing(false)}
                      className="px-6 py-2 bg-white/10 rounded-full font-bold hover:bg-white/20 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute top-16 left-4 p-2 glass-panel flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] font-bold tracking-widest uppercase">Live Helmet Feed ({streamSource.toUpperCase()})</span>
                  </div>
                  {streamSource === 'esp32' && (
                    <div className="flex items-center gap-2 pl-4">
                      <Wifi className="w-2.5 h-2.5 text-blue-400" />
                      <span className="text-[8px] text-blue-400 font-mono italic">BRIDGE_LINK_ACTIVE // 5.8GHz</span>
                    </div>
                  )}
                </div>
                
                {/* HUD Overlays */}
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-white/40 uppercase">AI Recognition Engine</p>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-brand-accent" />
                      <span className="font-mono text-sm">ACTIVE // SCANNING</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <button 
                      onClick={manualViolationCapture}
                      className="p-4 bg-orange-600 text-white rounded-full hover:scale-110 active:scale-95 transition-all shadow-xl"
                      title="Capture Violation"
                    >
                      <ShieldAlert className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={captureAndAnalyze}
                      disabled={isAnalyzing}
                      className="p-4 bg-white text-black rounded-full hover:scale-110 active:scale-95 transition-all shadow-xl disabled:opacity-50"
                    >
                      {isAnalyzing ? <Activity className="w-6 h-6 animate-spin" /> : <Eye className="w-6 h-6" />}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Overspeeding', icon: Zap, color: 'text-yellow-400' },
            { label: 'Triple Riding', icon: AlertTriangle, color: 'text-orange-400' },
            { label: 'Fake Plates', icon: ShieldCheck, color: 'text-blue-400' },
            { label: 'Accidents', icon: AlertTriangle, color: 'text-red-500' }
          ].map((item) => (
            <div key={item.label} className="glass-panel p-4 flex flex-col items-center gap-2 text-center">
              <item.icon className={`w-5 h-5 ${item.color}`} />
              <span className="text-[10px] font-bold uppercase tracking-tighter opacity-60">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Real-time Analysis */}
      <div className="space-y-6">
        <div className="glass-panel p-6">
          <h2 className="text-xl font-display font-bold mb-4">Latest Detection</h2>
          <AnimatePresence mode="wait">
            {analysis ? (
              <motion.div 
                key={analysis.vehicleNumber + analysis.violationType}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className={`p-4 rounded-xl border ${analysis.violationType === 'NONE' ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                   <div className="flex justify-between items-start mb-2">
                     <span className="text-[10px] font-bold uppercase py-1 px-2 bg-black/40 rounded">
                       {analysis.violationType}
                     </span>
                     <div className="flex flex-col items-end">
                       <span className="text-[10px] font-mono text-white/40">
                         {(analysis.confidence * 100).toFixed(0)}% Match
                       </span>
                       {analysisDuration && (
                         <span className="text-[8px] font-mono text-brand-accent/60">
                           Latency: {(analysisDuration / 1000).toFixed(2)}s
                         </span>
                       )}
                     </div>
                   </div>
                   <p className="font-display text-2xl font-bold tracking-tight mb-1">{analysis.vehicleNumber}</p>
                   <p className="text-sm text-white/60 leading-relaxed">{analysis.description}</p>
                </div>
              </motion.div>
            ) : (
              <div className="py-12 text-center">
                <ShieldCheck className="w-12 h-12 text-white/5 mx-auto mb-4" />
                <p className="text-sm text-white/20">No data detected</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="glass-panel p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-brand-primary" />
            Alert History
          </h2>
          <div className="space-y-3">
            {recentViolations.length > 0 ? recentViolations.map((v, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/5">
                <div className="w-1 h-8 bg-red-500 rounded-full" />
                <div>
                  <p className="text-xs font-bold">{v.violationType}</p>
                  <p className="text-[10px] text-white/40">{v.vehicleNumber}</p>
                </div>
              </div>
            )) : (
              <p className="text-xs text-center text-white/20 py-4 italic">No violations reported in this session</p>
            )}
          </div>
        </div>
      </div>

      {/* Emergency SOS Modal */}
      <Dialog.Root open={isSOSModalOpen} onOpenChange={setIsSOSModalOpen}>
        <AnimatePresence>
          {isSOSModalOpen && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-red-950/80 backdrop-blur-lg z-[200]" />
              </Dialog.Overlay>
              <Dialog.Content asChild>
                <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm p-4 z-[201] focus:outline-none">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-[#1a0a0a] border border-red-500/30 rounded-3xl p-8 shadow-2xl text-center"
                  >
                    <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse shadow-2xl shadow-red-500/40">
                      <AlertTriangle className="w-10 h-10 text-white" />
                    </div>
                    <Dialog.Title className="text-2xl font-display font-bold text-white mb-2">Emergency Response</Dialog.Title>
                    <Dialog.Description className="text-red-200/40 text-sm mb-8">Select an emergency service to initiate contact immediately.</Dialog.Description>

                    <div className="space-y-3">
                       <button 
                        onClick={() => executeSOSAction('whatsapp')}
                        className="w-full py-4 bg-[#25D366] text-white rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-transform"
                       >
                         <MessageSquare className="w-5 h-5" /> Share Live Location (WA)
                       </button>
                       <button 
                        onClick={() => executeSOSAction('ambulance')}
                        className="w-full py-4 bg-white text-red-600 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-transform"
                       >
                         <ShieldAlert className="w-5 h-5" /> Call Ambulance (102)
                       </button>
                       <button 
                        onClick={() => executeSOSAction('police')}
                        className="w-full py-4 bg-white/10 text-white border border-white/20 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-transform"
                       >
                         <Phone className="w-5 h-5" /> Call Police (100)
                       </button>
                       <button 
                        onClick={() => executeSOSAction('other')}
                        className="w-full py-4 bg-transparent text-white border border-white/10 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-transform"
                       >
                         <Plus className="w-5 h-5" /> Other Emergency (112)
                       </button>
                    </div>

                    <Dialog.Close asChild>
                      <button className="mt-8 text-xs text-white/20 uppercase font-bold tracking-widest hover:text-white transition-colors">Cancel Alert</button>
                    </Dialog.Close>
                  </motion.div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </div>
  );
}
