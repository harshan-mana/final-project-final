import React, { useState, useEffect } from 'react';
import {
  Wifi,
  Database,
  Settings as SettingsIcon,
  Globe,
  RefreshCcw,
  User,
  Phone,
  Save,
  ShieldAlert,
  Cpu,
  Zap,
  CreditCard,
  ChevronRight,
  CheckCircle,
  Download,
  Upload,
  Search,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  Server,
  Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, updateDoc, collection, onSnapshot, getDocs, setDoc } from 'firebase/firestore';
import {
  RTOVehicle,
  SAMPLE_RTO_VEHICLES,
  seedRTODatabase,
  exportVehiclesToJSON,
  exportVehiclesToCSV,
  parseVehiclesFromCSV,
} from '../lib/rtoData';

export default function SettingsView() {
  const [wifiStatus, setWifiStatus] = useState<'disconnected' | 'scanning' | 'handshake' | 'connected'>('disconnected');
  const [profile, setProfile] = useState<any>(null);
  const [originalProfile, setOriginalProfile] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [foundModules, setFoundModules] = useState<{ name: string; signal: number; id: string; type: 'module' | 'router' }[]>([]);
  const [aiSensitivity, setAiSensitivity] = useState(85);
  const [activeCategory, setActiveCategory] = useState<'profile' | 'dataset' | 'hardware' | 'network' | 'billing'>('profile');

  // Dataset Tab State
  const [rtoVehicleCount, setRtoVehicleCount] = useState(0);
  const [isSeeding, setIsSeeding] = useState(false);
  const [datasetMessage, setDatasetMessage] = useState<string | null>(null);
  const [testPlateQuery, setTestPlateQuery] = useState('');
  const [testPlateResult, setTestPlateResult] = useState<RTOVehicle | null | 'NOT_FOUND'>(null);
  const [esp32StreamUrl, setEsp32StreamUrl] = useState('http://192.168.4.1:81/stream');

  useEffect(() => {
    const fetchProfile = async () => {
      if (auth.currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data());
            setOriginalProfile(userDoc.data());
            return;
          }
        } catch (e) {
          console.error('Profile fetch failed:', e);
        }
      }

      // Guest / Local profile fallback
      const savedGuestProfile = localStorage.getItem('aegis_guest_profile');
      const defaultProfile = savedGuestProfile ? JSON.parse(savedGuestProfile) : {
        name: 'Guest Sentry Pilot',
        email: 'guest@aegis-sentry.local',
        phone: '9876543210',
        role: 'Driver',
        emergencyContact1: { name: 'Dispatch Station 112', phone: '1120001122' },
        emergencyContact2: { name: 'Emergency Control', phone: '1080001088' },
        autoReport: true,
        guardianNotifications: true,
      };
      setProfile(defaultProfile);
      setOriginalProfile(defaultProfile);
    };
    fetchProfile();

    // Listen to RTO database count
    const unsubscribeVehicles = onSnapshot(collection(db, 'vehicles'), (snapshot) => {
      setRtoVehicleCount(snapshot.docs.length);
    }, () => {
      // ignore
    });

    return () => unsubscribeVehicles();
  }, []);

  const handleTextChange = (value: string | boolean, field: string, subfield?: string) => {
    setIsDirty(true);
    setShowSuccess(false);
    const errorKey = subfield ? `${field}.${subfield}` : field;
    if (errors[errorKey]) {
      const newErrors = { ...errors };
      delete newErrors[errorKey];
      setErrors(newErrors);
    }

    if (subfield) {
      setProfile((prev: any) => ({
        ...prev,
        [field]: { ...(prev?.[field] || {}), [subfield]: value },
      }));
    } else {
      setProfile((prev: any) => ({ ...prev, [field]: value }));
    }
  };

  const validateInputs = () => {
    if (!profile) return false;
    const phoneRegex = /^\d{10,15}$/;
    const nameRegex = /^[a-zA-Z\s]+$/;
    const newErrors: { [key: string]: string } = {};

    if (!profile.name || profile.name.trim() === '' || !nameRegex.test(profile.name)) {
      newErrors.name = 'Valid name is required (letters only)';
    }
    if (!profile.phone || profile.phone.trim() === '' || !phoneRegex.test(profile.phone)) {
      newErrors.phone = 'Valid 10-15 digit mobile is required';
    }
    if (
      profile.emergencyContact1?.name &&
      profile.emergencyContact1.name.trim() !== '' &&
      !nameRegex.test(profile.emergencyContact1.name)
    ) {
      newErrors['emergencyContact1.name'] = 'Letters only';
    }
    if (
      profile.emergencyContact1?.phone &&
      profile.emergencyContact1.phone.trim() !== '' &&
      !phoneRegex.test(profile.emergencyContact1.phone)
    ) {
      newErrors['emergencyContact1.phone'] = '10-15 digits only';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveProfile = async () => {
    if (!profile) return;
    if (!validateInputs()) return;
    setIsSaving(true);
    try {
      if (auth.currentUser) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          ...profile,
          updatedAt: new Date().toISOString(),
        });
      } else {
        localStorage.setItem('aegis_guest_profile', JSON.stringify(profile));
      }
      setOriginalProfile({ ...profile });
      setIsDirty(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (error) {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
      } else {
        console.warn('Local profile save warning:', error);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // RTO Seeding from Settings
  const handleSeedRTO = async () => {
    setIsSeeding(true);
    setDatasetMessage(null);
    try {
      const res = await seedRTODatabase();
      if (res.success) {
        setDatasetMessage(`Successfully populated ${res.count} records into the RTO Central Database.`);
      } else {
        setDatasetMessage(`Error: ${res.error}`);
      }
    } catch (e: any) {
      setDatasetMessage(`Error: ${e.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  // Test Plate Lookup
  const handleTestLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPlateQuery.trim()) return;

    try {
      const docId = testPlateQuery.trim().toUpperCase();
      const snap = await getDoc(doc(db, 'vehicles', docId));
      if (snap.exists()) {
        setTestPlateResult(snap.data() as RTOVehicle);
      } else {
        // Search by loose string matching across collection
        const allSnap = await getDocs(collection(db, 'vehicles'));
        const matched = allSnap.docs
          .map((d) => d.data() as RTOVehicle)
          .find(
            (v) =>
              v.registrationNumber.replace(/[\s-]/g, '').toUpperCase() ===
              testPlateQuery.replace(/[\s-]/g, '').toUpperCase()
          );
        if (matched) {
          setTestPlateResult(matched);
        } else {
          setTestPlateResult('NOT_FOUND');
        }
      }
    } catch (err: any) {
      console.error('Test lookup error:', err);
      setTestPlateResult('NOT_FOUND');
    }
  };

  // Export RTO
  const handleExportRTO = async (format: 'csv' | 'json') => {
    const snap = await getDocs(collection(db, 'vehicles'));
    const list = snap.docs.map((d) => d.data() as RTOVehicle);
    if (format === 'json') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(exportVehiclesToJSON(list));
      const a = document.createElement('a');
      a.setAttribute('href', dataStr);
      a.setAttribute('download', `rto_dataset_${Date.now()}.json`);
      a.click();
    } else {
      const dataStr = 'data:text/csv;charset=utf-8,' + encodeURIComponent(exportVehiclesToCSV(list));
      const a = document.createElement('a');
      a.setAttribute('href', dataStr);
      a.setAttribute('download', `rto_dataset_${Date.now()}.csv`);
      a.click();
    }
  };

  // CSV Import
  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseVehiclesFromCSV(text);
        if (parsed.length === 0) {
          setDatasetMessage('No valid vehicle records found in the CSV file.');
          return;
        }

        let count = 0;
        for (const v of parsed) {
          const docId = v.registrationNumber.trim().toUpperCase();
          await setDoc(doc(db, 'vehicles', docId), {
            ...v,
            registrationNumber: docId,
            updatedAt: new Date().toISOString(),
          });
          count++;
        }
        setDatasetMessage(`Imported ${count} vehicles into RTO database successfully.`);
      } catch (err: any) {
        setDatasetMessage('CSV Import error: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const startDiscovery = () => {
    setWifiStatus('scanning');
    setFoundModules([]);
    setTimeout(() => {
      setFoundModules([
        { name: 'Aegis-Helmet-V1-092 (BLE Smart Helmet)', signal: -45, id: 'MAC_AE:09:2F:88', type: 'module' },
        { name: 'ESP32-CAM-HOTSPOT (192.168.4.1)', signal: -52, id: 'MAC_ES:32:CA:M1', type: 'module' },
        { name: 'Roadside_Sentry_Tower_5G', signal: -62, id: 'MAC_RT:88:AA:CC', type: 'router' },
      ]);
    }, 1500);
  };

  const confirmConnection = () => {
    setWifiStatus('handshake');
    setTimeout(() => setWifiStatus('connected'), 1500);
  };

  return (
    <div className="pt-28 pb-16 px-4 sm:px-8 max-w-[1600px] mx-auto min-h-screen">
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        {/* SIDE NAV - SYSTEM CATEGORIES */}
        <div className="lg:w-80 space-y-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-display font-black tracking-tight mb-1 text-white">
              SYSTEM CONFIG
            </h1>
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.25em]">
              Node: AE-992-X-KRYPTON
            </p>
          </div>

          <div className="space-y-2 pt-4">
            {[
              { id: 'profile', label: 'Identity & Contacts', icon: User },
              { id: 'dataset', label: 'Manual Dataset Management', icon: Database, badge: `${rtoVehicleCount} RCs` },
              { id: 'hardware', label: 'Hardware & BLE Modules', icon: Cpu },
              { id: 'network', label: 'Network & Cloud Engine', icon: Globe },
              { id: 'billing', label: 'Executive Protocols', icon: CreditCard },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as any)}
                className={`w-full p-4 rounded-2xl flex items-center justify-between group transition-all ${
                  activeCategory === cat.id
                    ? 'bg-cyber-blue text-black shadow-[0_0_20px_#00D1FF]'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <cat.icon className="w-5 h-5 shrink-0" />
                  <span className="text-xs font-black uppercase tracking-wider text-left">{cat.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {cat.badge && (
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded-full ${
                        activeCategory === cat.id ? 'bg-black text-cyber-blue' : 'bg-white/10 text-white/60'
                      }`}
                    >
                      {cat.badge}
                    </span>
                  )}
                  <ChevronRight
                    className={`w-4 h-4 transition-transform ${
                      activeCategory === cat.id ? 'translate-x-1' : 'opacity-0'
                    }`}
                  />
                </div>
              </button>
            ))}
          </div>

          {wifiStatus === 'connected' && (
            <div className="glass-panel p-6 border-cyber-green/30 mt-6 bg-cyber-green/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-cyber-green animate-pulse" />
                <span className="text-[10px] font-black uppercase text-cyber-green tracking-widest">
                  Helmet BLE Link Active
                </span>
              </div>
              <p className="text-[10px] text-white/60 uppercase font-mono">
                Latency: 11ms • Protocol: ESP32-Cam Stream
              </p>
            </div>
          )}
        </div>

        {/* MAIN CONFIGURATION DISPLAY */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            {/* 1. PROFILE & GUARDIAN CONTACTS */}
            {activeCategory === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="glass-panel p-6 sm:p-8 border-white/10">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-4 bg-cyber-blue/10 rounded-2xl border border-cyber-blue/20">
                      <User className="w-8 h-8 text-cyber-blue" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-display font-black tracking-tight text-white">CITIZEN PROFILE</h2>
                      <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.25em]">
                        User UID: {auth.currentUser?.uid || 'ANONYMOUS'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-cyber-blue" /> Full Legal Name *
                      </label>
                      <input
                        value={profile?.name || ''}
                        onChange={(e) => handleTextChange(e.target.value, 'name')}
                        placeholder="e.g. John Doe"
                        className={`w-full bg-white/5 border p-4 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-cyber-blue transition-all ${
                          errors.name ? 'border-cyber-red' : 'border-white/10'
                        }`}
                      />
                      {errors.name && <p className="text-[9px] text-cyber-red font-bold">{errors.name}</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-cyber-blue" /> Primary Mobile Contact *
                      </label>
                      <input
                        type="tel"
                        value={profile?.phone || ''}
                        onChange={(e) => handleTextChange(e.target.value, 'phone')}
                        placeholder="10-15 digits"
                        className={`w-full bg-white/5 border p-4 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-cyber-blue transition-all ${
                          errors.phone ? 'border-cyber-red' : 'border-white/10'
                        }`}
                      />
                      {errors.phone && <p className="text-[9px] text-cyber-red font-bold">{errors.phone}</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                        Driving License ID
                      </label>
                      <input
                        value={profile?.licenseNumber || ''}
                        onChange={(e) => handleTextChange(e.target.value, 'licenseNumber')}
                        placeholder="e.g. DL-1420110012345"
                        className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-cyber-blue"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                        Blood Group (Emergency Medical)
                      </label>
                      <select
                        value={profile?.bloodGroup || 'O+'}
                        onChange={(e) => handleTextChange(e.target.value, 'bloodGroup')}
                        className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-cyber-blue"
                      >
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                          <option key={bg} value={bg} className="bg-black text-white">
                            {bg}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* EMERGENCY GUARDIANS */}
                  <div className="mt-10 space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-cyber-orange flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4" /> Emergency Guardians (Automated Accident SOS Dispatches)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[1, 2].map((num) => (
                        <div key={num} className="glass-panel p-6 border-white/10 bg-white/[0.02]">
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4 flex items-center gap-2">
                            <ShieldAlert className="w-3.5 h-3.5 text-cyber-orange" /> Guardian Node 0{num}
                          </p>
                          <div className="space-y-4">
                            <div>
                              <input
                                placeholder="Guardian Full Name"
                                value={profile?.[`emergencyContact${num}`]?.name || ''}
                                onChange={(e) => handleTextChange(e.target.value, `emergencyContact${num}`, 'name')}
                                className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-xs font-bold text-white focus:border-cyber-blue"
                              />
                            </div>
                            <div>
                              <input
                                placeholder="Guardian Contact (Phone)"
                                type="tel"
                                value={profile?.[`emergencyContact${num}`]?.phone || ''}
                                onChange={(e) => handleTextChange(e.target.value, `emergencyContact${num}`, 'phone')}
                                className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-xs font-bold text-white focus:border-cyber-blue"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AUTOMATION TOGGLES */}
                  <div className="mt-8 pt-8 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex items-center justify-between p-4 bg-white/5 rounded-2xl cursor-pointer hover:bg-white/[0.08] transition-colors">
                      <div>
                        <p className="text-xs font-bold text-white">Auto-Report Critical Accidents</p>
                        <p className="text-[9px] text-white/40">Immediately dispatch GPS to 108 / Emergency Nodes</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={profile?.autoReport ?? true}
                        onChange={(e) => handleTextChange(e.target.checked, 'autoReport')}
                        className="w-5 h-5 accent-cyber-blue rounded"
                      />
                    </label>

                    <label className="flex items-center justify-between p-4 bg-white/5 rounded-2xl cursor-pointer hover:bg-white/[0.08] transition-colors">
                      <div>
                        <p className="text-xs font-bold text-white">Guardian SMS Notifications</p>
                        <p className="text-[9px] text-white/40">Broadcast telemetry and maps link upon collision</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={profile?.guardianNotifications ?? true}
                        onChange={(e) => handleTextChange(e.target.checked, 'guardianNotifications')}
                        className="w-5 h-5 accent-cyber-blue rounded"
                      />
                    </label>
                  </div>

                  {/* COMMIT BUTTON (DISAPPEARS ONCE COMMITTED) */}
                  {isDirty && (
                    <div className="mt-8 flex justify-end">
                      <button
                        onClick={saveProfile}
                        disabled={isSaving}
                        className="px-10 py-4 bg-cyber-blue text-black font-display font-black text-xs uppercase tracking-[0.25em] rounded-2xl shadow-[0_0_30px_#00D1FF] hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                      >
                        {isSaving ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Commit Identification Changes
                      </button>
                    </div>
                  )}

                  {showSuccess && !isDirty && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-8 p-4 bg-cyber-green/10 border border-cyber-green/30 rounded-2xl flex items-center gap-3 text-cyber-green"
                    >
                      <CheckCircle className="w-5 h-5 shrink-0" />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider">
                          Profile Changes Committed Successfully
                        </p>
                        <p className="text-[10px] text-white/50">
                          Your identity and emergency link contacts are saved securely in Firestore.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* 2. MANUAL DATASET MANAGEMENT (RTO DATABASE) */}
            {activeCategory === 'dataset' && (
              <motion.div
                key="dataset"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="glass-panel p-6 sm:p-8 border-white/10">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-cyber-green/10 rounded-2xl border border-cyber-green/20">
                        <Database className="w-8 h-8 text-cyber-green" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-display font-black text-white">MANUAL DATASET MANAGEMENT</h2>
                        <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.25em]">
                          RTO Vehicle Registry • {rtoVehicleCount} Registered Nodes Active
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSeedRTO}
                        disabled={isSeeding}
                        className="px-5 py-3 bg-cyber-green text-black font-display font-black text-xs uppercase tracking-wider rounded-xl shadow-[0_0_20px_rgba(0,255,157,0.4)] hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        <RefreshCcw className={`w-4 h-4 ${isSeeding ? 'animate-spin' : ''}`} />
                        {isSeeding ? 'Populating...' : 'Seed Sample RTO Dataset'}
                      </button>
                    </div>
                  </div>

                  {datasetMessage && (
                    <div className="mb-6 p-4 bg-cyber-blue/10 border border-cyber-blue/30 rounded-2xl text-cyber-blue text-xs font-bold flex items-center justify-between">
                      <span>{datasetMessage}</span>
                      <button onClick={() => setDatasetMessage(null)} className="text-white/60 hover:text-white">
                        Dismiss
                      </button>
                    </div>
                  )}

                  {/* DATASET ACTIONS GRID */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Export */}
                    <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                      <div className="flex items-center gap-3">
                        <Download className="w-5 h-5 text-cyber-blue" />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                          Export Central Registry
                        </h3>
                      </div>
                      <p className="text-[11px] text-white/50 leading-relaxed">
                        Download the entire collection of verified RTO vehicle records for backups, offline law enforcement, or reporting.
                      </p>
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => handleExportRTO('csv')}
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                        >
                          <FileSpreadsheet className="w-4 h-4" /> Download .CSV
                        </button>
                        <button
                          onClick={() => handleExportRTO('json')}
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                        >
                          <Layers className="w-4 h-4" /> Download .JSON
                        </button>
                      </div>
                    </div>

                    {/* Import */}
                    <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                      <div className="flex items-center gap-3">
                        <Upload className="w-5 h-5 text-cyber-purple" />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                          Batch Import CSV Dataset
                        </h3>
                      </div>
                      <p className="text-[11px] text-white/50 leading-relaxed">
                        Upload custom bulk CSV dataset with columns (registrationNumber, ownerName, ownerPhone, vehicleType, makeModel, status).
                      </p>
                      <div className="pt-2">
                        <label className="px-5 py-2.5 bg-cyber-purple/20 border border-cyber-purple/40 hover:bg-cyber-purple hover:text-black text-cyber-purple rounded-xl text-xs font-bold cursor-pointer transition-all inline-flex items-center gap-2">
                          <Upload className="w-4 h-4" /> Select CSV File
                          <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* QUICK RTO SCRATCHPAD LOOKUP */}
                  <div className="p-6 bg-black/40 border border-white/10 rounded-2xl space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-wider text-cyber-blue flex items-center gap-2">
                      <Search className="w-4 h-4" /> Live RTO Database Verification Scratchpad
                    </h3>
                    <p className="text-[11px] text-white/40">
                      Test any plate number (e.g. <span className="text-white font-mono">KA-01-HH-1234</span>,{' '}
                      <span className="text-white font-mono">DL-03-CC-9988</span>,{' '}
                      <span className="text-white font-mono">KA-05-MN-4521</span>) to inspect live RTO verification output.
                    </p>

                    <form onSubmit={handleTestLookup} className="flex gap-3">
                      <input
                        type="text"
                        placeholder="Enter Plate Number..."
                        value={testPlateQuery}
                        onChange={(e) => setTestPlateQuery(e.target.value.toUpperCase())}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs uppercase font-bold text-white focus:border-cyber-blue"
                      />
                      <button
                        type="submit"
                        className="px-6 py-3 bg-cyber-blue text-black font-display font-black text-xs uppercase tracking-wider rounded-xl"
                      >
                        Verify Record
                      </button>
                    </form>

                    {testPlateResult && (
                      <div className="mt-4 p-4 rounded-xl border">
                        {testPlateResult === 'NOT_FOUND' ? (
                          <div className="flex items-center gap-3 text-cyber-red">
                            <AlertTriangle className="w-5 h-5 shrink-0" />
                            <div>
                              <p className="text-xs font-bold uppercase">NO RECORD FOUND IN RTO DATABASE</p>
                              <p className="text-[10px] text-white/50">
                                This vehicle plate is unregistered, counterfeit, or missing from central RTO records.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-display font-black text-cyber-green text-base">
                                {testPlateResult.registrationNumber}
                              </span>
                              <span className="px-2 py-0.5 bg-cyber-green/20 text-cyber-green rounded text-[9px] font-black uppercase">
                                {testPlateResult.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-2 border-t border-white/10">
                              <div>
                                <span className="text-white/40 block text-[9px]">Owner:</span>
                                <span className="text-white font-bold">{testPlateResult.ownerName}</span>
                              </div>
                              <div>
                                <span className="text-white/40 block text-[9px]">Make/Model:</span>
                                <span className="text-white">{testPlateResult.makeModel}</span>
                              </div>
                              <div>
                                <span className="text-white/40 block text-[9px]">Contact:</span>
                                <span className="text-white font-mono">{testPlateResult.ownerPhone}</span>
                              </div>
                              <div>
                                <span className="text-white/40 block text-[9px]">RTO Zone:</span>
                                <span className="text-white">{testPlateResult.rtoZone}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* 3. HARDWARE & BLE MODULES */}
            {activeCategory === 'hardware' && (
              <motion.div
                key="hardware"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="glass-panel p-6 sm:p-8 border-white/10 relative overflow-hidden">
                  <div className="flex flex-col md:flex-row justify-between gap-6 mb-8">
                    <div>
                      <h2 className="text-2xl font-display font-black tracking-tight text-white">
                        HARDWARE & SENTRY BRIDGE
                      </h2>
                      <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.25em]">
                        Pair with ESP32-CAM or BLE Helmet Microcontroller
                      </p>
                    </div>
                    <button
                      onClick={startDiscovery}
                      className="px-6 py-3 bg-white/5 border border-white/10 hover:bg-cyber-blue hover:text-black rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                    >
                      Scan BLE / WiFi Devices
                    </button>
                  </div>

                  {/* RTSP / MJPEG Stream bridge */}
                  <div className="mb-8 p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                    <label className="text-xs font-bold text-white block uppercase tracking-wider">
                      ESP32-CAM MJPEG / HTTP Video Stream URL
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={esp32StreamUrl}
                        onChange={(e) => setEsp32StreamUrl(e.target.value)}
                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:border-cyber-blue"
                      />
                      <button
                        onClick={() => {
                          setWifiStatus('connected');
                          alert('ESP32 stream bridge target registered.');
                        }}
                        className="px-5 py-2.5 bg-cyber-blue text-black font-bold text-xs rounded-xl"
                      >
                        Set Stream URL
                      </button>
                    </div>
                  </div>

                  {wifiStatus === 'scanning' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-cyber-blue">
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                        <span className="text-xs font-black tracking-wider uppercase">
                          Searching for Bluetooth Low Energy & WiFi nodes...
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {foundModules.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => confirmConnection()}
                            className="p-5 bg-white/5 border border-white/5 rounded-2xl cursor-pointer hover:border-cyber-blue/40 hover:bg-cyber-blue/5 transition-all"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-bold text-white">{m.name}</span>
                              <Zap className="w-4 h-4 text-cyber-blue" />
                            </div>
                            <p className="text-[10px] font-mono text-white/40 uppercase">
                              ID: {m.id} • Signal: {m.signal} dBm
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {wifiStatus === 'connected' && (
                    <div className="bg-cyber-green/5 border border-cyber-green/20 rounded-3xl p-8 flex flex-col items-center gap-4 text-center">
                      <div className="w-16 h-16 rounded-full border-2 border-cyber-green flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-cyber-green" />
                      </div>
                      <div>
                        <h3 className="text-xl font-display font-black uppercase text-cyber-green">
                          HELMET BRIDGE PAIRED
                        </h3>
                        <p className="text-[10px] font-mono text-white/50 uppercase mt-1">
                          IP: 192.168.4.1 • CAMERA SENSOR: OV2640 HD
                        </p>
                      </div>
                      <button
                        onClick={() => setWifiStatus('disconnected')}
                        className="px-4 py-1.5 text-xs text-cyber-red hover:underline"
                      >
                        Disconnect Node
                      </button>
                    </div>
                  )}

                  {(!wifiStatus || wifiStatus === 'disconnected') && (
                    <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl text-white/30 text-xs uppercase">
                      No external BLE helmet hardware linked. Using internal browser web camera.
                    </div>
                  )}
                </div>

                {/* AI SENSITIVITY */}
                <div className="glass-panel p-6 sm:p-8 border-white/10">
                  <h3 className="text-sm font-black uppercase tracking-[0.3em] mb-6 text-cyber-purple">
                    AI Vision Inference Sensitivity
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs uppercase text-white/40 font-bold">Confidence Threshold</span>
                      <span className="text-xl font-display font-black text-cyber-blue">{aiSensitivity}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="99"
                      value={aiSensitivity}
                      onChange={(e) => setAiSensitivity(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyber-blue"
                    />
                    <div className="flex justify-between text-[9px] font-mono uppercase text-white/30">
                      <span>Low Threshold (Faster)</span>
                      <span>High Confidence (Strict)</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 4. NETWORK & CLOUD ENGINE */}
            {activeCategory === 'network' && (
              <motion.div
                key="network"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="glass-panel p-6 sm:p-8 border-white/10 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-cyber-blue/10 rounded-2xl border border-cyber-blue/20">
                      <Globe className="w-8 h-8 text-cyber-blue" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-display font-black text-white">CLOUD ENGINE & PROTOCOLS</h2>
                      <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.25em]">
                        Firebase Firestore • Gemini 2.5 Flash Server Proxy
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                      <span className="text-[10px] font-black uppercase text-white/40 block mb-1">Firestore Link</span>
                      <p className="text-lg font-bold text-cyber-green flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> Connected
                      </p>
                      <p className="text-[9px] font-mono text-white/30 mt-2">Realtime Listeners Active</p>
                    </div>

                    <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                      <span className="text-[10px] font-black uppercase text-white/40 block mb-1">AI Vision Route</span>
                      <p className="text-lg font-bold text-cyber-blue flex items-center gap-2">
                        <Server className="w-4 h-4" /> /api/analyze-helmet
                      </p>
                      <p className="text-[9px] font-mono text-white/30 mt-2">Server-Side Gemini Model</p>
                    </div>

                    <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                      <span className="text-[10px] font-black uppercase text-white/40 block mb-1">Network Latency</span>
                      <p className="text-lg font-bold text-cyber-purple flex items-center gap-2">
                        <Activity className="w-4 h-4" /> 18 ms
                      </p>
                      <p className="text-[9px] font-mono text-white/30 mt-2">Google Cloud Run Region</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 5. EXECUTIVE PROTOCOLS / BILLING */}
            {activeCategory === 'billing' && (
              <motion.div
                key="billing"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="glass-panel p-8 border-white/10 bg-white/[0.01] flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">
                        Current Protocol Tier
                      </p>
                      <h3 className="text-4xl font-display font-black tracking-tight mb-2 text-white">STANDARD CITIZEN</h3>
                      <p className="text-xs text-white/50 leading-relaxed">
                        Access to live HUD, incident detection, real-time RTO lookups, and automated SOS emergency dispatches.
                      </p>
                    </div>
                    <div className="pt-8 text-[10px] font-black text-cyber-green uppercase tracking-widest">
                      Active License • Perpetual
                    </div>
                  </div>

                  <div className="glass-panel p-8 border-cyber-purple/40 bg-cyber-purple/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6">
                      <Zap className="w-10 h-10 text-cyber-purple animate-pulse" />
                    </div>
                    <div>
                      <span className="px-3 py-1 bg-cyber-purple text-black text-[9px] font-black uppercase tracking-widest rounded-full">
                        LAW ENFORCEMENT
                      </span>
                      <h3 className="text-4xl font-display font-black tracking-tight mt-4 mb-2 text-cyber-purple">
                        RTO AUTHORITY
                      </h3>
                      <div className="space-y-3 mt-6">
                        {[
                          'Automated e-Challan Endorsement',
                          'Direct Police Radio SOS Broadcast',
                          'Multi-Camera ALPR Highway Stream',
                          'Central RTO Bulk Dataset Synchronization',
                        ].map((f) => (
                          <div key={f} className="flex items-center gap-3 text-xs font-bold text-white/80">
                            <CheckCircle className="w-4 h-4 text-cyber-purple shrink-0" /> {f}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
