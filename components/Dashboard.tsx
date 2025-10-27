import React, { useState, useMemo, useRef, useEffect } from 'react';
import Header from './Header';
import SummaryCards from './SummaryCards';
import InventoryTable from './InventoryTable';
import HistoryPage from './HistoryPage';
import SettingsPage from './SettingsPage';
import BinStockPage from './BinStockPage';
import { INITIAL_BIN_TYPES, EMPTY_BIN_STOCK_DATA } from '../constants';
import { StockItem, EditableStockItemKey, ActivityLogEntry, Supplier, CreditTransaction, TeamMember, BinStockData, BinTypeName, BinParty, BinHistoryEntry, BinTypeDefinition, CustomBinType, BinCounts } from '../types';
import { X, Search, FileText, Download, Printer, Send, Loader, Sparkles, AlertTriangle, ShoppingBag, CreditCard, ChevronLeft, Truck as TruckIcon } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
// FIX: Import GoogleGenAI to use the Gemini API.
import { GoogleGenAI } from '@google/genai';


const COLOR_PALETTE = ['#10B981', '#3B82F6', '#F97316', '#EC4899', '#8B5CF6', '#F59E0B', '#6366F1', '#EF4444', '#14b8a6', '#06b6d4', '#0ea5e9', '#f43f5e', '#d946ef', '#84cc16', '#eab308', '#64748b'];

type AddItemData = {
  name: string;
  quantity: number | '';
  alertLevel: number | '';
  price: number | ''; // This will be unit price
  totalPrice: number | ''; // Added for confirmation
  color: string;
  transactionType: 'cash' | 'credit';
  supplierName?: string;
};

type View = 'dashboard' | 'binStock' | 'history' | 'settings';
type InventoryViewMode = 'table' | 'card';

// --- LEVENSHTEIN DISTANCE HELPER ---
const levenshteinDistance = (a: string, b: string): number => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const matrix = Array(bLower.length + 1).fill(null).map(() => Array(aLower.length + 1).fill(null));
    for (let i = 0; i <= aLower.length; i++) { matrix[0][i] = i; }
    for (let j = 0; j <= bLower.length; j++) { matrix[j][0] = j; }
    for (let j = 1; j <= bLower.length; j++) {
        for (let i = 1; i <= aLower.length; i++) {
            const indicator = aLower[i - 1] === bLower[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1, // deletion
                matrix[j - 1][i] + 1, // insertion
                matrix[j - 1][i - 1] + indicator, // substitution
            );
        }
    }
    return matrix[bLower.length][aLower.length];
};

// --- FIND SUPPLIER HELPER ---
const findSupplier = (name: string, suppliers: Supplier[]): Supplier | { suggestion: string } | null => {
    const lowerName = name.trim().toLowerCase();
    const directMatch = suppliers.find(s => s.name.toLowerCase() === lowerName);
    if (directMatch) return directMatch;

    const suggestions = suppliers
        .map(supplier => ({ supplier, dist: levenshteinDistance(lowerName, supplier.name) }))
        .sort((a, b) => a.dist - b.dist);

    if (suggestions.length > 0 && suggestions[0].dist <= 3) {
        return { suggestion: suggestions[0].supplier.name };
    }
    return null;
};

// --- DATE PARSING HELPER ---
const parseDateRange = (command: string): { start: Date; end: Date; title: string } | null => {
    const today = new Date();
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const parseAndReturn = (start: Date, end: Date, title: string) => {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end, title };
    };

    let match = command.match(/history for yesterday|report for yesterday/i);
    if (match) {
        const start = new Date(today);
        start.setDate(start.getDate() - 1);
        return parseAndReturn(start, start, 'Report for Yesterday');
    }

    match = command.match(/last month/i);
    if (match) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return parseAndReturn(start, end, 'Report for Last Month');
    }

    match = command.match(/last (\d+) days?/i);
    if (match) {
        const days = parseInt(match[1], 10);
        const start = new Date(today);
        start.setDate(start.getDate() - (days - 1));
        return parseAndReturn(start, endOfToday, `Report for Last ${days} Days`);
    }

    match = command.match(/from (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/i);
    if (match) {
        const start = new Date(match[1] + 'T00:00:00'); // Use T00:00:00 to avoid timezone issues
        const end = new Date(match[2] + 'T00:00:00');
        return parseAndReturn(start, end, `Report from ${match[1]} to ${match[2]}`);
    }

    return null;
};

interface DashboardProps {
    session: Session;
}

// FIX: Initialize the GoogleGenAI client.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- MAIN APP COMPONENT ---
const Dashboard: React.FC<DashboardProps> = ({ session }) => {
  const [team, setTeam] = useState<{ id: string; name: string; } | null>(null);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [binStockData, setBinStockData] = useState<BinStockData | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const fetchBinData = async (teamId: string) => {
    // 1. Fetch all raw data in parallel
    const [
        { data: binTypesData, error: binTypesError },
        { data: partiesData, error: partiesError },
        { data: balancesData, error: balancesError },
        { data: statusesData, error: statusesError },
        { data: historyData, error: historyError },
    ] = await Promise.all([
        supabase.from('bin_types').select('*').eq('team_id', teamId),
        supabase.from('bin_parties').select('*').eq('team_id', teamId),
        supabase.from('bin_balances').select('*').eq('team_id', teamId),
        supabase.from('bin_status_counts').select('*').eq('team_id', teamId),
        supabase.from('bin_history_log').select('*').eq('team_id', teamId).order('timestamp', { ascending: false }).limit(200),
    ]);

    const errors = { binTypesError, partiesError, balancesError, statusesError, historyError };
    for (const key in errors) {
        if (errors[key as keyof typeof errors]) {
            console.error(`Error fetching bin data (${key}):`, errors[key as keyof typeof errors]);
            setBinStockData(EMPTY_BIN_STOCK_DATA); // Set to empty to stop loading spinner on error
            return;
        }
    }

    // 3. Process and assemble data into the BinStockData structure
    const binTypes: BinTypeDefinition[] = binTypesData
        ?.filter(bt => bt.category === 'standard' || bt.category === 'mixed')
        .map(bt => ({ ...bt, id: bt.id, isDefault: bt.is_default })) ?? [];
    
    const customBinTypes: CustomBinType[] = binTypesData
        ?.filter(bt => bt.sub_category)
        .map(bt => ({ id: bt.id, name: bt.name, category: bt.sub_category as 'mixedWood' | 'mixedPlastic' })) ?? [];

    const statuses: BinStockData['statuses'] = { total: {}, full: {}, inFridge: {}, broken: {}, dump: {} };
    if (statusesData) {
        for (const status of statusesData) {
            const statusKey = status.status_name as keyof BinStockData['statuses'];
            if (statuses[statusKey]) {
                statuses[statusKey][status.bin_type_id] = status.quantity;
            }
        }
    }
    
    // Calculate totals for statuses
    binTypesData?.forEach(bt => {
        statuses.total[bt.id] = (statuses.full[bt.id] || 0) + (statuses.inFridge[bt.id] || 0) + (statuses.broken[bt.id] || 0) + (statuses.dump[bt.id] || 0);
    });

    const owedToUs: BinParty[] = [];
    const weOwe: BinParty[] = [];
    if (partiesData && balancesData) {
        for (const party of partiesData) {
            const partyBalances = balancesData.filter(b => b.party_id === party.id);
            const partyOwedBins: BinCounts = {};
            const partyWeOweBins: BinCounts = {};

            for (const balance of partyBalances) {
                if (balance.balance > 0) {
                    partyOwedBins[balance.bin_type_id] = balance.balance;
                } else if (balance.balance < 0) {
                    partyWeOweBins[balance.bin_type_id] = -balance.balance; // Store as positive number
                }
            }

            if (Object.keys(partyOwedBins).length > 0) {
                owedToUs.push({ id: party.id, name: party.name, bins: partyOwedBins });
            }
            if (Object.keys(partyWeOweBins).length > 0) {
                weOwe.push({ id: party.id, name: party.name, bins: partyWeOweBins });
            }
        }
    }

    const history: BinHistoryEntry[] = historyData ? historyData.map(h => ({
        id: h.id, timestamp: h.timestamp, change: h.change_description, type: h.type, details: h.details
    })) : [];

    const notes = history.find(h => h.type === 'note')?.change || "Add your notes here...";

    setBinStockData({ binTypes, customBinTypes, statuses, owedToUs, weOwe, history, notes });
  };


  useEffect(() => {
    const initialize = async () => {
        setIsDataLoading(true);

        const { data: teamMemberships, error: teamMemberError } = await supabase
            .from('team_members').select('teams(*)').eq('user_id', session.user.id);

        if (teamMemberError || !teamMemberships || teamMemberships.length === 0) {
            console.error("Could not fetch user's team:", teamMemberError?.message || "User not assigned to a team.");
            setIsDataLoading(false); return;
        }

        const firstTeamMembership = teamMemberships[0];
        if (!firstTeamMembership.teams) {
            console.error("Team data is malformed for the user's membership.");
            setIsDataLoading(false); return;
        }

        // `teams` can be returned as an array by Supabase; handle both shapes safely
        let currentTeam: { id: string; name: string } | null = null;
        if (Array.isArray(firstTeamMembership.teams)) {
            currentTeam = firstTeamMembership.teams[0] || null;
        } else {
            currentTeam = firstTeamMembership.teams || null;
        }
        if (!currentTeam || !currentTeam.id) {
            console.error("Team data is malformed for the user's membership.");
            setIsDataLoading(false); return;
        }
        setTeam(currentTeam);

        // Fetch all data in parallel
        const [stockResult, logResult, membersResult, suppliersResult, transactionsResult] = await Promise.all([
            supabase.from('stock_items').select('*').eq('team_id', currentTeam.id).order('name'),
            supabase.from('activity_log').select('*, users(full_name)').eq('team_id', currentTeam.id).order('timestamp', { ascending: false }),
            supabase.from('team_members').select('role, users(id, full_name, email)').eq('team_id', currentTeam.id),
            supabase.from('suppliers').select('*').eq('team_id', currentTeam.id).order('name'),
            supabase.from('credit_transactions').select('*').eq('team_id', currentTeam.id)
        ]);
        
        if (stockResult.data) setStockItems(stockResult.data);
        if(stockResult.error) console.error("Error fetching stock items: ", stockResult.error.message);
        
        if (logResult.data) setActivityLog(logResult.data as ActivityLogEntry[]);
        if(logResult.error) console.error("Error fetching activity log: ", logResult.error.message);

        if (membersResult.data) {
            const formattedMembers = membersResult.data.map((m: any) => ({
                id: m.users?.id, name: m.users?.full_name, email: m.users?.email, role: m.role,
            })).filter((m): m is TeamMember => m.id && m.name && m.email);
            setTeamMembers(formattedMembers);
        }
        if(membersResult.error) console.error("Error fetching team members: ", membersResult.error.message);

        if (suppliersResult.data) setSuppliers(suppliersResult.data);
        if(suppliersResult.error) console.error("Error fetching suppliers: ", suppliersResult.error.message);

        if (transactionsResult.data) setTransactions(transactionsResult.data);
        if(transactionsResult.error) console.error("Error fetching transactions: ", transactionsResult.error.message);

        // Fetch bin data
        await fetchBinData(currentTeam.id);
        
        setIsDataLoading(false);
    };

    initialize();
  }, [session.user.id]);


  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [inventoryViewMode, setInventoryViewMode] = useState<InventoryViewMode>('table');
  const [modal, setModal] = useState<'newDay' | 'commandInput' | 'report' | 'addItem' | 'suppliers' | 'editItem' | 'deleteItem' | 'confirmReset' | 'confirmBinReset' | 'confirmPriceChange' | 'confirmAction' | null>(null);
  const [itemToEdit, setItemToEdit] = useState<StockItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<StockItem | null>(null);
  const [editFormData, setEditFormData] = useState<{name: string, category: string, color: string} | null>(null);
  
  const [priceConfirmation, setPriceConfirmation] = useState<{ item: StockItem; newItemData: AddItemData } | null>(null);
  const [confirmationRequest, setConfirmationRequest] = useState<{ title: string; message: React.ReactNode; onConfirm: () => void; } | null>(null);

  useEffect(() => {
    if (modal === 'editItem' && itemToEdit) {
        setEditFormData({
            name: itemToEdit.name,
            category: itemToEdit.category || '',
            color: itemToEdit.color
        });
    } else {
        setEditFormData(null);
    }
  }, [modal, itemToEdit]);


  const [reportData, setReportData] = useState<{title: string, content: any} | null>(null);
  const [infoModalContent, setInfoModalContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isBinAILoading, setIsBinAILoading] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);


  // --- BUSINESS LOGIC & CALCULATIONS ---
  const handleStockUpdate = async (itemId: string, field: EditableStockItemKey, value: number) => {
    if (!team) return;
    const item = stockItems.find(i => i.id === itemId);
    if (!item) return;
    
    const oldValue = item[field];
    if (oldValue === value) return;

    const originalStockItems = stockItems;
    setStockItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );

    const { error } = await supabase.from('stock_items').update({ [field]: value }).eq('id', itemId);
    if (error) {
        console.error("Failed to update stock item:", error);
        setStockItems(originalStockItems); // Revert on failure
        return;
    }

    const fieldLabels: Record<EditableStockItemKey, string> = {
        opening_stock: 'Opening Stock',
        added_today: 'Added Today',
        packed: 'Packed',
        lost: 'Lost',
        alert_level: 'Alert Level',
        price: 'Price'
    };

    const changeDescription = `Set '${fieldLabels[field]}' to ${value}`;
    const newLogEntry = {
        team_id: team.id,
        user_id: session.user.id,
        item_name: item.name,
        change_description: changeDescription,
    };

    const { data, error: logError } = await supabase.from('activity_log').insert(newLogEntry).select('*, users(full_name)').single();
    if (logError) {
        console.error("Failed to create activity log:", logError);
    } else if(data) {
        setActivityLog(prev => [data as ActivityLogEntry, ...prev]);
    }
  };

  const handleNewDay = async () => {
    if (!team) return;
    setIsLoading(true);

    const updates = stockItems.map(item => {
      const remaining = item.opening_stock + item.added_today - item.packed - item.lost;
      return {
        id: item.id,
        opening_stock: remaining,
        added_today: 0,
        packed: 0,
        lost: 0
      };
    });

    const { error } = await supabase.from('stock_items').upsert(updates);
    if (error) {
        console.error("New Day Error:", error);
        setModal(null);
        setIsLoading(false);
        return;
    }

    setStockItems(prevItems =>
      prevItems.map(item => {
        const remaining = item.opening_stock + item.added_today - item.packed - item.lost;
        return {
          ...item,
          opening_stock: remaining,
          added_today: 0,
          packed: 0,
          lost: 0
        };
      })
    );

    const newLogEntry = {
        team_id: team.id,
        item_name: 'All Items',
        change_description: "'New Day' process initiated.",
        user_id: session.user.id
    };

    const { data: logData, error: logError } = await supabase.from('activity_log').insert(newLogEntry).select('*, users(full_name)').single();
    if (!logError && logData) {
        setActivityLog(prev => [logData as ActivityLogEntry, ...prev]);
    }
    
    setModal(null);
    setIsLoading(false);
  };
  
  const [newItemData, setNewItemData] = useState<AddItemData>({
    name: '',
    quantity: '',
    alertLevel: 100,
    price: '',
    totalPrice: '',
    color: COLOR_PALETTE[0],
    transactionType: 'cash',
    supplierName: ''
  });
  const [lastPriceFieldEdited, setLastPriceFieldEdited] = useState<'unit' | 'total'>('unit');

  const handlePriceAndQuantityChange = (
    updates: Partial<AddItemData>,
    source: 'unit' | 'total' | 'quantity'
  ) => {
    // If the source of change is one of the price fields, update our tracker
    if (source === 'unit' || source === 'total') {
      setLastPriceFieldEdited(source);
    }
  
    setNewItemData(prev => {
      const newState = { ...prev, ...updates };
      const quantity = Number(newState.quantity);
      // Use the source if it's a price field, otherwise use the last tracked field
      const lastEdited = source === 'unit' || source === 'total' ? source : lastPriceFieldEdited;
  
      if (lastEdited === 'unit') {
        const unitPrice = Number(newState.price);
        if (quantity > 0 && unitPrice >= 0) {
          newState.totalPrice = parseFloat((quantity * unitPrice).toFixed(2));
        } else {
          newState.totalPrice = (quantity === 0 || unitPrice === 0) ? 0 : '';
        }
      } else { // lastEdited is 'total'
        const totalPrice = Number(newState.totalPrice);
        if (quantity > 0 && totalPrice >= 0) {
          newState.price = parseFloat((totalPrice / quantity).toFixed(4));
        } else {
          newState.price = (quantity === 0 || totalPrice === 0) ? 0 : '';
        }
      }
      return newState;
    });
  };

  const resetAddItemForm = () => {
    setNewItemData({
      name: '', quantity: '', alertLevel: 100, price: '', totalPrice: '', color: COLOR_PALETTE[0], transactionType: 'cash', supplierName: ''
    });
    setLastPriceFieldEdited('unit');
  };

  const handleAddItem = async (confirmedItemData: AddItemData, updateExistingPrice = false) => {
    if (!team) return;
    setIsLoading(true);
    setModal(null);
    setPriceConfirmation(null);
    
    const { name, quantity, alertLevel, price, transactionType, supplierName, color } = confirmedItemData;
    const numQuantity = typeof quantity === 'number' ? quantity : 0;
    const numPrice = typeof price === 'number' ? price : 0;
    const numAlertLevel = typeof alertLevel === 'number' ? alertLevel : 0;

    const existingItem = stockItems.find(i => i.name.toLowerCase() === name.toLowerCase());

    if (existingItem) {
      if (Math.abs(existingItem.price - numPrice) > 0.001 && !updateExistingPrice) {
          setPriceConfirmation({ item: existingItem, newItemData: confirmedItemData });
          setModal('confirmPriceChange');
          setIsLoading(false);
          return;
      }

      const updatedFields: Partial<StockItem> = {
          added_today: existingItem.added_today + numQuantity,
      };
      if (updateExistingPrice) {
          updatedFields.price = numPrice;
      }
      
      const { data, error } = await supabase.from('stock_items').update(updatedFields).eq('id', existingItem.id).select().single();
      if (error) {
          console.error("Error updating stock item:", error);
          setIsLoading(false); return;
      }
      setStockItems(prev => prev.map(item => item.id === existingItem.id ? data : item));
    } else {
        const { data, error } = await supabase.from('stock_items').insert({
            name, added_today: numQuantity, alert_level: numAlertLevel, price: numPrice, color, team_id: team.id, opening_stock: 0, packed: 0, lost: 0
        }).select().single();

        if (error) {
            console.error("Error creating stock item:", error);
            setIsLoading(false); return;
        }
        setStockItems(prev => [...prev, data]);
    }
    
    // Handle supplier and transaction logic
    let supplierId: string | undefined;
    if (transactionType === 'credit' && supplierName) {
        let supplier = suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
        if (!supplier) {
            const { data, error } = await supabase.from('suppliers').insert({ name: supplierName, team_id: team.id, balance: 0 }).select().single();
            if (error) console.error("Error creating new supplier:", error);
            else {
                supplier = data;
                setSuppliers(prev => [...prev, data]);
            }
        }
        supplierId = supplier?.id;
    }
    
    const totalValue = numQuantity * numPrice;
    if (transactionType === 'credit' && supplierId) {
        const { data: transaction, error: transError } = await supabase.from('credit_transactions').insert({
            supplier_id: supplierId, team_id: team.id, stock_item_name: name, quantity: numQuantity, total_value: totalValue
        }).select().single();

        if (transError) console.error("Error creating credit transaction:", transError);
        else {
            setTransactions(prev => [...prev, transaction]);
            const supplierToUpdate = suppliers.find(s => s.id === supplierId);
            if (supplierToUpdate) {
                const newBalance = supplierToUpdate.balance + totalValue;
                const { error: supError } = await supabase.from('suppliers').update({ balance: newBalance }).eq('id', supplierId);
                if (!supError) setSuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, balance: newBalance } : s));
            }
        }
    }

    const logChange = `Added ${numQuantity} units of '${name}'${transactionType === 'credit' && supplierName ? ` via credit from ${supplierName}` : ' via cash'}.`;
    const { data: logData, error: logError } = await supabase.from('activity_log').insert({
        team_id: team.id, item_name: name, change_description: logChange, user_id: session.user.id
    }).select('*, users(full_name)').single();

    if (!logError && logData) setActivityLog(prev => [logData as ActivityLogEntry, ...prev]);

    resetAddItemForm();
    setIsLoading(false);
  };
  
    const handleEditItem = async (itemId: string, updates: { name: string, category: string, color: string }) => {
        if (!team) return;
        const itemToUpdate = stockItems.find(item => item.id === itemId);
        if (!itemToUpdate) return;
        
        setIsLoading(true);
        setModal(null);
        
        const { data: updatedItem, error } = await supabase
            .from('stock_items')
            .update({ name: updates.name, category: updates.category, color: updates.color })
            .eq('id', itemId)
            .select()
            .single();
        
        if (error) {
            console.error("Error updating item details:", error);
        } else {
            setStockItems(prev => prev.map(item => item.id === itemId ? updatedItem : item));
            
            const changes: string[] = [];
            if (updates.name !== itemToUpdate.name) changes.push(`renamed to '${updates.name}'`);
            if (updates.category !== itemToUpdate.category) changes.push(`changed category to '${updates.category}'`);
            if (updates.color !== itemToUpdate.color) changes.push(`changed color`);

            if (changes.length > 0) {
              const { data: logData, error: logError } = await supabase.from('activity_log').insert({
                  team_id: team.id,
                  item_name: itemToUpdate.name,
                  change_description: `Item details updated: ${changes.join(', ')}.`,
                  user_id: session.user.id
              }).select('*, users(full_name)').single();
              if (!logError && logData) {
                setActivityLog(prev => [logData as ActivityLogEntry, ...prev]);
              }
            }
        }
        setIsLoading(false);
    };

    const handleDeleteItem = async (itemId: string) => {
        if (!team) return;
        const itemToDelete = stockItems.find(item => item.id === itemId);
        if (!itemToDelete) return;

        setIsLoading(true);
        setModal(null);

        const { error } = await supabase.from('stock_items').delete().eq('id', itemId);

        if (error) {
            console.error("Error deleting item:", error);
        } else {
            setStockItems(prev => prev.filter(item => item.id !== itemId));
            const { data: logData, error: logError } = await supabase.from('activity_log').insert({
                team_id: team.id,
                item_name: itemToDelete.name,
                change_description: `Item permanently deleted.`,
                user_id: session.user.id
            }).select('*, users(full_name)').single();
             if (!logError && logData) {
              setActivityLog(prev => [logData as ActivityLogEntry, ...prev]);
            }
        }
        setIsLoading(false);
    };
    
    const handleResetData = async (resetType: 'all' | 'bins') => {
        if (!team) return;
        setIsLoading(true);
        setModal(null);

        if (resetType === 'all') {
            await supabase.from('stock_items').delete().eq('team_id', team.id);
            await supabase.from('activity_log').delete().eq('team_id', team.id);
            await supabase.from('suppliers').delete().eq('team_id', team.id);
            await supabase.from('credit_transactions').delete().eq('team_id', team.id);
            setStockItems([]);
            setActivityLog([]);
            setSuppliers([]);
            setTransactions([]);
        } else if (resetType === 'bins') {
            await supabase.from('bin_balances').delete().eq('team_id', team.id);
            await supabase.from('bin_status_counts').delete().eq('team_id', team.id);
            await supabase.from('bin_history_log').delete().eq('team_id', team.id);
            await supabase.from('bin_parties').delete().eq('team_id', team.id);
            // Re-fetch to clear the state
            if (team) await fetchBinData(team.id);
        }

        setIsLoading(false);
    };
  
    // --- TEAM MANAGEMENT HANDLERS ---
    const handleUpdateTeamName = async (newName: string) => {
        if (!team || team.name === newName) return;
        const { error } = await supabase.from('teams').update({ name: newName }).eq('id', team.id);
        if (error) console.error("Error updating team name:", error);
        else setTeam(prev => prev ? { ...prev, name: newName } : null);
    };
    
    const handleAddTeamMember = (email: string) => { /* Logic for sending invites */ };
    const handleRemoveTeamMember = (memberId: string) => { /* Logic for removing members */ };
    const handleUpdateMemberRole = (memberId: string, newRole: 'Manager' | 'Worker') => { /* Logic for updating roles */ };
  
    // --- BIN STOCK HANDLERS ---
    const handleAddBinType = async (details: { name: string; color: string; category: 'standard' | 'mixed'; sub_category?: 'mixedWood' | 'mixedPlastic' }) => {
        if (!team) return;
        const { data, error } = await supabase.from('bin_types').insert({ ...details, team_id: team.id }).select().single();
        if (error) { console.error("Error adding bin type:", error); }
    else { if (team) await fetchBinData(team.id); }
    };
    const handleRemoveBinType = async (binId: string) => {
        if (!team) return;
        const { error } = await supabase.from('bin_types').delete().eq('id', binId);
        if (error) { console.error("Error removing bin type:", error); }
    else { if (team) await fetchBinData(team.id); }
    };
    const handleUpdateBinColor = async (binId: string, color: string) => {
        if (!team) return;
        const { error } = await supabase.from('bin_types').update({ color }).eq('id', binId);
        if (error) { console.error("Error updating bin color:", error); }
    else { if (team) await fetchBinData(team.id); }
    };
    const handleAddParty = async (partyName: string) => {
        if (!team) return;
        const { error } = await supabase.from('bin_parties').insert({ name: partyName, team_id: team.id });
        if (error) { console.error("Error adding party:", error); }
    else { if (team) await fetchBinData(team.id); }
    };
    const handleRemoveParty = async (partyId: string, partyName: string) => {
        setConfirmationRequest({
            title: `Remove ${partyName}?`,
            message: `Are you sure you want to remove this party? All their bin balances will be cleared. This action cannot be undone.`,
            onConfirm: async () => {
                const { error } = await supabase.from('bin_parties').delete().eq('id', partyId);
                if (error) console.error("Error removing party:", error);
                else if (team) await fetchBinData(team.id);
                setConfirmationRequest(null);
            }
        });
    };
    const handleUpdateNotes = async (notes: string) => {
        if (!team || !binStockData) return;
        const existingNote = binStockData.history.find(h => h.type === 'note');
        if (existingNote) {
            const { error } = await supabase.from('bin_history_log').update({ change_description: notes }).eq('id', existingNote.id);
            if (error) console.error("Error updating notes:", error);
            else setBinStockData(prev => prev ? { ...prev, notes } : null);
        } else {
            const { error } = await supabase.from('bin_history_log').insert({ type: 'note', change_description: notes, team_id: team.id });
            if (error) console.error("Error saving notes:", error);
            else if (team) await fetchBinData(team.id);
        }
    };

    const handleUpdateStatusCount = async (statusKey: keyof BinStockData['statuses'], binId: string, newValue: number) => {
        if (!team) return;
        const { error } = await supabase.from('bin_status_counts').upsert({ team_id: team.id, status_name: statusKey, bin_type_id: binId, quantity: newValue });
        if(error) console.error(`Error updating ${statusKey}:`, error);
    else if (team) await fetchBinData(team.id);
    };

    const handleDirectEdit = async (details: { partyId: string, binId: string, newValue: number }) => {
        if (!team) return;
        const { partyId, binId, newValue } = details;
        const party = [...(binStockData?.owedToUs || []), ...(binStockData?.weOwe || [])].find(p => p.id === partyId);
        const bin = binStockData?.binTypes.find(b => b.id === binId);
        if(!party || !bin) return;

        const oldValue = party.bins[binId] || 0;
        const weOweParty = binStockData?.weOwe.some(p => p.id === partyId);
        const finalValue = weOweParty ? -newValue : newValue; // Store as negative if we owe them

        const { error: upsertError } = await supabase.from('bin_balances').upsert({ team_id: team.id, party_id: partyId, bin_type_id: binId, balance: finalValue });
        if (upsertError) { console.error("Direct edit upsert error:", upsertError); return; }

        const { error: logError } = await supabase.from('bin_history_log').insert({
            team_id: team.id,
            type: 'edit',
            change_description: `Manually changed ${bin.name} for ${party.name} from ${oldValue} to ${newValue}.`,
        });
        if (logError) console.error("Direct edit log error:", logError);

    if (team) await fetchBinData(team.id);
    };

    const handleBinMovement = async (details: { type: 'sent' | 'received' | 'returned', quantity: number, binId: string, partyName: string, transporter?: string, binContents?: string }) => {
       if (!team || !binStockData) return;
       setIsLoading(true);
       
       const { type, quantity, binId, partyName, transporter, binContents } = details;
       let party = [...binStockData.owedToUs, ...binStockData.weOwe].find(p => p.name.toLowerCase() === partyName.toLowerCase());

       // Create party if it doesn't exist
       if (!party) {
           const { data: newParty, error: newPartyError } = await supabase.from('bin_parties').insert({ name: partyName, team_id: team.id }).select().single();
           if(newPartyError || !newParty) { console.error("Error creating new party:", newPartyError); setIsLoading(false); return; }
           party = { id: newParty.id, name: newParty.name, bins: {} };
       }

       const { data: currentBalanceData, error: balanceError } = await supabase.from('bin_balances')
           .select('balance').eq('team_id', team.id).eq('party_id', party.id).eq('bin_type_id', binId).single();

       if (balanceError && balanceError.code !== 'PGRST116') { // Ignore "No rows found" error
           console.error("Error fetching balance:", balanceError); setIsLoading(false); return;
       }

       const currentBalance = currentBalanceData?.balance || 0;
       let newBalance = currentBalance;
       if(type === 'sent') newBalance += quantity;
       else if(type === 'received') newBalance -= quantity;
       // 'returned' means they are returning our bins, so our balance with them decreases
       else if(type === 'returned') newBalance -= quantity;
       
       const { error: upsertError } = await supabase.from('bin_balances').upsert({ team_id: team.id, party_id: party.id, bin_type_id: binId, balance: newBalance });
       if (upsertError) { console.error("Error upserting balance:", upsertError); setIsLoading(false); return; }

       const binName = binStockData.binTypes.find(b => b.id === binId)?.name || 'Unknown Bin';
       const change_description = `${type.charAt(0).toUpperCase() + type.slice(1)} ${quantity} ${binName}${binContents ? ` (${binContents})` : ''} ${type === 'sent' ? 'to' : 'from'} ${partyName}${transporter ? ` via ${transporter}`: ''}.`;
       
       const { error: logError } = await supabase.from('bin_history_log').insert({
           team_id: team.id,
           type: 'movement',
           change_description,
           details: { movementType: type, quantity, binName, partyName, transporter, binContents }
       });
       if(logError) console.error("Error logging movement:", logError);

    if (team) await fetchBinData(team.id);
       setIsLoading(false);
    };

  
  // --- AI COMMAND HANDLING ---
  const handleAICommand = async (command: string) => {
     // Check for report generation first
    const dateRange = parseDateRange(command);
    if (dateRange) {
        generateReport(dateRange.start, dateRange.end, dateRange.title);
        return;
    }
    
    setIsLoading(true);
    try {
        // FIX: Use the initialized 'ai' client instead of 'window.ai'.
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `The user provided the following command for their inventory management app: "${command}". 
            Based on this command, determine the action and parameters.
            
            Available actions are:
            1. 'ADD': For adding new stock. Requires 'name', 'quantity', 'price' (unit price). Optional: 'supplier' if it's a credit transaction.
            2. 'UPDATE': For changing existing stock. Requires 'name', and one or more of 'packed', 'lost', 'added'.
            3. 'QUERY': For asking a question about the inventory. The response should be a natural language answer.
            4. 'UNKNOWN': If the command is unclear.
            
            For ADD/UPDATE actions, the 'name' must be an exact match from the provided stock list if possible. If it's a new item, use the name provided.
            For QUERY, just answer the question based on the provided data context.

            Here is the current inventory data:
            ${JSON.stringify(stockItems.map(({id, team_id, ...rest}) => rest), null, 2)}
            
            Here are the current suppliers:
            ${JSON.stringify(suppliers.map(s => s.name), null, 2)}
            
            Respond ONLY with a single JSON object in the following format:
            { "action": "ADD|UPDATE|QUERY|UNKNOWN", "parameters": { ... }, "reasoning": "A brief explanation of why you chose this action.", "answer": "A natural language answer if the action is QUERY." }
            
            Example for 'add 100 1.5kg boxes for 250 from deons on credit':
            { "action": "ADD", "parameters": { "name": "1.5kg Narjie boxes", "quantity": 100, "price": 2.50, "supplier": "Deons" }, "reasoning": "Identified 'add' keyword, quantity, total price (250/100=2.50), supplier, and matched '1.5kg boxes' to the closest item name." }
            
            Example for 'we packed 50 of the 1.8kg boxes and lost 5':
            { "action": "UPDATE", "parameters": { "name": "1.8kg Boxes", "packed": 50, "lost": 5 }, "reasoning": "Identified 'packed' and 'lost' keywords and matched the item name." }
            
            Example for 'what is the total value of groenkloof stock?':
            { "action": "QUERY", "parameters": {}, "reasoning": "User is asking a question.", "answer": "The total stock value for items in the 'Groenkloof' category is R28,800.00." }
            `
        });
        
        const jsonString = (response.text ?? '').trim();
        if (!jsonString) {
            console.error('Empty AI assistant response');
            return;
        }
        let result: any = null;
        try {
            result = JSON.parse(jsonString);
        } catch (err) {
            console.error('Failed to parse AI assistant response:', err, jsonString);
            return;
        }

        switch (result.action) {
            case 'ADD':
                const { name, quantity, price, supplier } = result.parameters;
                const addData: AddItemData = {
                    name,
                    quantity: Number(quantity),
                    price: Number(price),
                    totalPrice: Number(quantity) * Number(price),
                    alertLevel: 100,
                    color: COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)],
                    transactionType: supplier ? 'credit' : 'cash',
                    supplierName: supplier,
                };
                
                let actualSupplierName = addData.supplierName;
                if (addData.supplierName) {
                    const supplierMatch = findSupplier(addData.supplierName, suppliers);
                    if (supplierMatch && 'suggestion' in supplierMatch) {
                        setConfirmationRequest({
                            title: 'Confirm Supplier',
                            message: `Did you mean the supplier "${supplierMatch.suggestion}"?`,
                            onConfirm: () => {
                                handleAddItem({ ...addData, supplierName: supplierMatch.suggestion });
                                setConfirmationRequest(null);
                            }
                        });
                        setIsLoading(false);
                        return; // Wait for user confirmation
                    } else if (!supplierMatch) {
                        // It's a new supplier, proceed as normal
                    }
                }
                
                handleAddItem(addData);
                break;
            case 'UPDATE':
                const { name: updateName, ...updates } = result.parameters;
                const itemToUpdate = stockItems.find(i => i.name.toLowerCase() === updateName.toLowerCase());
                if (itemToUpdate) {
                    for (const key in updates) {
                        const field = key as EditableStockItemKey;
                        const value = Number(updates[key]);
                        // Add to existing value instead of overwriting
                        const newValue = itemToUpdate[field] + value;
                        await handleStockUpdate(itemToUpdate.id, field, newValue);
                    }
                }
                break;
            case 'QUERY':
                setInfoModalContent(result.answer);
                break;
            default:
                setInfoModalContent("Sorry, I couldn't understand that command. Please try rephrasing.");
                break;
        }

    } catch (error) {
        console.error("AI Command Error:", error);
        setInfoModalContent("There was an error processing your command. Please try again.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleBinAICommand = async (command: string) => {
    // Similar to handleAICommand, but for bin actions
    // Simplified for this example
    const movementMatch = command.match(/(send|receive|return) (\d+) (.+?) (to|from) (.+)/i);
    if (movementMatch && binStockData) {
        const [, type, quantity, binName, , partyName] = movementMatch;
        const bin = binStockData.binTypes.find(b => b.name.toLowerCase() === binName.trim().toLowerCase());
        if (bin) {
            const details = {
                type: type.toLowerCase() as 'sent' | 'received' | 'returned',
                quantity: parseInt(quantity, 10),
                binId: bin.id,
                partyName: partyName.trim(),
            };
            handleBinMovement(details);
        } else {
             setInfoModalContent(`Could not find a bin type named "${binName.trim()}".`);
        }
    } else {
        setInfoModalContent("Sorry, I could only understand bin movements like 'send 10 chep plastic to Ziyard'.");
    }
  };

  // --- REPORTING ---
  const generateReport = (startDate: Date, endDate: Date, title: string) => {
    const relevantLogs = activityLog.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= startDate && logDate <= endDate;
    });

    const reportContent = {
        dateRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        summary: {
            totalItemsAdded: 0,
            totalItemsPacked: 0,
            totalItemsLost: 0,
            mostActiveItem: '',
            topUser: ''
        },
        detailedLog: relevantLogs,
    };
    
    const activityCounts: Record<string, number> = {};
    const userCounts: Record<string, number> = {};
    
    relevantLogs.forEach(log => {
        if(log.change_description.includes('Added')) {
            const quantity = parseInt(log.change_description.split(' ')[1], 10) || 0;
            reportContent.summary.totalItemsAdded += quantity;
        } else if(log.change_description.includes('Packed')) {
             const quantity = parseInt(log.change_description.split(' ').pop() || '0', 10);
             reportContent.summary.totalItemsPacked += quantity;
        } else if(log.change_description.includes('Lost')) {
             const quantity = parseInt(log.change_description.split(' ').pop() || '0', 10);
             reportContent.summary.totalItemsLost += quantity;
        }
        
        activityCounts[log.item_name] = (activityCounts[log.item_name] || 0) + 1;
        if(log.users?.full_name) {
            userCounts[log.users.full_name] = (userCounts[log.users.full_name] || 0) + 1;
        }
    });

    reportContent.summary.mostActiveItem = Object.keys(activityCounts).reduce((a, b) => activityCounts[a] > activityCounts[b] ? a : b, '');
    reportContent.summary.topUser = Object.keys(userCounts).reduce((a, b) => userCounts[a] > userCounts[b] ? a : b, '');

    setReportData({ title, content: reportContent });
    setModal('report');
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && reportData) {
        const reportHtml = `
            <html><head><title>${reportData.title}</title>
            <style>body{font-family:sans-serif;padding:20px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:8px;text-align:left} th{background-color:#f2f2f2}</style>
            </head><body>
            <h1>${reportData.title}</h1>
            <p><strong>Date Range:</strong> ${reportData.content.dateRange}</p>
            <h2>Summary</h2>
            <ul>
                <li>Total Items Added: ${reportData.content.summary.totalItemsAdded}</li>
                <li>Total Items Packed: ${reportData.content.summary.totalItemsPacked}</li>
                <li>Total Items Lost: ${reportData.content.summary.totalItemsLost}</li>
                <li>Most Active Item: ${reportData.content.summary.mostActiveItem}</li>
                <li>Top Contributor: ${reportData.content.summary.topUser}</li>
            </ul>
            <h2>Detailed Log</h2>
            <table><thead><tr><th>Timestamp</th><th>User</th><th>Item</th><th>Action</th></tr></thead><tbody>
            ${reportData.content.detailedLog.map((log: ActivityLogEntry) => `
                <tr>
                    <td>${new Date(log.timestamp).toLocaleString()}</td>
                    <td>${log.users?.full_name || 'System'}</td>
                    <td>${log.item_name}</td>
                    <td>${log.change_description}</td>
                </tr>
            `).join('')}
            </tbody></table>
            </body></html>`;
        printWindow.document.write(reportHtml);
        printWindow.document.close();
        printWindow.print();
    }
  };


  // --- DERIVED STATE & MEMOS ---
  const enhancedStockData = useMemo(() => {
    return stockItems.map(item => {
      const used = item.packed + item.lost;
      const remaining = item.opening_stock + item.added_today - used;
      const stockValue = remaining * item.price;
      return { ...item, used, remaining, stockValue };
    });
  }, [stockItems]);

  const summaryStats = useMemo(() => {
    return {
      totalRemaining: enhancedStockData.reduce((sum, item) => sum + item.remaining, 0),
      totalStockValue: enhancedStockData.reduce((sum, item) => sum + item.stockValue, 0),
      lowStockCount: enhancedStockData.filter(item => item.remaining <= item.alert_level).length,
      totalItems: stockItems.length,
    };
  }, [enhancedStockData, stockItems.length]);


  // --- RENDER ---
  if (isDataLoading || !team || !binStockData) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary">
        <Loader className="w-10 h-10 text-accent-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-text-primary p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* Modals */}
        {modal === 'newDay' && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-bg-secondary rounded-lg shadow-2xl w-full max-w-md border border-border-primary animate-fade-in">
                <div className="p-6 text-center">
                    <AlertTriangle className="w-16 h-16 text-warning mx-auto mb-4"/>
                    <h3 className="text-xl font-bold text-white">Confirm New Day</h3>
                    <p className="text-text-secondary mt-2">This will move all 'Remaining' stock to 'Opening Stock' and reset 'Added', 'Packed', and 'Lost' to zero for all items. This action cannot be undone.</p>
                </div>
                <div className="bg-bg-primary px-6 py-4 flex justify-end gap-3 rounded-b-lg">
                    <button onClick={() => setModal(null)} className="px-4 py-2 rounded-md bg-border-primary hover:bg-gray-700 text-white font-semibold">Cancel</button>
                    <button onClick={handleNewDay} className="px-4 py-2 rounded-md bg-accent-primary hover:bg-purple-700 text-white font-semibold">Proceed</button>
                </div>
            </div>
            </div>
        )}

        {modal === 'commandInput' && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start justify-center z-50 p-4 pt-20" onClick={() => setModal(null)}>
            <div className="bg-bg-secondary rounded-lg shadow-2xl w-full max-w-xl border border-border-primary animate-fade-in" onClick={e => e.stopPropagation()}>
                <div className="p-4"><h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles size={20} className="text-accent-secondary"/> AI Quick Input</h3></div>
                <div className="p-4 border-t border-border-primary">
                  <form onSubmit={(e) => { e.preventDefault(); const cmd = (e.target as any).elements.command.value; handleAICommand(cmd); (e.target as any).elements.command.value = ''; }}>
                      <div className="relative">
                          <input name="command" autoFocus type="text" placeholder="e.g., add 500 1.8kg boxes for R4500 from Groenkloof on credit" className="w-full bg-bg-primary border border-border-primary rounded-md pl-4 pr-12 py-3 text-white placeholder-text-secondary focus:ring-2 focus:ring-accent-primary outline-none"/>
                          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-accent-primary hover:bg-purple-700 rounded-md text-white" disabled={isLoading}>{isLoading ? <Loader size={20} className="animate-spin" /> : <Send size={20} />}</button>
                      </div>
                  </form>
                  <p className="text-xs text-text-secondary mt-2">Use natural language to add or update stock items. Try things like "we packed 100 7kg boxes and lost 5" or "add 2000 9kg inners".</p>
                </div>
            </div>
          </div>
        )}

        {infoModalContent && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setInfoModalContent(null)}>
            <div className="bg-bg-secondary rounded-lg shadow-2xl w-full max-w-md border border-border-primary animate-fade-in">
                <div className="p-6 text-center">
                    <Sparkles className="w-12 h-12 text-accent-secondary mx-auto mb-4"/>
                    <h3 className="text-xl font-bold text-white">AI Assistant Response</h3>
                    <p className="text-text-primary mt-2 whitespace-pre-wrap">{infoModalContent}</p>
                </div>
                <div className="bg-bg-primary px-6 py-4 flex justify-end gap-3 rounded-b-lg">
                    <button onClick={() => setInfoModalContent(null)} className="px-4 py-2 rounded-md bg-accent-primary hover:bg-purple-700 text-white font-semibold">Got it</button>
                </div>
            </div>
            </div>
        )}
        
        {modal === 'addItem' && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => { setModal(null); resetAddItemForm(); }}>
            <div className="bg-bg-secondary rounded-lg shadow-2xl w-full max-w-lg border border-border-primary animate-fade-in" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-border-primary">
                <h3 className="text-lg font-bold text-white">Add New Stock Item</h3>
                <button onClick={() => { setModal(null); resetAddItemForm(); }} className="text-text-secondary hover:text-white"><X size={20}/></button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleAddItem(newItemData); }} className="p-6 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-text-secondary block mb-1">Item Name</label>
                    <input type="text" placeholder="e.g., 1.5kg Narjie boxes" required value={newItemData.name} onChange={(e) => setNewItemData(prev => ({...prev, name: e.target.value}))} className="w-full bg-bg-primary border border-border-primary rounded-md p-2 text-white focus:ring-2 focus:ring-accent-primary outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-text-secondary block mb-1">Quantity</label>
                      <input type="number" step="1" min="0" placeholder="e.g., 1000" required value={newItemData.quantity} onChange={(e) => handlePriceAndQuantityChange({ quantity: e.target.value === '' ? '' : parseInt(e.target.value, 10) }, 'quantity')} className="w-full bg-bg-primary border border-border-primary rounded-md p-2 text-white focus:ring-2 focus:ring-accent-primary outline-none" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-text-secondary block mb-1">Alert Level</label>
                      <input type="number" step="1" min="0" placeholder="e.g., 100" required value={newItemData.alertLevel} onChange={(e) => setNewItemData(prev => ({ ...prev, alertLevel: e.target.value === '' ? '' : parseInt(e.target.value) }))} className="w-full bg-bg-primary border border-border-primary rounded-md p-2 text-white focus:ring-2 focus:ring-accent-primary outline-none"/>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-text-secondary block mb-1">Unit Price (R)</label>
                        <input type="number" step="any" min="0" placeholder="0.00" value={newItemData.price} onChange={(e) => handlePriceAndQuantityChange({ price: e.target.value === '' ? '' : parseFloat(e.target.value) }, 'unit')} className="w-full bg-bg-primary border border-border-primary rounded-md p-2 text-white focus:ring-2 focus:ring-accent-primary outline-none" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-text-secondary block mb-1">Total Price (R)</label>
                        <input type="number" step="any" min="0" placeholder="0.00" value={newItemData.totalPrice} onChange={(e) => handlePriceAndQuantityChange({ totalPrice: e.target.value === '' ? '' : parseFloat(e.target.value) }, 'total')} className="w-full bg-bg-primary border border-border-primary rounded-md p-2 text-white focus:ring-2 focus:ring-accent-primary outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-text-secondary block mb-1">Transaction Type</label>
                    <div className="flex items-center gap-2 rounded-md bg-bg-primary p-1 border border-border-primary">
                        <button type="button" onClick={() => setNewItemData(p => ({...p, transactionType: 'cash'}))} className={`flex-1 text-center p-1.5 rounded-md text-sm font-semibold flex items-center justify-center gap-2 ${newItemData.transactionType === 'cash' ? 'bg-accent-primary text-white' : 'text-text-secondary hover:bg-bg-secondary'}`}><ShoppingBag size={16}/> Cash</button>
                        <button type="button" onClick={() => setNewItemData(p => ({...p, transactionType: 'credit'}))} className={`flex-1 text-center p-1.5 rounded-md text-sm font-semibold flex items-center justify-center gap-2 ${newItemData.transactionType === 'credit' ? 'bg-accent-primary text-white' : 'text-text-secondary hover:bg-bg-secondary'}`}><CreditCard size={16}/> Credit</button>
                    </div>
                  </div>
                  {newItemData.transactionType === 'credit' && (
                    <div className="animate-fade-in">
                      <label className="text-sm font-medium text-text-secondary block mb-1">Supplier</label>
                      <input type="text" list="suppliers-list" placeholder="Select or type to add supplier..." required={newItemData.transactionType === 'credit'} value={newItemData.supplierName} onChange={(e) => setNewItemData(prev => ({...prev, supplierName: e.target.value}))} className="w-full bg-bg-primary border border-border-primary rounded-md p-2 text-white focus:ring-2 focus:ring-accent-primary outline-none" />
                      <datalist id="suppliers-list">
                          {suppliers.map(s => <option key={s.id} value={s.name} />)}
                      </datalist>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-text-secondary block mb-1">Color Tag</label>
                    <div className="flex flex-wrap gap-2">{COLOR_PALETTE.map(color => (<button key={color} type="button" onClick={() => setNewItemData(p => ({...p, color}))} className={`w-8 h-8 rounded-full border-2 ${newItemData.color === color ? 'border-white ring-2 ring-offset-2 ring-offset-bg-secondary ring-white' : 'border-transparent'} transition-all`} style={{ backgroundColor: color }} />))}</div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button type="submit" disabled={isLoading} className="px-4 py-2 rounded-md bg-success hover:bg-green-700 text-white font-semibold disabled:bg-border-primary disabled:cursor-not-allowed flex items-center justify-center">{isLoading ? <Loader size={20} className="animate-spin"/> : 'Confirm & Add Item'}</button>
                  </div>
              </form>
            </div>
          </div>
        )}
        
        {modal === 'confirmPriceChange' && priceConfirmation && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-bg-secondary rounded-lg shadow-2xl w-full max-w-md border border-border-primary animate-fade-in">
                <div className="p-6 text-center">
                    <AlertTriangle className="w-16 h-16 text-warning mx-auto mb-4"/>
                    <h3 className="text-xl font-bold text-white">Price Mismatch</h3>
                    <p className="text-text-secondary mt-2">
                        The price for '{priceConfirmation.item.name}' is R{priceConfirmation.item.price.toFixed(2)}. You entered a new price of R{(priceConfirmation.newItemData.price as number).toFixed(2)}.
                    </p>
                    <p className="text-text-secondary mt-2 font-semibold">Do you want to update the item's average price to the new value?</p>
                </div>
                <div className="bg-bg-primary px-6 py-4 flex flex-col sm:flex-row justify-end gap-3 rounded-b-lg">
                    <button onClick={() => handleAddItem(priceConfirmation.newItemData, false)} className="px-4 py-2 rounded-md bg-border-primary hover:bg-gray-700 text-white font-semibold">No, Keep Old Price (R{priceConfirmation.item.price.toFixed(2)})</button>
                    <button onClick={() => handleAddItem(priceConfirmation.newItemData, true)} className="px-4 py-2 rounded-md bg-warning hover:bg-amber-600 text-black font-semibold">Yes, Update to New Price</button>
                </div>
            </div>
            </div>
        )}
        
        {confirmationRequest && (
             <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setConfirmationRequest(null)}>
             <div className="bg-bg-secondary rounded-lg shadow-2xl w-full max-w-md border border-border-primary animate-fade-in" onClick={e => e.stopPropagation()}>
                 <div className="p-6">
                     <h3 className="text-xl font-bold text-white">{confirmationRequest.title}</h3>
                     <div className="text-text-secondary mt-2">{confirmationRequest.message}</div>
                 </div>
                 <div className="bg-bg-primary px-6 py-4 flex justify-end gap-3 rounded-b-lg">
                     <button onClick={() => setConfirmationRequest(null)} className="px-4 py-2 rounded-md bg-border-primary hover:bg-gray-700 text-white font-semibold">Cancel</button>
                     <button onClick={confirmationRequest.onConfirm} className="px-4 py-2 rounded-md bg-accent-primary hover:bg-purple-700 text-white font-semibold">Confirm</button>
                 </div>
             </div>
             </div>
        )}

        {modal === 'report' && reportData && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
            <div className="bg-bg-secondary rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col border border-border-primary animate-fade-in" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-border-primary flex-shrink-0">
                <div className="flex items-center gap-2"><FileText size={20}/><h3 className="text-lg font-bold text-white">{reportData.title}</h3></div>
                <div className="flex items-center gap-2">
                    <button onClick={printReport} className="p-2 text-text-secondary hover:text-white"><Printer size={18}/></button>
                    <button className="p-2 text-text-secondary hover:text-white"><Download size={18}/></button>
                    <button onClick={() => setModal(null)} className="text-text-secondary hover:text-white"><X size={20}/></button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto flex-grow">
                  <p className="font-semibold text-text-secondary">Date Range: {reportData.content.dateRange}</p>
                  <div className="my-4 p-4 bg-bg-primary rounded-lg grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div><p className="text-xs text-text-secondary">Items Added</p><p className="text-xl font-bold text-white">{reportData.content.summary.totalItemsAdded}</p></div>
                      <div><p className="text-xs text-text-secondary">Items Packed</p><p className="text-xl font-bold text-white">{reportData.content.summary.totalItemsPacked}</p></div>
                      <div><p className="text-xs text-text-secondary">Items Lost</p><p className="text-xl font-bold text-white">{reportData.content.summary.totalItemsLost}</p></div>
                      <div><p className="text-xs text-text-secondary">Most Active Item</p><p className="text-xl font-bold text-white truncate">{reportData.content.summary.mostActiveItem || 'N/A'}</p></div>
                  </div>
                  <h4 className="font-bold text-white mb-2">Detailed Log</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-text-primary">
                      <thead className="bg-bg-primary"><tr><th className="p-2">Timestamp</th><th className="p-2">User</th><th className="p-2">Item</th><th className="p-2">Action</th></tr></thead>
                      <tbody>{reportData.content.detailedLog.map((log: ActivityLogEntry) => (<tr key={log.id} className="border-b border-border-primary"><td className="p-2">{new Date(log.timestamp).toLocaleString()}</td><td className="p-2">{log.users?.full_name || 'System'}</td><td className="p-2">{log.item_name}</td><td className="p-2">{log.change_description}</td></tr>))}</tbody>
                    </table>
                  </div>
              </div>
            </div>
          </div>
        )}

        {modal === 'suppliers' && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start justify-center z-50 p-4 pt-20" onClick={() => setModal(null)}>
            <div className="bg-bg-secondary rounded-lg shadow-2xl w-full max-w-2xl border border-border-primary animate-fade-in" onClick={e => e.stopPropagation()}>
                <div className="p-4 flex items-center justify-between"><h3 className="text-lg font-bold text-white flex items-center gap-2"><TruckIcon size={20} className="text-accent-secondary"/> Supplier Balances</h3><button onClick={() => setModal(null)} className="text-text-secondary hover:text-white"><X size={20}/></button></div>
                <div className="p-4 border-t border-border-primary max-h-[60vh] overflow-y-auto">
                    <div className="space-y-2">
                    {suppliers.map(supplier => (
                        <div key={supplier.id} className="flex items-center justify-between p-3 bg-bg-primary rounded-md">
                            <p className="font-semibold text-white">{supplier.name}</p>
                            <p className="font-bold text-lg text-green-400">R{supplier.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        </div>
                    ))}
                    {suppliers.length === 0 && <p className="text-text-secondary text-center py-8">No suppliers found. Add items on credit to create suppliers.</p>}
                    </div>
                </div>
            </div>
          </div>
        )}

        {modal === 'editItem' && editFormData && itemToEdit && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
                <div className="bg-bg-secondary rounded-lg shadow-2xl w-full max-w-lg border border-border-primary animate-fade-in" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between p-4 border-b border-border-primary">
                        <h3 className="text-lg font-bold text-white">Edit: {itemToEdit.name}</h3>
                        <button onClick={() => setModal(null)} className="text-text-secondary hover:text-white"><X size={20}/></button>
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); handleEditItem(itemToEdit.id, editFormData); }} className="p-6 space-y-4">
                        <div>
                            <label className="text-sm font-medium text-text-secondary block mb-1">Item Name</label>
                            <input type="text" value={editFormData.name} onChange={(e) => setEditFormData(p => p ? {...p, name: e.target.value} : null)} required className="w-full bg-bg-primary border border-border-primary rounded-md p-2 text-white focus:ring-2 focus:ring-accent-primary outline-none" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-text-secondary block mb-1">Category</label>
                            <input type="text" value={editFormData.category} onChange={(e) => setEditFormData(p => p ? {...p, category: e.target.value} : null)} placeholder="e.g., Deons, Groenkloof" className="w-full bg-bg-primary border border-border-primary rounded-md p-2 text-white focus:ring-2 focus:ring-accent-primary outline-none" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-text-secondary block mb-1">Color Tag</label>
                            <div className="flex flex-wrap gap-2">{COLOR_PALETTE.map(color => (<button key={color} type="button" onClick={() => setEditFormData(p => p ? {...p, color} : null)} className={`w-8 h-8 rounded-full border-2 ${editFormData.color === color ? 'border-white ring-2 ring-offset-2 ring-offset-bg-secondary ring-white' : 'border-transparent'} transition-all`} style={{ backgroundColor: color }} />))}</div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <button type="submit" disabled={isLoading} className="px-4 py-2 rounded-md bg-accent-primary hover:bg-purple-700 text-white font-semibold disabled:bg-border-primary disabled:cursor-not-allowed flex items-center justify-center">{isLoading ? <Loader size={20} className="animate-spin"/> : 'Save Changes'}</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {modal === 'deleteItem' && itemToDelete && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
                <div className="bg-bg-secondary rounded-lg shadow-2xl w-full max-w-md border border-border-primary animate-fade-in">
                    <div className="p-6 text-center">
                        <AlertTriangle className="w-16 h-16 text-danger mx-auto mb-4"/>
                        <h3 className="text-xl font-bold text-white">Confirm Deletion</h3>
                        <p className="text-text-secondary mt-2">Are you sure you want to permanently delete <strong className="text-white">{itemToDelete.name}</strong>? This action cannot be undone.</p>
                    </div>
                    <div className="bg-bg-primary px-6 py-4 flex justify-end gap-3 rounded-b-lg">
                        <button onClick={() => setModal(null)} className="px-4 py-2 rounded-md bg-border-primary hover:bg-gray-700 text-white font-semibold">Cancel</button>
                        <button onClick={() => handleDeleteItem(itemToDelete.id)} className="px-4 py-2 rounded-md bg-danger hover:bg-red-700 text-white font-semibold">Delete Item</button>
                    </div>
                </div>
            </div>
        )}


        <Header 
          teamName={team.name}
          onNewDayClick={() => setModal('newDay')} 
          onCommandInputClick={() => setModal('commandInput')}
          onAddItemClick={() => { resetAddItemForm(); setModal('addItem'); }}
          onSuppliersClick={() => setModal('suppliers')}
          onExportClick={() => alert('Export functionality coming soon!')}
          onNavigate={setCurrentView}
          currentView={currentView}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          user={session.user}
        />
        
        <main>
          {currentView === 'dashboard' && (
            <div className="space-y-4 animate-fade-in">
              <SummaryCards 
                stats={summaryStats}
                onLowStockClick={() => {
                  const lowStockNames = enhancedStockData.filter(i => i.remaining <= i.alert_level).map(i => i.name).join(', ');
                  setInfoModalContent(`The following items are low on stock:\n\n${lowStockNames}`);
                }}
              />
              <InventoryTable 
                data={enhancedStockData} 
                onUpdate={handleStockUpdate}
                onCommand={handleAICommand}
                isLoading={isLoading}
                onEditClick={(itemId) => { setItemToEdit(stockItems.find(i => i.id === itemId) || null); setModal('editItem'); }}
                onDeleteClick={(itemId) => { setItemToDelete(stockItems.find(i => i.id === itemId) || null); setModal('deleteItem'); }}
                viewMode={inventoryViewMode}
                setViewMode={setInventoryViewMode}
                onOpenReport={() => generateReport(new Date(new Date().setDate(new Date().getDate() - 6)), new Date(), 'Report for Last 7 Days')}
                onNavigate={setCurrentView}
                currentView={currentView}
              />
            </div>
          )}
          {currentView === 'binStock' && (
            <div className="animate-fade-in">
                <BinStockPage 
                    data={binStockData} 
                    onCommand={handleBinAICommand}
                    isLoading={isBinAILoading}
                    onBinMovement={handleBinMovement}
                    onDirectEdit={handleDirectEdit}
                    setConfirmationRequest={setConfirmationRequest}
                    onAddBinType={handleAddBinType}
                    onRemoveBinType={handleRemoveBinType}
                    onUpdateBinColor={handleUpdateBinColor}
                    onAddParty={handleAddParty}
                    onRemoveParty={handleRemoveParty}
                    onUpdateNotes={handleUpdateNotes}
                    onUpdateStatusCount={handleUpdateStatusCount}
                />
            </div>
          )}
          {currentView === 'history' && (
            <div className="animate-fade-in">
              <HistoryPage history={activityLog} selectedDate={selectedDate} />
            </div>
          )}
          {currentView === 'settings' && (
            <div className="animate-fade-in">
              <SettingsPage
                teamName={team.name}
                teamMembers={teamMembers}
                onUpdateTeamName={handleUpdateTeamName}
                onAddMember={handleAddTeamMember}
                onRemoveMember={handleRemoveTeamMember}
                onUpdateMemberRole={handleUpdateMemberRole}
                onResetData={() => setModal('confirmReset')}
                onResetBinData={() => setModal('confirmBinReset')}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;