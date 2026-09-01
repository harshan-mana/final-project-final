import { db, handleFirestoreError, OperationType } from './firebase';
import { doc, setDoc, writeBatch, collection } from 'firebase/firestore';

export interface RTOVehicle {
  registrationNumber: string;
  ownerName: string;
  ownerPhone: string;
  vehicleType: 'Motorcycle' | 'Scooter' | 'EV Two-Wheeler' | 'Car' | 'Commercial';
  makeModel: string;
  status: 'Active' | 'Suspended' | 'Expired' | 'Blacklisted';
  insuranceValidUntil: string;
  pucValidUntil: string;
  chassisNumber: string;
  engineNumber: string;
  registrationDate: string;
  rtoZone: string;
  stolenFlag?: boolean;
  notes?: string;
}

export const SAMPLE_RTO_VEHICLES: RTOVehicle[] = [
  {
    registrationNumber: 'KA-01-HH-1234',
    ownerName: 'Rahul Sharma',
    ownerPhone: '9845012345',
    vehicleType: 'Motorcycle',
    makeModel: 'Royal Enfield Hunter 350 (Dapper Grey)',
    status: 'Active',
    insuranceValidUntil: '2027-05-18',
    pucValidUntil: '2026-11-20',
    chassisNumber: 'ME4ME412HK908123',
    engineNumber: 'J1-349-98124',
    registrationDate: '2023-05-19',
    rtoZone: 'KA-01 (Koramangala, Bangalore Central)',
    stolenFlag: false,
    notes: 'Clean record. Valid road tax paid.',
  },
  {
    registrationNumber: 'KA-05-MN-4521',
    ownerName: 'Priya Sundaram',
    ownerPhone: '9880145678',
    vehicleType: 'Scooter',
    makeModel: 'Honda Activa 6G Premium (Pearl Siren Blue)',
    status: 'Active',
    insuranceValidUntil: '2027-01-10',
    pucValidUntil: '2026-09-15',
    chassisNumber: 'ME4JF504HK801294',
    engineNumber: 'JF50E8019482',
    registrationDate: '2022-01-11',
    rtoZone: 'KA-05 (Jayanagar, Bangalore South)',
    stolenFlag: false,
    notes: 'Regular commuter, valid papers.',
  },
  {
    registrationNumber: 'DL-03-CC-9988',
    ownerName: 'Vikram Malhotra',
    ownerPhone: '9811099887',
    vehicleType: 'Motorcycle',
    makeModel: 'KTM Duke 390 (Electronic Orange)',
    status: 'Blacklisted',
    insuranceValidUntil: '2024-03-12',
    pucValidUntil: '2023-12-05',
    chassisNumber: 'VBKJUJ406MM104921',
    engineNumber: '93809240192',
    registrationDate: '2021-03-14',
    rtoZone: 'DL-03 (Sheikh Sarai, South Delhi)',
    stolenFlag: true,
    notes: 'REPORTED STOLEN: FIR #2024/918 at Hauz Khas PS. Intercept on detection.',
  },
  {
    registrationNumber: 'MH-12-AB-5678',
    ownerName: 'Amit Deshmukh',
    ownerPhone: '9764056789',
    vehicleType: 'Motorcycle',
    makeModel: 'Bajaj Pulsar NS200 (Burnt Red)',
    status: 'Active',
    insuranceValidUntil: '2026-11-30',
    pucValidUntil: '2026-07-22',
    chassisNumber: 'MD2A11CY8JWB34910',
    engineNumber: 'JL35910482',
    registrationDate: '2020-11-25',
    rtoZone: 'MH-12 (Pune Central, Maharashtra)',
    stolenFlag: false,
    notes: 'Registered personal conveyance.',
  },
  {
    registrationNumber: 'TN-09-XY-3456',
    ownerName: 'Karthik Subramanian',
    ownerPhone: '9444034567',
    vehicleType: 'EV Two-Wheeler',
    makeModel: 'Ather 450X Gen 3 (Cosmic Black)',
    status: 'Active',
    insuranceValidUntil: '2028-09-14',
    pucValidUntil: '2030-01-01',
    chassisNumber: 'MAT450X22KP003418',
    engineNumber: 'EM450091823',
    registrationDate: '2023-09-15',
    rtoZone: 'TN-09 (T. Nagar, Chennai South)',
    stolenFlag: false,
    notes: 'Green registration plate. Battery warranty active.',
  },
  {
    registrationNumber: 'KA-03-EZ-8812',
    ownerName: 'Ananya Hegde',
    ownerPhone: '9900188123',
    vehicleType: 'Motorcycle',
    makeModel: 'Yamaha MT-15 V2 (Cyan Storm)',
    status: 'Suspended',
    insuranceValidUntil: '2024-06-01',
    pucValidUntil: '2024-04-10',
    chassisNumber: 'ME1RG6313N0023910',
    engineNumber: 'G3N9E009418',
    registrationDate: '2022-06-02',
    rtoZone: 'KA-03 (Indiranagar, Bangalore East)',
    stolenFlag: false,
    notes: 'RC Suspended: Unpaid multiple signal jumping fines.',
  },
  {
    registrationNumber: 'TS-08-JK-7723',
    ownerName: 'Mohammed Zeeshan',
    ownerPhone: '9849077234',
    vehicleType: 'Motorcycle',
    makeModel: 'TVS Apache RTR 160 4V (Racing Red)',
    status: 'Active',
    insuranceValidUntil: '2026-12-10',
    pucValidUntil: '2026-06-18',
    chassisNumber: 'MD625CF51K2B19482',
    engineNumber: 'CF5E9182391',
    registrationDate: '2021-12-12',
    rtoZone: 'TS-08 (Uppal, Hyderabad East)',
    stolenFlag: false,
    notes: 'Compliant driver record.',
  },
  {
    registrationNumber: 'KA-51-MD-9001',
    ownerName: 'Deepak Gowda',
    ownerPhone: '9980590012',
    vehicleType: 'Motorcycle',
    makeModel: 'Hero Splendor Plus XTEC (Black Canvas)',
    status: 'Expired',
    insuranceValidUntil: '2023-08-15',
    pucValidUntil: '2023-05-10',
    chassisNumber: 'MBLHAW112M9H01923',
    engineNumber: 'HA11E9H19283',
    registrationDate: '2018-08-16',
    rtoZone: 'KA-51 (Electronic City, Bangalore)',
    stolenFlag: false,
    notes: 'Insurance & PUC Expired > 12 months.',
  },
  {
    registrationNumber: 'KL-07-CD-4422',
    ownerName: 'Nikhil Varma',
    ownerPhone: '9447044221',
    vehicleType: 'Motorcycle',
    makeModel: 'Suzuki Gixxer SF 250 (Metallic Matte)',
    status: 'Active',
    insuranceValidUntil: '2027-04-20',
    pucValidUntil: '2026-10-12',
    chassisNumber: 'MB8ED22SKL8019482',
    engineNumber: 'ED22E801928',
    registrationDate: '2023-04-21',
    rtoZone: 'KL-07 (Ernakulam, Kochi)',
    stolenFlag: false,
    notes: 'Verified state transport database entry.',
  },
  {
    registrationNumber: 'MH-02-EE-1100',
    ownerName: 'Sameer Kulkarni',
    ownerPhone: '9820011009',
    vehicleType: 'Car',
    makeModel: 'Tata Nexon EV Max (Pristine White)',
    status: 'Active',
    insuranceValidUntil: '2028-02-15',
    pucValidUntil: '2030-01-01',
    chassisNumber: 'MAT623401NK001928',
    engineNumber: 'EV30091823',
    registrationDate: '2023-02-16',
    rtoZone: 'MH-02 (Andheri, Mumbai West)',
    stolenFlag: false,
    notes: 'Zero emission commercial/personal vehicle.',
  }
];

export async function seedRTODatabase(onProgress?: (count: number, total: number) => void): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const total = SAMPLE_RTO_VEHICLES.length;
    let count = 0;
    
    for (const vehicle of SAMPLE_RTO_VEHICLES) {
      // Standardize doc ID by removing hyphens and spaces or keeping standard plate format
      const docId = vehicle.registrationNumber.trim().toUpperCase();
      await setDoc(doc(db, 'vehicles', docId), {
        ...vehicle,
        registrationNumber: docId,
        updatedAt: new Date().toISOString(),
      });
      count++;
      if (onProgress) onProgress(count, total);
    }
    return { success: true, count };
  } catch (error: any) {
    console.error('Failed to seed RTO database:', error);
    handleFirestoreError(error, OperationType.WRITE, 'vehicles');
    return { success: false, count: 0, error: error?.message || 'Database write error' };
  }
}

export function exportVehiclesToJSON(vehicles: RTOVehicle[]): string {
  return JSON.stringify(vehicles, null, 2);
}

export function exportVehiclesToCSV(vehicles: RTOVehicle[]): string {
  const headers = [
    'registrationNumber',
    'ownerName',
    'ownerPhone',
    'vehicleType',
    'makeModel',
    'status',
    'insuranceValidUntil',
    'pucValidUntil',
    'chassisNumber',
    'engineNumber',
    'registrationDate',
    'rtoZone',
    'stolenFlag',
    'notes'
  ];

  const rows = vehicles.map(v => [
    `"${v.registrationNumber || ''}"`,
    `"${v.ownerName || ''}"`,
    `"${v.ownerPhone || ''}"`,
    `"${v.vehicleType || ''}"`,
    `"${v.makeModel || ''}"`,
    `"${v.status || 'Active'}"`,
    `"${v.insuranceValidUntil || ''}"`,
    `"${v.pucValidUntil || ''}"`,
    `"${v.chassisNumber || ''}"`,
    `"${v.engineNumber || ''}"`,
    `"${v.registrationDate || ''}"`,
    `"${v.rtoZone || ''}"`,
    `"${v.stolenFlag ? 'TRUE' : 'FALSE'}"`,
    `"${(v.notes || '').replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export function parseVehiclesFromCSV(csvText: string): RTOVehicle[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map(h => h.replace(/^["']|["']$/g, '').trim());
  const results: RTOVehicle[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parser supporting quotes
    const row: string[] = [];
    let current = '';
    let insideQuotes = false;
    for (let char of lines[i]) {
      if (char === '"' || char === "'") {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());

    const item: any = {};
    headers.forEach((h, idx) => {
      let val = row[idx] ? row[idx].replace(/^["']|["']$/g, '').trim() : '';
      if (h === 'stolenFlag') {
        item[h] = val.toUpperCase() === 'TRUE' || val === '1';
      } else {
        item[h] = val;
      }
    });

    if (item.registrationNumber) {
      item.registrationNumber = item.registrationNumber.toUpperCase();
      if (!item.status) item.status = 'Active';
      if (!item.vehicleType) item.vehicleType = 'Motorcycle';
      results.push(item as RTOVehicle);
    }
  }

  return results;
}
