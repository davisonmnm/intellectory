export interface StockItem {
  id: string;
  name: string;
  category: string;
  opening_stock: number;
  added_today: number;
  packed: number;
  lost: number;
  alert_level: number;
  price: number;
  color: string;
  team_id?: string;
  user_id?: string;
}

export type EditableStockItemKey = 'opening_stock' | 'added_today' | 'packed' | 'lost' | 'alert_level' | 'price';

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  user_id: string | null;
  item_name: string;
  change_description: string;
  team_id: string;
  users?: {
    full_name: string;
  } | null;
}

export interface Supplier {
  id:string;
  name: string;
  balance: number;
  team_id: string;
}

export interface CreditTransaction {
  id: string;
  supplier_id: string;
  team_id: string;
  stock_item_name: string;
  quantity: number;
  total_value: number;
  timestamp: string;
}

export interface TeamMember {
  id: string; // This would be the user_id
  name: string;
  email: string;
  role: 'Owner' | 'Manager' | 'Worker';
}

export interface Team {
  id: string;
  name: string;
}

// --- Bin Stock Take Types ---

export type BinTypeName = 'chepPlastic' | 'chepWood' | 'f1Wood' | 'alg' | 'cSelect' | 'mixedWood' | 'mixedPlastic' | 'mJackson';

export interface BinTypeDefinition {
  id: string;
  name: string;
  color: string;
  category: 'standard' | 'mixed';
  isDefault: boolean;
  sub_category?: 'mixedWood' | 'mixedPlastic';
}

export interface CustomBinType {
  id: string;
  name: string;
  category: 'mixedWood' | 'mixedPlastic';
}

export interface BinCounts {
  [key: string]: number | '';
}

export interface BinParty {
  id: string;
  name: string;
  bins: BinCounts;
}

export interface CalculatedData {
  owedToUs: BinParty[];
  weOwe: BinParty[];
}

export interface BinHistoryEntry {
  id: string;
  timestamp: string;
  change: string; // "Added 5 Chep Wood to Ziyard via Truck A"
  type: 'movement' | 'edit' | 'party' | 'config' | 'note';
  details?: {
    movementType?: 'sent' | 'received' | 'returned';
    partyName?: string;
    transporter?: string;
    binName?: string;
    quantity?: number;
  }
}

export interface BinStockData {
  statuses: {
    total: BinCounts;
    full: BinCounts;
    inFridge: BinCounts;
    broken: BinCounts;
    dump: BinCounts;
  };
  owedToUs: BinParty[];
  weOwe: BinParty[];
  notes: string;
  history: BinHistoryEntry[];
  binTypes: BinTypeDefinition[]; // Defines all columns
  customBinTypes: CustomBinType[]; // Defines sub-types for mixed breakdown
}