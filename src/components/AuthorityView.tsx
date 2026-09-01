import React, { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  doc,
  setDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Search,
  MapPin,
  CheckCircle,
  Clock,
  AlertCircle,
  Database,
  Plus,
  Trash2,
  ShieldAlert,
  Phone,
  ShieldCheck,
  Activity,
  Zap,
  Filter,
  Download,
  Upload,
  RefreshCw,
  Eye,
  FileText,
  AlertTriangle,
  X,
  Check,
  Car,
  Bike,
  CreditCard,
  Edit,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import {
  RTOVehicle,
  SAMPLE_RTO_VEHICLES,
  seedRTODatabase,
  exportVehiclesToJSON,
  exportVehiclesToCSV,
  parseVehiclesFromCSV,
} from '../lib/rtoData';

export default function AuthorityView() {
  const [violations, setViolations] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<RTOVehicle[]>([]);
  const [activeTab, setActiveTab] = useState<'violations' | 'registry' | 'intelligence'>('violations');

  // Filters & Searches
  const [violationTypeFilter, setViolationTypeFilter] = useState('All');
  const [violationStatusFilter, setViolationStatusFilter] = useState('All');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState('All');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('All');

  // Modals & Selected states
  const [selectedViolation, setSelectedViolation] = useState<any | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<RTOVehicle | null>(null);
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedNotification, setSeedNotification] = useState<string | null>(null);

  // New vehicle form state
  const [vehicleForm, setVehicleForm] = useState<RTOVehicle>({
    registrationNumber: '',
    ownerName: '',
    ownerPhone: '',
    vehicleType: 'Motorcycle',
    makeModel: '',
    status: 'Active',
    insuranceValidUntil: '2027-12-31',
    pucValidUntil: '2026-12-31',
    chassisNumber: '',
    engineNumber: '',
    registrationDate: new Date().toISOString().split('T')[0],
    rtoZone: 'KA-01 (Bangalore Central)',
    stolenFlag: false,
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // 1. Real-time Violations listener
  useEffect(() => {
    const q = query(collection(db, 'violations'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setViolations(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        console.warn('Violations query listener warning:', error);
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Real-time Emergency Alerts listener
  useEffect(() => {
    const q = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'), limit(15));
    return onSnapshot(
      q,
      (snapshot) => {
        setAlerts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        console.warn('Alerts listener warning:', error);
      }
    );
  }, []);

  // 3. Real-time Vehicles (RTO Registry) listener
  useEffect(() => {
    const q = query(collection(db, 'vehicles'), limit(200));
    return onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as RTOVehicle));
        setVehicles(list);
      },
      (error) => {
        console.warn('Vehicles listener warning:', error);
      }
    );
  }, []);

  // Status Updater for Violations
  const updateViolationStatus = async (
    id: string,
    status: 'Resolved' | 'Spam' | 'Endorsed' | 'Pending',
    penaltyAmount?: number
  ) => {
    try {
      const updatePayload: any = { status };
      if (penaltyAmount !== undefined) {
        updatePayload.penaltyAmount = penaltyAmount;
        updatePayload.challanNumber = `CH-${Date.now().toString().slice(-6)}`;
      }
      await updateDoc(doc(db, 'violations', id), updatePayload);
      if (selectedViolation && selectedViolation.id === id) {
        setSelectedViolation({ ...selectedViolation, ...updatePayload });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `violations/${id}`);
    }
  };

  // Seed Sample Database
  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    setSeedNotification(null);
    try {
      const res = await seedRTODatabase();
      if (res.success) {
        setSeedNotification(`Successfully populated ${res.count} vehicle records into RTO central registry.`);
        setTimeout(() => setSeedNotification(null), 5000);
      } else {
        setSeedNotification(`Seeding error: ${res.error}`);
      }
    } catch (e: any) {
      setSeedNotification(`Error: ${e.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  // Save Vehicle
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    if (!vehicleForm.registrationNumber.trim()) {
      errors.registrationNumber = 'Registration Number is required';
    }
    if (!vehicleForm.ownerName.trim()) {
      errors.ownerName = 'Owner Name is required';
    }
    if (!vehicleForm.ownerPhone.trim() || !/^\d{10,15}$/.test(vehicleForm.ownerPhone.trim())) {
      errors.ownerPhone = 'Enter valid 10-15 digit phone';
    }
    if (!vehicleForm.makeModel.trim()) {
      errors.makeModel = 'Make and Model is required';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const docId = vehicleForm.registrationNumber.trim().toUpperCase();
      await setDoc(doc(db, 'vehicles', docId), {
        ...vehicleForm,
        registrationNumber: docId,
        updatedAt: new Date().toISOString(),
      });
      setIsAddVehicleOpen(false);
      setVehicleForm({
        registrationNumber: '',
        ownerName: '',
        ownerPhone: '',
        vehicleType: 'Motorcycle',
        makeModel: '',
        status: 'Active',
        insuranceValidUntil: '2027-12-31',
        pucValidUntil: '2026-12-31',
        chassisNumber: '',
        engineNumber: '',
        registrationDate: new Date().toISOString().split('T')[0],
        rtoZone: 'KA-01 (Bangalore Central)',
        stolenFlag: false,
        notes: '',
      });
      setFormErrors({});
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `vehicles/${vehicleForm.registrationNumber}`);
    }
  };

  // Delete Vehicle
  const handleDeleteVehicle = async (regNo: string) => {
    if (!window.confirm(`Are you sure you want to remove ${regNo} from the RTO database?`)) return;
    try {
      await deleteDoc(doc(db, 'vehicles', regNo));
      if (selectedVehicle?.registrationNumber === regNo) {
        setSelectedVehicle(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `vehicles/${regNo}`);
    }
  };

  // Filtered lists
  const filteredViolations = useMemo(() => {
    return violations.filter((v) => {
      const matchType = violationTypeFilter === 'All' || v.type === violationTypeFilter;
      const matchStatus = violationStatusFilter === 'All' || v.status === violationStatusFilter;
      return matchType && matchStatus;
    });
  }, [violations, violationTypeFilter, violationStatusFilter]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const q = vehicleSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        (v.registrationNumber && v.registrationNumber.toLowerCase().includes(q)) ||
        (v.ownerName && v.ownerName.toLowerCase().includes(q)) ||
        (v.ownerPhone && v.ownerPhone.includes(q)) ||
        (v.makeModel && v.makeModel.toLowerCase().includes(q)) ||
        (v.rtoZone && v.rtoZone.toLowerCase().includes(q));

      const matchStatus =
        vehicleStatusFilter === 'All' ||
        (vehicleStatusFilter === 'Stolen' ? v.stolenFlag : v.status === vehicleStatusFilter);

      const matchType = vehicleTypeFilter === 'All' || v.vehicleType === vehicleTypeFilter;

      return matchSearch && matchStatus && matchType;
    });
  }, [vehicles, vehicleSearch, vehicleStatusFilter, vehicleTypeFilter]);

  // Analytics Aggregation
  const analyticsData = useMemo(() => {
    const typeCounts: { [key: string]: number } = {
      TRIPLE_RIDING: 0,
      OVER_SPEEDING: 0,
      FAKE_PLATE: 0,
      ACCIDENT: 0,
      NO_HELMET: 0,
      MANUAL_REPORT: 0,
    };

    let totalPenaltiesCollected = 0;
    let resolvedCount = 0;

    violations.forEach((v) => {
      const t = v.type || 'MANUAL_REPORT';
      if (typeCounts[t] !== undefined) {
        typeCounts[t]++;
      } else {
        typeCounts[t] = 1;
      }
      if (v.status === 'Resolved' || v.status === 'Endorsed') {
        resolvedCount++;
        totalPenaltiesCollected += v.penaltyAmount || 1000;
      }
    });

    const pieData = Object.keys(typeCounts)
      .filter((k) => typeCounts[k] > 0)
      .map((k) => ({
        name: k.replace('_', ' '),
        value: typeCounts[k],
      }));

    // Weekly trend mock-up based on timestamp or realistic distribution
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const trendData = days.map((day, idx) => ({
      day,
      violations: Math.max(2, Math.round(violations.length * (0.1 + (idx % 3) * 0.05))),
      accidents: Math.max(0, Math.round(alerts.length * (0.1 + (idx % 2) * 0.1))),
    }));

    // Hotspot Zones
    const zoneData = [
      { zone: 'KA-01 (Koramangala)', risk: 88, infractions: 34 },
      { zone: 'KA-05 (Jayanagar)', risk: 65, infractions: 22 },
      { zone: 'KA-03 (Indiranagar)', risk: 79, infractions: 29 },
      { zone: 'KA-51 (Electronic City)', risk: 92, infractions: 41 },
      { zone: 'DL-03 (South Delhi)', risk: 74, infractions: 26 },
      { zone: 'MH-12 (Pune Central)', risk: 58, infractions: 18 },
    ];

    return {
      pieData,
      trendData,
      zoneData,
      totalPenaltiesCollected,
      resolvedCount,
      resolutionRate: violations.length ? Math.round((resolvedCount / violations.length) * 100) : 100,
    };
  }, [violations, alerts]);

  // Export handlers
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(exportVehiclesToJSON(vehicles));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `rto_registry_backup_${Date.now()}.json`);
    a.click();
  };

  const handleExportCSV = () => {
    const dataStr = 'data:text/csv;charset=utf-8,' + encodeURIComponent(exportVehiclesToCSV(vehicles));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `rto_registry_${Date.now()}.csv`);
    a.click();
  };

  // CSV Import
  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseVehiclesFromCSV(text);
        if (parsed.length === 0) {
          alert('No valid vehicle records found in the uploaded file.');
          return;
        }

        let importedCount = 0;
        for (const v of parsed) {
          const docId = v.registrationNumber.trim().toUpperCase();
          await setDoc(doc(db, 'vehicles', docId), {
            ...v,
            registrationNumber: docId,
            updatedAt: new Date().toISOString(),
          });
          importedCount++;
        }
        setIsImportModalOpen(false);
        setSeedNotification(`Imported ${importedCount} records from CSV successfully.`);
        setTimeout(() => setSeedNotification(null), 5000);
      } catch (err: any) {
        alert('CSV Import error: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const COLORS = ['#00D1FF', '#FF5500', '#FF3B3B', '#FFCC00', '#00FF9D', '#B55FE6'];

  return (
    <div className="pt-28 pb-16 px-4 sm:px-8 max-w-[1700px] mx-auto space-y-8">
      {/* GLOBAL HUD STATUS BAR */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          {
            label: 'Network Sentry',
            value: 'Online',
            sub: 'AI Vision Engine Active',
            icon: ShieldCheck,
            color: 'text-cyber-blue',
            bg: 'border-cyber-blue/20',
          },
          {
            label: 'Unresolved Infractions',
            value: violations.filter((v) => v.status === 'Pending').length,
            sub: `${violations.length} Total Captured`,
            icon: AlertCircle,
            color: 'text-cyber-orange',
            bg: 'border-cyber-orange/20',
          },
          {
            label: 'RTO Registry Nodes',
            value: vehicles.length,
            sub: 'Central Database Synchronized',
            icon: Database,
            color: 'text-cyber-green',
            bg: 'border-cyber-green/20',
          },
          {
            label: 'Penalties Endorsed',
            value: `₹${analyticsData.totalPenaltiesCollected.toLocaleString()}`,
            sub: `${analyticsData.resolutionRate}% Compliance Rate`,
            icon: CreditCard,
            color: 'text-cyber-purple',
            bg: 'border-cyber-purple/20',
          },
        ].map((stat, i) => (
          <div key={i} className={`glass-panel p-6 border ${stat.bg} relative overflow-hidden group`}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <stat.icon className="w-12 h-12" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40 mb-1">{stat.label}</p>
            <p className={`text-3xl sm:text-4xl font-display font-black tracking-tight ${stat.color}`}>
              {stat.value}
            </p>
            <p className="text-[9px] font-mono text-white/30 uppercase mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* SEED OR ACTION NOTIFICATION */}
      <AnimatePresence>
        {seedNotification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-cyber-blue/10 border border-cyber-blue/30 rounded-2xl flex items-center justify-between text-cyber-blue text-xs font-bold"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5" />
              <span>{seedNotification}</span>
            </div>
            <button onClick={() => setSeedNotification(null)} className="text-white/60 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EMERGENCY SOS PRIORITY STRIP */}
      {alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-cyber-red/10 border border-cyber-red/30 rounded-3xl p-6 sm:p-8 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-2 h-full bg-cyber-red animate-pulse" />
          <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-cyber-red flex items-center justify-center shadow-[0_0_25px_rgba(255,59,59,0.6)] shrink-0">
                <ShieldAlert className="w-7 h-7 text-white animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-display font-black tracking-tight text-white flex items-center gap-2">
                  LIVE SOS DISPATCH FEED <span className="text-xs px-2 py-0.5 bg-cyber-red text-white rounded-full">LIVE</span>
                </h2>
                <p className="text-[9px] font-mono text-cyber-red/80 uppercase tracking-[0.3em]">
                  Real-time Satellite Coordinates Broadcast
                </p>
              </div>
            </div>

            <div className="flex-1 w-full overflow-x-auto pb-2 scrollbar-hide">
              <div className="flex gap-4">
                {alerts.map((a) => (
                  <div
                    key={a.id}
                    className="min-w-[280px] sm:min-w-[320px] bg-black/80 border border-cyber-red/20 p-4 rounded-2xl hover:border-cyber-red/50 transition-colors shrink-0"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-black uppercase tracking-tight text-white">{a.userName}</span>
                      <span className="text-[8px] font-mono p-1 bg-cyber-red/20 text-cyber-red rounded uppercase tracking-widest font-black">
                        {a.actionType}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-white/60 mb-3">
                      <Phone className="w-3.5 h-3.5 text-cyber-red" />
                      <a href={`tel:${a.userPhone}`} className="hover:underline text-white font-mono">
                        {a.userPhone}
                      </a>
                    </div>
                    {a.googleMapsUrl ? (
                      <a
                        href={a.googleMapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2 bg-cyber-red hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-900/30"
                      >
                        <MapPin className="w-3.5 h-3.5" /> View Incident GPS Location
                      </a>
                    ) : (
                      <div className="text-[10px] text-white/30 italic text-center py-1">GPS Lock Pending</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* PRIMARY CONTROLLER TABS */}
      <div className="glass-panel min-h-[650px] border-white/10 flex flex-col">
        {/* Navigation Toolbar */}
        <div className="p-6 sm:p-8 border-b border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex flex-wrap bg-white/5 p-1.5 rounded-2xl border border-white/5 gap-1">
            {[
              { id: 'violations', label: 'Safety Violations', icon: AlertCircle, badge: violations.length },
              { id: 'registry', label: 'RTO Vehicle Database', icon: Database, badge: vehicles.length },
              { id: 'intelligence', label: 'Predictive Intel & Analytics', icon: Activity },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                  activeTab === tab.id
                    ? 'bg-cyber-blue text-black shadow-[0_0_20px_#00D1FF]'
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                      activeTab === tab.id ? 'bg-black text-cyber-blue' : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Quick Action Buttons for Registry */}
          {activeTab === 'registry' && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                onClick={handleSeedDatabase}
                disabled={isSeeding}
                className="px-4 py-2 bg-cyber-green/10 border border-cyber-green/30 hover:bg-cyber-green hover:text-black text-cyber-green rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(0,255,157,0.2)] disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
                {isSeeding ? 'Populating...' : 'Seed Sample Database'}
              </button>

              <button
                onClick={() => setIsAddVehicleOpen(true)}
                className="px-4 py-2 bg-cyber-blue text-black rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all hover:scale-105 shadow-[0_0_15px_#00D1FF]"
              >
                <Plus className="w-3.5 h-3.5" /> Register Vehicle
              </button>

              <button
                onClick={handleExportCSV}
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-[10px] font-bold transition-all"
                title="Export CSV"
              >
                <Download className="w-4 h-4" />
              </button>

              <label
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl cursor-pointer transition-all"
                title="Import CSV"
              >
                <Upload className="w-4 h-4" />
                <input type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
              </label>
            </div>
          )}

          {/* Violation Type Filter Chips */}
          {activeTab === 'violations' && (
            <div className="flex flex-wrap gap-2">
              {['All', 'TRIPLE_RIDING', 'ACCIDENT', 'FAKE_PLATE', 'OVER_SPEEDING', 'NO_HELMET'].map((f) => (
                <button
                  key={f}
                  onClick={() => setViolationTypeFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${
                    violationTypeFilter === f
                      ? 'bg-white text-black border-white'
                      : 'border-white/10 text-white/40 hover:border-white/20'
                  }`}
                >
                  {f.replace('_', ' ')}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tab Content Container */}
        <div className="p-6 sm:p-8 flex-1">
          {/* TAB 1: SAFETY VIOLATIONS */}
          {activeTab === 'violations' && (
            <div className="space-y-6">
              {/* Status Sub-filter */}
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Status:</span>
                  {['All', 'Pending', 'Endorsed', 'Resolved', 'Spam'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setViolationStatusFilter(st)}
                      className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase transition-all ${
                        violationStatusFilter === st
                          ? 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/40'
                          : 'text-white/40 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <span className="text-[10px] font-mono text-white/30 uppercase">
                  Showing {filteredViolations.length} records
                </span>
              </div>

              {filteredViolations.length === 0 ? (
                <div className="py-24 text-center border border-dashed border-white/10 rounded-3xl">
                  <ShieldCheck className="w-16 h-16 text-white/10 mx-auto mb-4" />
                  <h3 className="text-lg font-display font-bold text-white/60">No Violations Found</h3>
                  <p className="text-xs text-white/30 max-w-sm mx-auto mt-1">
                    No infractions matching the selected criteria. The AI sentry is continuously monitoring feeds.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredViolations.map((v) => {
                    // Check if plate exists in RTO registry
                    const rtoMatch = vehicles.find(
                      (veh) =>
                        veh.registrationNumber.replace(/[\s-]/g, '').toUpperCase() ===
                        v.vehicleNumber.replace(/[\s-]/g, '').toUpperCase()
                    );

                    return (
                      <div
                        key={v.id}
                        onClick={() => setSelectedViolation(v)}
                        className="glass-panel overflow-hidden border-white/10 group hover:border-cyber-blue/40 transition-all flex flex-col cursor-pointer bg-white/[0.02] hover:bg-white/[0.04]"
                      >
                        <div className="aspect-video relative bg-white/5 overflow-hidden">
                          {v.photoUrl ? (
                            <img
                              src={v.photoUrl}
                              alt="Infraction Evidence"
                              className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">
                              No Visual Snapshot
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-transparent to-transparent opacity-80" />

                          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                v.status === 'Resolved' || v.status === 'Endorsed'
                                  ? 'bg-cyber-green text-black'
                                  : v.status === 'Spam'
                                  ? 'bg-white/20 text-white'
                                  : 'bg-cyber-orange text-white'
                              }`}
                            >
                              {v.status || 'Pending'}
                            </span>
                            <span className="px-2 py-0.5 bg-black/70 backdrop-blur-md rounded text-[8px] font-black uppercase tracking-widest text-cyber-blue border border-cyber-blue/30">
                              {v.type}
                            </span>
                          </div>

                          {v.confidence && (
                            <div className="absolute top-3 right-3 px-2 py-0.5 bg-black/70 backdrop-blur-md rounded text-[8px] font-mono text-white/70">
                              {(v.confidence * 100).toFixed(0)}% AI Conf
                            </div>
                          )}
                        </div>

                        <div className="p-5 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-1">
                              <h3 className="text-xl font-display font-black tracking-tight text-white group-hover:text-cyber-blue transition-colors">
                                {v.vehicleNumber}
                              </h3>
                              <span className="text-[9px] font-mono text-cyber-green font-bold">
                                ₹{v.penaltyAmount || 1000}
                              </span>
                            </div>

                            {/* RTO Status Pill */}
                            <div className="mb-3">
                              {rtoMatch ? (
                                <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-cyber-green bg-cyber-green/10 px-2 py-0.5 rounded border border-cyber-green/20">
                                  <Check className="w-2.5 h-2.5" /> RTO Reg: {rtoMatch.ownerName} ({rtoMatch.makeModel.split(' ')[0]})
                                </span>
                              ) : v.vehicleNumber !== 'Unknown' && v.vehicleNumber !== 'MANUAL' ? (
                                <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-cyber-red bg-cyber-red/10 px-2 py-0.5 rounded border border-cyber-red/20">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Unregistered Plate
                                </span>
                              ) : null}
                            </div>

                            <p className="text-[10px] text-white/50 leading-relaxed uppercase tracking-wide line-clamp-2 italic mb-4">
                              "{v.description || 'Infraction detected via neural highway grid.'}"
                            </p>
                          </div>

                          <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[8px] font-mono text-white/30">
                              {v.timestamp?.toDate ? v.timestamp.toDate().toLocaleTimeString() : 'Recent'}
                            </span>
                            <span className="text-[9px] font-black text-cyber-blue uppercase tracking-widest group-hover:underline flex items-center gap-1">
                              <Eye className="w-3 h-3" /> Inspect
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RTO VEHICLE DATABASE REGISTRY */}
          {activeTab === 'registry' && (
            <div className="space-y-6">
              {/* Search and Filters Bar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative md:col-span-2">
                  <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    placeholder="Search by Plate (e.g. KA-01-HH-1234), Owner Name, Phone, Make/Model, RTO Zone..."
                    value={vehicleSearch}
                    onChange={(e) => setVehicleSearch(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyber-blue transition-colors"
                  />
                  {vehicleSearch && (
                    <button
                      onClick={() => setVehicleSearch('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div>
                  <select
                    value={vehicleStatusFilter}
                    onChange={(e) => setVehicleStatusFilter(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyber-blue"
                  >
                    <option value="All" className="bg-black text-white">All RC Statuses</option>
                    <option value="Active" className="bg-black text-white">Active Valid</option>
                    <option value="Suspended" className="bg-black text-white">Suspended</option>
                    <option value="Expired" className="bg-black text-white">Expired PUC/Insurance</option>
                    <option value="Blacklisted" className="bg-black text-white">Blacklisted</option>
                    <option value="Stolen" className="bg-black text-white">Reported Stolen (FIR)</option>
                  </select>
                </div>

                <div>
                  <select
                    value={vehicleTypeFilter}
                    onChange={(e) => setVehicleTypeFilter(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyber-blue"
                  >
                    <option value="All" className="bg-black text-white">All Vehicle Types</option>
                    <option value="Motorcycle" className="bg-black text-white">Motorcycles</option>
                    <option value="Scooter" className="bg-black text-white">Scooters</option>
                    <option value="EV Two-Wheeler" className="bg-black text-white">EV Two-Wheelers</option>
                    <option value="Car" className="bg-black text-white">Cars</option>
                    <option value="Commercial" className="bg-black text-white">Commercial</option>
                  </select>
                </div>
              </div>

              {/* Vehicle Table */}
              <div className="overflow-x-auto border border-white/10 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      {[
                        'License Plate',
                        'Owner Details',
                        'Make & Model',
                        'Type',
                        'RC Status',
                        'Insurance / PUC',
                        'RTO Jurisdiction',
                        'Actions',
                      ].map((h) => (
                        <th key={h} className="p-4 text-[9px] font-black uppercase tracking-[0.25em] text-white/40">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredVehicles.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-white/30 text-xs italic">
                          No vehicles found matching the filter criteria. Click "Seed Sample Database" or "Register Vehicle" to add records.
                        </td>
                      </tr>
                    ) : (
                      filteredVehicles.map((veh) => (
                        <tr
                          key={veh.registrationNumber}
                          className={`group hover:bg-white/[0.03] transition-colors ${
                            veh.stolenFlag ? 'bg-red-500/5' : ''
                          }`}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="font-display font-black text-white text-base group-hover:text-cyber-blue transition-colors">
                                {veh.registrationNumber}
                              </span>
                              {veh.stolenFlag && (
                                <span className="px-1.5 py-0.5 bg-cyber-red text-white text-[8px] font-black uppercase rounded animate-pulse">
                                  STOLEN
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="p-4">
                            <p className="text-xs font-bold text-white">{veh.ownerName}</p>
                            <p className="text-[10px] font-mono text-white/40">{veh.ownerPhone || 'No Phone'}</p>
                          </td>

                          <td className="p-4">
                            <p className="text-xs text-white/80">{veh.makeModel}</p>
                            {veh.chassisNumber && (
                              <p className="text-[9px] font-mono text-white/30">Chassis: {veh.chassisNumber.slice(-8)}</p>
                            )}
                          </td>

                          <td className="p-4">
                            <span className="text-[10px] font-mono text-white/60 uppercase">
                              {veh.vehicleType || 'Motorcycle'}
                            </span>
                          </td>

                          <td className="p-4">
                            <span
                              className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                veh.status === 'Active'
                                  ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20'
                                  : veh.status === 'Blacklisted' || veh.stolenFlag
                                  ? 'bg-cyber-red/10 text-cyber-red border border-cyber-red/20'
                                  : 'bg-cyber-orange/10 text-cyber-orange border border-cyber-orange/20'
                              }`}
                            >
                              {veh.status}
                            </span>
                          </td>

                          <td className="p-4">
                            <p className="text-[10px] text-white/60 font-mono">
                              Ins: <span className="text-white">{veh.insuranceValidUntil || 'N/A'}</span>
                            </p>
                            <p className="text-[9px] text-white/40 font-mono">
                              PUC: {veh.pucValidUntil || 'N/A'}
                            </p>
                          </td>

                          <td className="p-4">
                            <p className="text-[10px] text-white/50">{veh.rtoZone || 'Central Grid'}</p>
                          </td>

                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedVehicle(veh)}
                                className="p-2 bg-white/5 hover:bg-cyber-blue hover:text-black rounded-lg text-white/60 transition-colors"
                                title="Inspect RC Record"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteVehicle(veh.registrationNumber)}
                                className="p-2 bg-white/5 hover:bg-cyber-red text-white/40 hover:text-white rounded-lg transition-colors"
                                title="Delete Vehicle"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: PREDICTIVE INTEL & ANALYTICS */}
          {activeTab === 'intelligence' && (
            <div className="space-y-8">
              {/* Analytics Top Row Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">
                    Resolution & Enforcement
                  </p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-display font-black text-cyber-green">
                      {analyticsData.resolutionRate}%
                    </span>
                    <span className="text-xs text-white/50">
                      ({analyticsData.resolvedCount} of {violations.length} Resolved)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full mt-4 overflow-hidden">
                    <div
                      className="h-full bg-cyber-green transition-all duration-1000"
                      style={{ width: `${analyticsData.resolutionRate}%` }}
                    />
                  </div>
                </div>

                <div className="glass-panel p-6 border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">
                    Total Fines Endorsed
                  </p>
                  <p className="text-3xl font-display font-black text-cyber-purple">
                    ₹{analyticsData.totalPenaltiesCollected.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-white/30 font-mono mt-2">
                    Assigned per RTO Motor Vehicles Amendment Act
                  </p>
                </div>

                <div className="glass-panel p-6 border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">
                    High Risk Hotspot Sentry
                  </p>
                  <p className="text-3xl font-display font-black text-cyber-orange">
                    KA-51 (Electronic City)
                  </p>
                  <p className="text-[10px] text-white/30 font-mono mt-2">
                    Highest violation density detected this week
                  </p>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 1. Violation Distribution Donut */}
                <div className="glass-panel p-6 border-white/5">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white mb-6 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-cyber-blue" /> Infraction Category Distribution
                  </h3>
                  <div className="h-[280px] w-full">
                    {analyticsData.pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analyticsData.pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={95}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {analyticsData.pieData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0a0d1d',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '12px',
                              fontSize: '11px',
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-white/30 text-xs">
                        No infractions logged yet to generate distribution.
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Weekly Trend Area Chart */}
                <div className="glass-panel p-6 border-white/5">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white mb-6 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyber-green" /> Weekly Infraction & Incident Trends
                  </h3>
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analyticsData.trendData}>
                        <defs>
                          <linearGradient id="colorViolations" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00D1FF" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#00D1FF" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="day" stroke="#666" fontSize={10} />
                        <YAxis stroke="#666" fontSize={10} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0a0d1d',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            fontSize: '11px',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="violations"
                          name="Traffic Violations"
                          stroke="#00D1FF"
                          fillOpacity={1}
                          fill="url(#colorViolations)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 3. Hotspot Risk Matrix Bar Chart */}
                <div className="glass-panel p-6 border-white/5 lg:col-span-2">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white mb-6 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyber-orange" /> High-Risk Traffic Sector Hotspots
                  </h3>
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData.zoneData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="zone" stroke="#666" fontSize={10} />
                        <YAxis stroke="#666" fontSize={10} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0a0d1d',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            fontSize: '11px',
                          }}
                        />
                        <Bar dataKey="infractions" name="Logged Infractions" fill="#FF5500" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="risk" name="Sector Risk Index" fill="#00D1FF" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: ADD NEW RTO VEHICLE */}
      <AnimatePresence>
        {isAddVehicleOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 relative border-white/10"
            >
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-cyber-blue/10 rounded-xl text-cyber-blue">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-black text-white">REGISTER VEHICLE RECORD</h2>
                    <p className="text-[9px] font-mono text-white/40 uppercase">
                      Central RTO Motor Vehicle Registration
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddVehicleOpen(false)}
                  className="p-2 text-white/40 hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveVehicle} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-1 block">
                      Registration / Plate No *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. KA-05-MN-4521"
                      value={vehicleForm.registrationNumber}
                      onChange={(e) =>
                        setVehicleForm({ ...vehicleForm, registrationNumber: e.target.value.toUpperCase() })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white uppercase font-bold focus:border-cyber-blue"
                    />
                    {formErrors.registrationNumber && (
                      <p className="text-[9px] text-cyber-red mt-1">{formErrors.registrationNumber}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-1 block">
                      Vehicle Type
                    </label>
                    <select
                      value={vehicleForm.vehicleType}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleType: e.target.value as any })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-cyber-blue"
                    >
                      <option value="Motorcycle" className="bg-black text-white">Motorcycle</option>
                      <option value="Scooter" className="bg-black text-white">Scooter</option>
                      <option value="EV Two-Wheeler" className="bg-black text-white">EV Two-Wheeler</option>
                      <option value="Car" className="bg-black text-white">Car</option>
                      <option value="Commercial" className="bg-black text-white">Commercial Vehicle</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-1 block">
                      Owner Legal Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Priya Sundaram"
                      value={vehicleForm.ownerName}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, ownerName: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-cyber-blue"
                    />
                    {formErrors.ownerName && (
                      <p className="text-[9px] text-cyber-red mt-1">{formErrors.ownerName}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-1 block">
                      Owner Contact Phone *
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 9880145678"
                      value={vehicleForm.ownerPhone}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, ownerPhone: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-cyber-blue"
                    />
                    {formErrors.ownerPhone && (
                      <p className="text-[9px] text-cyber-red mt-1">{formErrors.ownerPhone}</p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-1 block">
                      Make & Model (with color) *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Honda Activa 6G Premium (Pearl Siren Blue)"
                      value={vehicleForm.makeModel}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, makeModel: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-cyber-blue"
                    />
                    {formErrors.makeModel && (
                      <p className="text-[9px] text-cyber-red mt-1">{formErrors.makeModel}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-1 block">
                      RC Status
                    </label>
                    <select
                      value={vehicleForm.status}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, status: e.target.value as any })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-cyber-blue"
                    >
                      <option value="Active" className="bg-black text-white">Active</option>
                      <option value="Suspended" className="bg-black text-white">Suspended</option>
                      <option value="Expired" className="bg-black text-white">Expired</option>
                      <option value="Blacklisted" className="bg-black text-white">Blacklisted</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-1 block">
                      RTO District Zone
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. KA-05 (Jayanagar, Bangalore)"
                      value={vehicleForm.rtoZone}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, rtoZone: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-cyber-blue"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-1 block">
                      Insurance Valid Until
                    </label>
                    <input
                      type="date"
                      value={vehicleForm.insuranceValidUntil}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, insuranceValidUntil: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-cyber-blue"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-1 block">
                      PUC / Pollution Valid Until
                    </label>
                    <input
                      type="date"
                      value={vehicleForm.pucValidUntil}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, pucValidUntil: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-cyber-blue"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-1 block">
                      Chassis Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ME4JF504HK801294"
                      value={vehicleForm.chassisNumber}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, chassisNumber: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white uppercase font-mono focus:border-cyber-blue"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-1 block">
                      Engine Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. JF50E8019482"
                      value={vehicleForm.engineNumber}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, engineNumber: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white uppercase font-mono focus:border-cyber-blue"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <input
                      type="checkbox"
                      id="stolenFlag"
                      checked={vehicleForm.stolenFlag}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, stolenFlag: e.target.checked })}
                      className="w-4 h-4 accent-cyber-red rounded cursor-pointer"
                    />
                    <label htmlFor="stolenFlag" className="text-xs text-red-200 font-bold cursor-pointer">
                      Flag as Reported Stolen / Active FIR Lookout (Triggers Critical Sentry Alarm)
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsAddVehicleOpen(false)}
                    className="px-6 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white/60"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2.5 bg-cyber-blue text-black font-display font-black text-xs uppercase tracking-wider rounded-xl shadow-[0_0_20px_#00D1FF]"
                  >
                    Save to Central RTO
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: VEHICLE DETAILS & RC CERTIFICATE VIEWER */}
      <AnimatePresence>
        {selectedVehicle && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel w-full max-w-xl p-8 relative border-white/10"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-cyber-blue">
                    RTO Ministry of Road Transport & Highways
                  </span>
                  <h2 className="text-2xl font-display font-black text-white mt-1">
                    {selectedVehicle.registrationNumber}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedVehicle(null)}
                  className="p-2 text-white/40 hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selectedVehicle.stolenFlag && (
                <div className="p-4 bg-cyber-red/20 border border-cyber-red/40 rounded-2xl flex items-center gap-3 text-cyber-red mb-6 animate-pulse">
                  <ShieldAlert className="w-6 h-6 shrink-0" />
                  <div>
                    <p className="text-xs font-black uppercase">CRITICAL: STOLEN VEHICLE LOOKOUT ACTIVE</p>
                    <p className="text-[10px] text-red-200/70">
                      Vehicle is flagged in the Police National Crime Records Bureau database.
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-black/60 border border-white/10 rounded-2xl p-6 space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">Registered Owner</span>
                    <span className="font-bold text-white text-sm">{selectedVehicle.ownerName}</span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">Owner Contact</span>
                    <a
                      href={`tel:${selectedVehicle.ownerPhone}`}
                      className="font-mono text-cyber-blue font-bold hover:underline"
                    >
                      {selectedVehicle.ownerPhone}
                    </a>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">Make & Model</span>
                    <span className="text-white font-medium">{selectedVehicle.makeModel}</span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">Vehicle Class</span>
                    <span className="text-white font-medium">{selectedVehicle.vehicleType}</span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">RC Status</span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        selectedVehicle.status === 'Active'
                          ? 'bg-cyber-green text-black'
                          : 'bg-cyber-red text-white'
                      }`}
                    >
                      {selectedVehicle.status}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">RTO Zone</span>
                    <span className="text-white">{selectedVehicle.rtoZone}</span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">Insurance Validity</span>
                    <span className="text-white font-mono">{selectedVehicle.insuranceValidUntil || 'N/A'}</span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">Pollution (PUC)</span>
                    <span className="text-white font-mono">{selectedVehicle.pucValidUntil || 'N/A'}</span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">Chassis No.</span>
                    <span className="text-white/60 font-mono text-[10px]">{selectedVehicle.chassisNumber || 'N/A'}</span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">Engine No.</span>
                    <span className="text-white/60 font-mono text-[10px]">{selectedVehicle.engineNumber || 'N/A'}</span>
                  </div>
                </div>

                {selectedVehicle.notes && (
                  <div className="pt-3 border-t border-white/10">
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block mb-1">RTO File Notes</span>
                    <p className="text-[11px] text-white/70 italic">"{selectedVehicle.notes}"</p>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center">
                <button
                  onClick={() => handleDeleteVehicle(selectedVehicle.registrationNumber)}
                  className="px-4 py-2 bg-cyber-red/10 border border-cyber-red/30 text-cyber-red hover:bg-cyber-red hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove from Registry
                </button>
                <button
                  onClick={() => setSelectedVehicle(null)}
                  className="px-6 py-2 bg-white/10 text-white hover:bg-white/20 rounded-xl text-xs font-bold transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: VIOLATION INSPECTION & CHALLAN ISSUER */}
      <AnimatePresence>
        {selectedViolation && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 relative border-white/10"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-cyber-orange">
                    Infraction Case Dossier
                  </span>
                  <h2 className="text-2xl font-display font-black text-white mt-1">
                    {selectedViolation.vehicleNumber}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedViolation(null)}
                  className="p-2 text-white/40 hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Evidence Image */}
                <div className="rounded-2xl overflow-hidden bg-black border border-white/10 aspect-video relative">
                  {selectedViolation.photoUrl ? (
                    <img
                      src={selectedViolation.photoUrl}
                      alt="Violation Evidence"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">
                      No Visual Evidence Snapshot
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/80 backdrop-blur-md rounded text-[8px] font-mono text-white/70">
                    Confidence: {((selectedViolation.confidence || 0.85) * 100).toFixed(0)}%
                  </div>
                </div>

                {/* Violation Details */}
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">Offense Classification</span>
                    <span className="font-display font-black text-cyber-orange text-base uppercase">
                      {selectedViolation.type}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">AI Vision Description</span>
                    <p className="text-white/80 leading-relaxed text-[11px] italic">
                      "{selectedViolation.description}"
                    </p>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">Recommended Penalty Fine</span>
                    <span className="font-display font-black text-cyber-green text-lg">
                      ₹{selectedViolation.penaltyAmount || 1000}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">Current Case Status</span>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-black uppercase ${
                        selectedViolation.status === 'Resolved' || selectedViolation.status === 'Endorsed'
                          ? 'bg-cyber-green text-black'
                          : selectedViolation.status === 'Spam'
                          ? 'bg-white/20 text-white'
                          : 'bg-cyber-orange text-white'
                      }`}
                    >
                      {selectedViolation.status || 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* RTO Cross-Check Box */}
              {(() => {
                const rtoMatch = vehicles.find(
                  (veh) =>
                    veh.registrationNumber.replace(/[\s-]/g, '').toUpperCase() ===
                    selectedViolation.vehicleNumber.replace(/[\s-]/g, '').toUpperCase()
                );

                return (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl mb-6">
                    <p className="text-[9px] font-black uppercase tracking-widest text-cyber-blue mb-2 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5" /> Central RTO Cross-Reference Verification
                    </p>
                    {rtoMatch ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <span className="text-white/40 block text-[8px]">Owner:</span>
                          <span className="text-white font-bold">{rtoMatch.ownerName}</span>
                        </div>
                        <div>
                          <span className="text-white/40 block text-[8px]">Make/Model:</span>
                          <span className="text-white">{rtoMatch.makeModel}</span>
                        </div>
                        <div>
                          <span className="text-white/40 block text-[8px]">RC Status:</span>
                          <span className="text-cyber-green font-bold">{rtoMatch.status}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-cyber-red font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> NO RECORD IN RTO REGISTRY — PROBABLE FAKE / UNREGISTERED PLATE
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
                <button
                  onClick={() => updateViolationStatus(selectedViolation.id, 'Spam')}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white rounded-xl text-xs font-bold transition-all"
                >
                  Discard as False Positive
                </button>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateViolationStatus(selectedViolation.id, 'Resolved')}
                    className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    Mark Resolved
                  </button>

                  <button
                    onClick={() =>
                      updateViolationStatus(selectedViolation.id, 'Endorsed', selectedViolation.penaltyAmount || 1000)
                    }
                    className="px-6 py-2.5 bg-cyber-blue text-black font-display font-black text-xs uppercase tracking-wider rounded-xl shadow-[0_0_20px_#00D1FF] hover:scale-105 transition-all"
                  >
                    Issue Official e-Challan
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
