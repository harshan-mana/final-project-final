import React, { useRef, useState, useEffect } from 'react';
import {
  Camera,
  AlertTriangle,
  Eye,
  ShieldCheck,
  Activity,
  Zap,
  Bell,
  MapPin,
  Phone,
  MessageSquare,
  Plus,
  ShieldAlert,
  X,
  Wifi,
  Radio,
  Gauge,
  Compass,
  Upload,
  RefreshCw,
  CheckCircle,
  Database,
  Crosshair,
  Volume2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeHelmetFeed, AnalysisResult } from '../services/geminiService';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { addDoc, collection, serverTimestamp, doc, getDoc, getDocs } from 'firebase/firestore';
import * as Dialog from '@radix-ui/react-dialog';
import { RTOVehicle } from '../lib/rtoData';

// Preset Scenarios for instant vision testing
const PRESET_SCENARIOS = [
  {
    id: 'triple',
    name: 'Triple Riding (3 Riders)',
    plate: 'KA-05-MN-4521',
    type: 'TRIPLE_RIDING',
    description: 'Motorcycle carrying 3 passengers without safety gear.',
    speed: 54,
    fine: 1000,
    mockImage: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'fake_plate',
    name: 'Fake / Unregistered Plate',
    plate: 'KA-99-XX-0000',
    type: 'FAKE_PLATE',
    description: 'Vehicle plate not matching central RTO vehicle records.',
    speed: 48,
    fine: 5000,
    mockImage: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'accident',
    name: 'Severe Accident Impact',
    plate: 'DL-03-CC-9988',
    type: 'ACCIDENT',
    description: 'High impact collision detected with lateral roll > 70 deg.',
    speed: 78,
    fine: 10000,
    mockImage: 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'overspeed',
    name: 'Overspeeding (92 km/h)',
    plate: 'MH-12-AB-5678',
    type: 'OVER_SPEEDING',
    description: 'Velocity 92 km/h exceeding 60 km/h urban speed limit.',
    speed: 92,
    fine: 2000,
    mockImage: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'compliant',
    name: 'Compliant Rider (Clear)',
    plate: 'KA-01-HH-1234',
    type: 'NONE',
    description: 'Compliant rider with certified helmet and active RTO registration.',
    speed: 42,
    fine: 0,
    mockImage: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
  },
];

export default function HelmetView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisDuration, setAnalysisDuration] = useState<number | null>(null);
  const [recentViolations, setRecentViolations] = useState<any[]>([]);
  const [isSOSModalOpen, setIsSOSModalOpen] = useState(false);
  const [streamSource, setStreamSource] = useState<'local' | 'esp32' | 'preset'>('local');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Live HUD metrics
  const [speedKmH, setSpeedKmH] = useState(48);
  const [gForce, setGForce] = useState(1.02);
  const [activePreset, setActivePreset] = useState<any | null>(null);
  const [rtoLookupStatus, setRtoLookupStatus] = useState<RTOVehicle | null | 'NOT_FOUND' | 'CHECKING'>(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);

  // Speed simulator interval
  useEffect(() => {
    const interval = setInterval(() => {
      setSpeedKmH((prev) => {
        const delta = (Math.random() - 0.48) * 3;
        const next = Math.max(25, Math.min(115, prev + delta));
        return parseFloat(next.toFixed(0));
      });
      setGForce((prev) => {
        const delta = (Math.random() - 0.5) * 0.08;
        return parseFloat(Math.max(0.95, Math.min(1.4, prev + delta)).toFixed(2));
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Camera start/stop
  useEffect(() => {
    if (isCapturing && streamSource === 'local') {
      setCameraError(null);
      startCamera();
    } else {
      stopCamera();
    }
  }, [isCapturing, streamSource]);

  const startCamera = async () => {
    setIsCapturing(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn('Camera access failed:', err);
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No physical camera device detected on this workstation. You can use the Preset Scenarios below.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Browser camera permission denied. Enable permissions or select a Preset Scenario.');
      } else {
        setCameraError(err.message || 'Camera capture failed. Please use Preset Scenarios.');
      }
      setIsCapturing(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  // Cross-reference RTO
  const verifyPlateInRTO = async (plateNumber: string) => {
    setRtoLookupStatus('CHECKING');
    if (!plateNumber || plateNumber === 'Unknown' || plateNumber === 'MANUAL') {
      setRtoLookupStatus('NOT_FOUND');
      return;
    }

    try {
      const docId = plateNumber.trim().toUpperCase();
      const snap = await getDoc(doc(db, 'vehicles', docId));
      if (snap.exists()) {
        const veh = snap.data() as RTOVehicle;
        setRtoLookupStatus(veh);
        return veh;
      } else {
        // Loose search across database
        const allSnap = await getDocs(collection(db, 'vehicles'));
        const found = allSnap.docs
          .map((d) => d.data() as RTOVehicle)
          .find(
            (v) =>
              v.registrationNumber.replace(/[\s-]/g, '').toUpperCase() ===
              plateNumber.replace(/[\s-]/g, '').toUpperCase()
          );
        if (found) {
          setRtoLookupStatus(found);
          return found;
        } else {
          setRtoLookupStatus('NOT_FOUND');
          return null;
        }
      }
    } catch (e) {
      console.error('RTO lookup error:', e);
      setRtoLookupStatus('NOT_FOUND');
      return null;
    }
  };

  // Run AI Analysis on Live Video Frame
  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) {
      if (activePreset) {
        runPresetAnalysis(activePreset);
        return;
      }
      return;
    }

    setIsAnalyzing(true);
    const startTime = Date.now();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 360;
    ctx.drawImage(videoRef.current, 0, 0);

    const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    const result = await analyzeHelmetFeed(base64);

    setAnalysisDuration(Date.now() - startTime);

    // Cross reference RTO
    const rtoMatch = await verifyPlateInRTO(result.vehicleNumber);
    if (!rtoMatch && result.vehicleNumber !== 'Unknown') {
      if (result.violationType === 'NONE') {
        result.violationType = 'FAKE_PLATE';
        result.description = `Vehicle ${result.vehicleNumber} not found in central RTO registry.`;
        result.penaltyAmount = 5000;
      }
    }

    setAnalysis(result);
    setIsAnalyzing(false);

    // Auto SOS if accident
    if (result.violationType === 'ACCIDENT' && result.confidence > 0.8) {
      setIsSOSModalOpen(true);
    }

    if (result.violationType !== 'NONE' && result.confidence > 0.6) {
      await logViolation(result, canvas.toDataURL('image/jpeg', 0.7));
    }
  };

  // Run AI Analysis on a Preset Scenario
  const runPresetAnalysis = async (preset: typeof PRESET_SCENARIOS[0]) => {
    setActivePreset(preset);
    setIsAnalyzing(true);
    const startTime = Date.now();

    // Verify plate in RTO
    const rtoMatch = await verifyPlateInRTO(preset.plate);

    setTimeout(async () => {
      const result: AnalysisResult = {
        vehicleNumber: preset.plate,
        violationType: preset.type as any,
        confidence: 0.96,
        description: preset.description,
        penaltyAmount: preset.fine,
        estimatedSpeedKmH: preset.speed,
      };

      setSpeedKmH(preset.speed);
      if (preset.type === 'ACCIDENT') {
        setGForce(5.4);
      }

      setAnalysisDuration(Date.now() - startTime);
      setAnalysis(result);
      setIsAnalyzing(false);

      if (preset.type === 'ACCIDENT') {
        setIsSOSModalOpen(true);
      }

      if (preset.type !== 'NONE') {
        await logViolation(result, preset.mockImage);
      }
    }, 600);
  };

  // Upload Custom Photo
  const handleCustomPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setUploadedImagePreview(dataUrl);
      const base64 = dataUrl.split(',')[1];

      setIsAnalyzing(true);
      const startTime = Date.now();
      const result = await analyzeHelmetFeed(base64);

      setAnalysisDuration(Date.now() - startTime);
      const rtoMatch = await verifyPlateInRTO(result.vehicleNumber);
      if (!rtoMatch && result.vehicleNumber !== 'Unknown') {
        if (result.violationType === 'NONE') {
          result.violationType = 'FAKE_PLATE';
          result.description = `Vehicle ${result.vehicleNumber} not found in central RTO registry.`;
          result.penaltyAmount = 5000;
        }
      }

      setAnalysis(result);
      setIsAnalyzing(false);

      if (result.violationType !== 'NONE') {
        await logViolation(result, dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const manualViolationCapture = async () => {
    const manualResult: AnalysisResult = {
      violationType: 'MANUAL_REPORT',
      vehicleNumber: analysis?.vehicleNumber || 'KA-MANUAL',
      confidence: 1.0,
      description: 'Driver manually triggered sentry infraction capture.',
      penaltyAmount: 1000,
    };

    const photoUrl = uploadedImagePreview || activePreset?.mockImage || '';
    await logViolation(manualResult, photoUrl);
    setAnalysis(manualResult);
    alert('Manual violation snapshot recorded and synced with RTO dashboard.');
  };

  const logViolation = async (violation: AnalysisResult, photoUrl: string) => {
    const activeUid = auth.currentUser?.uid || 'guest_sentry_node';
    setRecentViolations((prev) => [violation, ...prev].slice(0, 8));
    try {
      await addDoc(collection(db, 'violations'), {
        vehicleNumber: violation.vehicleNumber,
        type: violation.violationType,
        description: violation.description,
        photoUrl: photoUrl || '',
        timestamp: serverTimestamp(),
        userId: activeUid,
        status: 'Pending',
        penaltyAmount: violation.penaltyAmount || 1000,
        confidence: violation.confidence || 0.9,
      });
    } catch (error) {
      console.warn('Violation logging notice (local/offline mode):', error);
    }
  };

  const executeSOSAction = async (type: 'whatsapp' | 'ambulance' | 'police' | 'other') => {
    const activeUid = auth.currentUser?.uid || 'guest_sentry_node';
    setIsSOSModalOpen(false);

    let finalPos: GeolocationPosition | null = null;
    try {
      finalPos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
      });
    } catch (e) {
      console.warn('Geolocation lookup timed out.');
    }

    const googleMapsUrl = finalPos
      ? `https://www.google.com/maps?q=${finalPos.coords.latitude},${finalPos.coords.longitude}`
      : 'https://maps.google.com';

    try {
      let profileData: any = {};
      if (auth.currentUser) {
        const userProfile = await getDoc(doc(db, 'users', auth.currentUser.uid));
        profileData = userProfile.exists() ? userProfile.data() : {};
      }

      await addDoc(collection(db, 'alerts'), {
        userId: activeUid,
        userName: profileData.name || auth.currentUser?.displayName || 'Guest Sentry Pilot',
        userPhone: profileData.phone || 'Emergency Direct Line',
        actionType: type.toUpperCase(),
        timestamp: serverTimestamp(),
        googleMapsUrl: googleMapsUrl,
      });
    } catch (e) {
      console.warn('Alert dispatch logging note (local/offline mode):', e);
    }

    switch (type) {
      case 'whatsapp':
        const waMsg = `CRITICAL SOS! Aegis Smart Helmet detected high-impact collision. Rider requires immediate dispatch. Location: ${googleMapsUrl}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(waMsg)}`, '_blank');
        break;
      case 'ambulance':
        window.location.href = 'tel:102';
        break;
      case 'police':
        window.location.href = 'tel:100';
        break;
      case 'other':
        window.location.href = 'tel:112';
        break;
    }
  };

  return (
    <div className="pt-24 pb-16 px-4 sm:px-8 max-w-[1700px] mx-auto space-y-8">
      {/* TOP HUD BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 flex items-center gap-3 border-cyber-blue/20">
          <div className="p-3 bg-cyber-blue/10 rounded-xl text-cyber-blue">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/40 font-black">Digital Speedometer</p>
            <p
              className={`text-2xl font-display font-black tracking-tight ${
                speedKmH > 60 ? 'text-cyber-red animate-pulse' : 'text-cyber-blue'
              }`}
            >
              {speedKmH} <span className="text-xs text-white/60 font-mono">km/h</span>
            </p>
          </div>
        </div>

        <div className="glass-panel p-4 flex items-center gap-3 border-cyber-green/20">
          <div className="p-3 bg-cyber-green/10 rounded-xl text-cyber-green">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/40 font-black">IMU Accelerometer</p>
            <p
              className={`text-2xl font-display font-black tracking-tight ${
                gForce > 4.0 ? 'text-cyber-red animate-pulse' : 'text-cyber-green'
              }`}
            >
              {gForce} <span className="text-xs text-white/60 font-mono">G</span>
            </p>
          </div>
        </div>

        <div className="glass-panel p-4 flex items-center gap-3 border-cyber-purple/20">
          <div className="p-3 bg-cyber-purple/10 rounded-xl text-cyber-purple">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/40 font-black">GPS Satellite Link</p>
            <p className="text-base font-display font-black text-cyber-purple">LOCK // 3D-FIX</p>
          </div>
        </div>

        <div className="glass-panel p-4 flex items-center justify-between border-cyber-red/30 bg-cyber-red/5">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-cyber-red font-black">Emergency Hotlink</p>
            <p className="text-xs font-bold text-white">Direct SOS Ready</p>
          </div>
          <button
            onClick={() => setIsSOSModalOpen(true)}
            className="px-4 py-2 bg-cyber-red text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-[0_0_20px_rgba(255,59,59,0.5)] animate-pulse hover:scale-105 transition-all"
          >
            DISPATCH SOS
          </button>
        </div>
      </div>

      {/* MAIN COCKPIT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT 2 COLUMNS: VIDEO HUD & VISION ENGINE */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel overflow-hidden relative aspect-video bg-black flex items-center justify-center border-white/10 group">
            {/* Top HUD Badges */}
            <div className="absolute top-4 left-4 z-40 flex items-center gap-2">
              <span className="px-3 py-1 bg-black/80 backdrop-blur-md border border-white/10 rounded-xl text-[9px] font-black uppercase text-cyber-blue flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyber-blue animate-pulse" />
                AEGIS HUD // ACTIVE SENTRY
              </span>
            </div>

            <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
              <button
                onClick={() => {
                  if (isCapturing) {
                    stopCamera();
                    setIsCapturing(false);
                  } else {
                    setIsCapturing(true);
                  }
                }}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-bold backdrop-blur-md border border-white/10 transition-all flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                {isCapturing ? 'Stop WebCam' : 'Start WebCam'}
              </button>
            </div>

            {/* AI Animated Scanline Overlay */}
            <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden opacity-30">
              <motion.div
                initial={{ y: '-100%' }}
                animate={{ y: '100%' }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="w-full h-24 bg-gradient-to-b from-transparent via-cyber-blue/30 to-transparent"
              />
            </div>

            {/* Target Crosshair */}
            <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center opacity-20">
              <Crosshair className="w-48 h-48 text-cyber-blue" />
            </div>

            {/* Video or Mock Frame Rendering */}
            <AnimatePresence mode="wait">
              {isCapturing && !cameraError ? (
                <div className="w-full h-full relative">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>
              ) : uploadedImagePreview ? (
                <div className="w-full h-full relative">
                  <img src={uploadedImagePreview} alt="Uploaded Frame" className="w-full h-full object-cover" />
                </div>
              ) : activePreset ? (
                <div className="w-full h-full relative">
                  <img src={activePreset.mockImage} alt={activePreset.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="text-center p-8 z-30">
                  <Camera className="w-16 h-16 text-white/20 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-white mb-1">Helmet Vision Sentry Standby</h3>
                  <p className="text-xs text-white/40 max-w-sm mx-auto mb-6">
                    {cameraError || 'Activate your camera feed or select one of the Preset Test Scenarios below to test the AI detection model.'}
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      onClick={() => {
                        setCameraError(null);
                        setIsCapturing(true);
                      }}
                      className="px-6 py-2.5 bg-cyber-blue text-black font-display font-black text-xs uppercase tracking-wider rounded-xl shadow-[0_0_20px_#00D1FF]"
                    >
                      Connect Camera Feed
                    </button>
                  </div>
                </div>
              )}
            </AnimatePresence>

            <canvas ref={canvasRef} className="hidden" />

            {/* BOTTOM HUD ACTION CONTROLS */}
            <div className="absolute bottom-4 left-4 right-4 z-40 flex justify-between items-end">
              <div className="space-y-1">
                <span className="text-[9px] font-mono uppercase tracking-widest text-white/50 block">AI Latency</span>
                <span className="font-mono text-xs text-cyber-green font-bold">
                  {analysisDuration ? `${(analysisDuration / 1000).toFixed(2)}s` : '0.04s'} • 60 FPS
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={manualViolationCapture}
                  className="p-3.5 bg-cyber-orange text-white rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,85,0,0.5)]"
                  title="Manual Violation Capture"
                >
                  <ShieldAlert className="w-5 h-5" />
                </button>

                <button
                  onClick={captureAndAnalyze}
                  disabled={isAnalyzing}
                  className="px-6 py-3.5 bg-cyber-blue text-black font-display font-black text-xs uppercase tracking-wider rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_#00D1FF] flex items-center gap-2 disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Neural Scanning...
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      Scan Visual Frame
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* PRESET SCENARIOS & CUSTOM UPLOAD BAR */}
          <div className="glass-panel p-6 border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyber-blue" /> Instant AI Test Lab (Preset Scenarios)
              </h3>
              <label className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1.5 border border-white/10">
                <Upload className="w-3.5 h-3.5" /> Upload Frame Photo
                <input type="file" accept="image/*" onChange={handleCustomPhotoUpload} className="hidden" />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {PRESET_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => runPresetAnalysis(scenario)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    activePreset?.id === scenario.id
                      ? 'bg-cyber-blue/10 border-cyber-blue text-white shadow-[0_0_15px_rgba(0,209,255,0.2)]'
                      : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <p className="text-[10px] font-black uppercase tracking-tight line-clamp-1">{scenario.name}</p>
                  <p className="text-[9px] font-mono text-cyber-blue mt-1">{scenario.plate}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: REAL-TIME DETECTION & RTO CROSS-CHECK */}
        <div className="space-y-6">
          {/* Real-time Detection Card */}
          <div className="glass-panel p-6 border-white/10 space-y-6">
            <h2 className="text-lg font-display font-black tracking-tight text-white flex items-center justify-between">
              <span>LIVE AI DETECTION</span>
              {analysis && (
                <span className="text-[10px] font-mono text-cyber-green">
                  {(analysis.confidence * 100).toFixed(0)}% Conf
                </span>
              )}
            </h2>

            <AnimatePresence mode="wait">
              {analysis ? (
                <motion.div
                  key={analysis.vehicleNumber + analysis.violationType}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div
                    className={`p-5 rounded-2xl border ${
                      analysis.violationType === 'NONE'
                        ? 'bg-cyber-green/10 border-cyber-green/30'
                        : 'bg-cyber-red/10 border-cyber-red/30'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-black/60 rounded text-cyber-blue">
                        {analysis.violationType}
                      </span>
                      <span className="text-xs font-black text-cyber-green">
                        Fine: ₹{analysis.penaltyAmount || 0}
                      </span>
                    </div>

                    <p className="font-display text-3xl font-black tracking-tight text-white mb-2">
                      {analysis.vehicleNumber}
                    </p>

                    <p className="text-xs text-white/70 leading-relaxed italic">"{analysis.description}"</p>
                  </div>

                  {/* RTO CROSS REFERENCE PANEL */}
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-cyber-blue flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5" /> Central RTO Database Status
                    </p>

                    {rtoLookupStatus === 'CHECKING' ? (
                      <p className="text-xs text-white/50 flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Cross-referencing RTO Registry...
                      </p>
                    ) : rtoLookupStatus === 'NOT_FOUND' ? (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-cyber-red text-xs font-bold space-y-1">
                        <p className="flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4" /> UNREGISTERED / FAKE PLATE DETECTED
                        </p>
                        <p className="text-[9px] text-red-200/60 font-normal">
                          License plate not indexed in Central RTO. Flagged for enforcement intervention.
                        </p>
                      </div>
                    ) : rtoLookupStatus ? (
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-white/40 text-[10px]">Owner:</span>
                          <span className="text-white font-bold">{rtoLookupStatus.ownerName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/40 text-[10px]">Make & Model:</span>
                          <span className="text-white">{rtoLookupStatus.makeModel}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/40 text-[10px]">RC Status:</span>
                          <span className="text-cyber-green font-bold uppercase">{rtoLookupStatus.status}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/40 text-[10px]">RTO Zone:</span>
                          <span className="text-white/70">{rtoLookupStatus.rtoZone}</span>
                        </div>
                        {rtoLookupStatus.stolenFlag && (
                          <p className="text-cyber-red font-black text-[10px] uppercase bg-red-500/20 p-2 rounded animate-pulse">
                            LOOKOUT: REPORTED STOLEN (FIR ACTIVE)
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-white/30 italic">No plate scanned yet</p>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="py-12 text-center text-white/30 text-xs">
                  <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  No visual detection active. Trigger a scan or select a test scenario.
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Session Infractions Feed */}
          <div className="glass-panel p-6 border-white/10 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-cyber-orange" /> Recent Session Detections
              </span>
              <span className="text-[9px] font-mono text-white/40">{recentViolations.length} Events</span>
            </h3>

            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {recentViolations.length > 0 ? (
                recentViolations.map((v, i) => (
                  <div
                    key={i}
                    className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-cyber-orange" />
                      <div>
                        <p className="text-xs font-bold text-white">{v.vehicleNumber}</p>
                        <p className="text-[9px] font-mono text-white/40 uppercase">{v.violationType}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-cyber-green font-bold">₹{v.penaltyAmount || 1000}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-white/20 text-center py-6 italic">No infractions logged this session</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* EMERGENCY SOS MODAL */}
      <Dialog.Root open={isSOSModalOpen} onOpenChange={setIsSOSModalOpen}>
        <AnimatePresence>
          {isSOSModalOpen && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-red-950/80 backdrop-blur-md z-[200]"
                />
              </Dialog.Overlay>
              <Dialog.Content asChild>
                <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-4 z-[201] focus:outline-none">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-[#120505] border border-red-500/40 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden"
                  >
                    <div className="w-20 h-20 bg-cyber-red rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse shadow-[0_0_40px_rgba(255,59,59,0.6)]">
                      <AlertTriangle className="w-10 h-10 text-white" />
                    </div>

                    <Dialog.Title className="text-2xl font-display font-black text-white mb-1">
                      EMERGENCY SOS BROADCAST
                    </Dialog.Title>
                    <Dialog.Description className="text-red-200/60 text-xs mb-8">
                      Immediate priority dispatch. Satellite GPS coordinates will be sent to the selected emergency network.
                    </Dialog.Description>

                    <div className="space-y-3">
                      <button
                        onClick={() => executeSOSAction('whatsapp')}
                        className="w-full py-4 bg-[#25D366] text-black font-display font-black text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-green-900/30 hover:scale-105 active:scale-95 transition-all"
                      >
                        <MessageSquare className="w-5 h-5 text-black" /> Broadcast Live Location via WhatsApp
                      </button>

                      <button
                        onClick={() => executeSOSAction('ambulance')}
                        className="w-full py-4 bg-white text-red-600 font-display font-black text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-3 shadow-lg hover:scale-105 active:scale-95 transition-all"
                      >
                        <ShieldAlert className="w-5 h-5" /> Call Ambulance (102 / 108)
                      </button>

                      <button
                        onClick={() => executeSOSAction('police')}
                        className="w-full py-4 bg-white/10 border border-white/20 text-white font-display font-black text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-3 hover:bg-white/20 active:scale-95 transition-all"
                      >
                        <Phone className="w-5 h-5" /> Call Traffic Police (100)
                      </button>

                      <button
                        onClick={() => executeSOSAction('other')}
                        className="w-full py-4 bg-transparent border border-white/10 text-white/70 hover:text-white font-display font-black text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                      >
                        <Plus className="w-5 h-5" /> National Emergency (112)
                      </button>
                    </div>

                    <Dialog.Close asChild>
                      <button className="mt-6 text-[10px] text-white/30 uppercase font-black tracking-widest hover:text-white transition-colors">
                        Cancel Alert Dispatch
                      </button>
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
