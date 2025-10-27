import { StockItem, ActivityLogEntry, Supplier, CreditTransaction, TeamMember, BinStockData, BinCounts, BinTypeName, BinTypeDefinition } from './types';

export const INITIAL_STOCK_DATA: Omit<StockItem, 'id'>[] = [
  { name: '1.5kg Narjie boxes', category: 'Deons', opening_stock: 0, added_today: 100, packed: 0, lost: 0, alert_level: 100, price: 2, color: '#10B981' },
  { name: '1.8kg Boxes', category: 'Groenkloof', opening_stock: 0, added_today: 9000, packed: 400, lost: 36, alert_level: 100, price: 8, color: '#EC4899' },
  { name: '10kg BBM', category: '', opening_stock: 1200, added_today: 23, packed: 300, lost: 24, alert_level: 100, price: 1.45, color: '#8B5CF6' },
  { name: '10kg Harvest', category: '', opening_stock: 1000, added_today: 0, packed: 0, lost: 0, alert_level: 100, price: 89, color: '#F59E0B' },
  { name: '15kg boxes innes', category: '', opening_stock: 0, added_today: 1500, packed: 1450, lost: 30, alert_level: 100, price: 0.009, color: '#3B82F6' },
  { name: '15kg Boxes outers', category: '', opening_stock: 0, added_today: 1500, packed: 0, lost: 0, alert_level: 100, price: 0.6667, color: '#6366F1' },
  { name: '7kg Boxes', category: '', opening_stock: 0, added_today: 700, packed: 90, lost: 10, alert_level: 100, price: 0.5571, color: '#F97316' },
  { name: '9kg boxes inners', category: '', opening_stock: 0, added_today: 1500, packed: 0, lost: 0, alert_level: 100, price: 4, color: '#EF4444' },
  { name: '9kg Box outer', category: '', opening_stock: 0, added_today: 0, packed: 0, lost: 0, alert_level: 100, price: 6, color: '#10B981' },
];

export const INITIAL_ACTIVITY_LOG_DATA: (Omit<ActivityLogEntry, 'id' | 'team_id' | 'user_id' | 'users'> & { actor: 'user' | 'system' })[] = [
    { timestamp: '2025-10-12T09:05:14Z', actor: 'user', item_name: '1.8kg Boxes', change_description: "Set 'Packed' to 400" },
    { timestamp: '2025-10-12T09:05:02Z', actor: 'system', item_name: '10kg BBM', change_description: "Set 'Packed' to 300, 'Lost' to 24" },
    { timestamp: '2025-10-12T08:45:33Z', actor: 'system', item_name: 'All Items', change_description: "'New Day' process initiated." },
    { timestamp: '2025-10-11T14:20:00Z', actor: 'user', item_name: '7kg Boxes', change_description: "Added 700 units via cash." },
    { timestamp: '2025-10-11T11:00:00Z', actor: 'system', item_name: 'All Items', change_description: "'New Day' process initiated." },
];

export const INITIAL_SUPPLIERS_DATA: Supplier[] = [];

export const INITIAL_TRANSACTIONS_DATA: CreditTransaction[] = [];

export const INITIAL_TEAM_NAME = 'Afrivon Tech';

export const INITIAL_TEAM_MEMBERS: TeamMember[] = [
    { id: 't1', name: 'Davison Munemo', email: 'davison@afrivon.com', role: 'Owner' },
    { id: 't2', name: 'Jane Doe', email: 'jane.d@example.com', role: 'Manager' },
    { id: 't3', name: 'John Smith', email: 'john.s@example.com', role: 'Worker' },
];

// --- Initial Data for Bin Stock Take ---
// FIX: Exported INITIAL_BIN_TYPES to resolve import error in Dashboard.tsx.
export const INITIAL_BIN_TYPES: BinTypeDefinition[] = [
  { id: 'chepPlastic', name: 'Chep Plastic', color: '#3B82F6', category: 'standard', isDefault: true },
  { id: 'chepWood', name: 'Chep Wood', color: '#A16207', category: 'standard', isDefault: true },
  { id: 'f1Wood', name: 'F1 Wood', color: '#854d0e', category: 'standard', isDefault: true },
  { id: 'alg', name: 'ALG', color: '#16A34A', category: 'standard', isDefault: true },
  { id: 'cSelect', name: 'C/Select', color: '#6D28D9', category: 'standard', isDefault: true },
  { id: 'mJackson', name: 'M Jackson', color: '#1F2937', category: 'standard', isDefault: true },
  { id: 'mixedWood', name: 'Mixed Wood', color: '#78716C', category: 'mixed', isDefault: true, sub_category: 'mixedWood' },
  { id: 'mixedPlastic', name: 'Mixed Plastic', color: '#71717A', category: 'mixed', isDefault: true, sub_category: 'mixedPlastic' },
];

const createEmptyBinCounts = (): BinCounts => {
    return INITIAL_BIN_TYPES.reduce((acc, type) => {
        acc[type.id] = 0;
        return acc;
    }, {} as BinCounts);
};

export const INITIAL_BIN_STOCK_DATA: BinStockData = {
    statuses: {
        total: createEmptyBinCounts(),
        full: createEmptyBinCounts(),
        inFridge: createEmptyBinCounts(),
        broken: createEmptyBinCounts(),
        dump: createEmptyBinCounts(),
    },
    owedToUs: [
        { id: 'p1', name: 'Ziyard', bins: createEmptyBinCounts() }
    ],
    weOwe: [],
    notes: "Initial notes for company stock and farm bins can be entered here.",
    history: [
        { 
          id: 'bh1', 
          timestamp: new Date().toISOString(), 
          type: 'movement',
          change: 'Sent 2 Chep Plastic to Ziyard',
          details: {
            movementType: 'sent',
            quantity: 2,
            binName: 'Chep Plastic',
            partyName: 'Ziyard',
            transporter: 'Self Collection'
          }
        },
    ],
    binTypes: INITIAL_BIN_TYPES,
    customBinTypes: [],
    dailyTotals: {
        openingTotal: createEmptyBinCounts(),
        nowTotal: createEmptyBinCounts(),
    },
    ourBins: createEmptyBinCounts(),
};

export const EMPTY_BIN_STOCK_DATA: BinStockData = {
    statuses: {
        total: {},
        full: {},
        inFridge: {},
        broken: {},
        dump: {},
    },
    owedToUs: [],
    weOwe: [],
    notes: "",
    history: [],
    binTypes: [],
    customBinTypes: [],
    dailyTotals: {
        openingTotal: {},
        nowTotal: {},
    },
    ourBins: {},
};