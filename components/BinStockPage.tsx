import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BinStockData, BinTypeName, BinCounts, BinParty, CustomBinType, BinTypeDefinition, BinHistoryEntry } from '../types';
import { PlusCircle, Trash2, Calendar, Save, Palette, X, Search, Send, Loader, History } from 'lucide-react';

interface BinStockPageProps {
  data: BinStockData;
  onCommand: (command: string) => void;
  isLoading: boolean;
  onBinMovement: (details: { type: 'sent' | 'received' | 'returned', quantity: number, binId: string, partyName: string, transporter?: string, binContents?: string }) => void;
  onDirectEdit: (details: { partyId: string, binId: string, newValue: number }) => void;
  setConfirmationRequest: (request: { title: string; message: React.ReactNode; onConfirm: () => void; } | null) => void;
  onAddBinType: (details: { name: string; color: string; category: 'standard' | 'mixed'; sub_category?: 'mixedWood' | 'mixedPlastic' }) => void;
  onRemoveBinType: (binId: string) => void;
  onUpdateBinColor: (binId: string, color: string) => void;
  onAddParty: (partyName: string) => void;
  onRemoveParty: (partyId: string, partyName: string) => void;
  onUpdateNotes: (notes: string) => void;
  onUpdateStatusCount: (statusKey: keyof BinStockData['statuses'], binId: string, newValue: number) => void;
}


export const BIN_TYPE_NAMES: Record<BinTypeName, string> = {
  chepPlastic: 'Chep Plastic',
  chepWood: 'Chep wood',
  f1Wood: 'f1 Wood',
  alg: 'ALG',
  cSelect: 'C/Select',
  mixedWood: 'mixed wood',
  mixedPlastic: 'mixed plastic',
  mJackson: 'm jackson bins',
};

const COLOR_PALETTE = ['#10B981', '#3B82F6', '#F97316', '#EC4899', '#8B5CF6', '#F59E0B', '#6366F1', '#EF4444', '#14b8a6', '#06b6d4', '#0ea5e9', '#f43f5e', '#d946ef', '#84cc16', '#eab308', '#64748b'];

const STATUS_ROWS: { key: keyof BinStockData['statuses']; label: string, editable: boolean }[] = [
    { key: 'total', label: 'Total', editable: false },
    { key: 'full', label: 'Full', editable: true },
    { key: 'inFridge', label: 'In Fridge', editable: true },
    { key: 'broken', label: 'Broken', editable: true },
    { key: 'dump', label: 'Dump', editable: true },
];

// --- HELPER & CHILD COMPONENTS ---
const CommandBar: React.FC<{ 
    searchTerm: string;
    setSearchTerm: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    isLoading: boolean; 
}> = ({ searchTerm, setSearchTerm, onSubmit, isLoading }) => {
    return (
        <div className="mb-3">
            <form onSubmit={onSubmit} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                <input 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search party or ask AI... e.g., 'send 5 chep plastic to Ziyard'"
                    className="w-full bg-bg-secondary border border-border-primary rounded-md pl-10 pr-14 py-2 text-white placeholder-text-secondary focus:ring-2 focus:ring-accent-primary outline-none"
                    disabled={isLoading}
                />
                <button type="submit" title="Send Command" className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center bg-accent-primary hover:bg-purple-700 text-white font-semibold p-1.5 rounded-md transition-colors disabled:bg-border-primary disabled:cursor-not-allowed" disabled={isLoading || !searchTerm.trim()}>
                    {isLoading ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
            </form>
        </div>
    );
};

const ModalWrapper: React.FC<{ children: React.ReactNode, title: string, onClose: () => void, size?: 'sm' | 'lg' | 'xl' }> = ({ children, title, onClose, size = 'sm' }) => {
    const sizeClasses = {
      sm: 'max-w-sm',
      lg: 'max-w-2xl',
      xl: 'max-w-5xl'
    };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className={`bg-bg-secondary rounded-lg shadow-2xl w-full ${sizeClasses[size]} border border-border-primary`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border-primary"><h3 className="text-lg font-bold text-white">{title}</h3><button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={20}/></button></div>
            <div className="p-6">{children}</div>
        </div>
        </div>
    );
};

const ColorPicker: React.FC<{ selectedColor: string; onSelect: (color: string) => void; }> = ({ selectedColor, onSelect }) => (<div className="flex flex-wrap gap-2">{COLOR_PALETTE.map(color => (<button key={color} type="button" onClick={() => onSelect(color)} className={`w-8 h-8 rounded-full border-2 ${selectedColor === color ? 'border-white ring-2 ring-offset-2 ring-offset-bg-secondary ring-white' : 'border-transparent'} transition-all`} style={{ backgroundColor: color }} />))}</div>);

const EditableBinCell: React.FC<{ value: number | ''; onChange: (value: number | '') => void; editable?: boolean; isTotal?: boolean }> = ({ value, onChange, editable = true, isTotal = false }) => {
    const [inputValue, setInputValue] = useState(String(value));
    
    useEffect(() => {
        setInputValue(String(value));
    }, [value]);

    const handleBlur = () => {
        const trimmed = inputValue.trim();
        if (trimmed === '') {
            if (value !== '') {
                onChange('');
            }
            return;
        }

        const numValue = Number(trimmed);
        if (isNaN(numValue)) {
            // Revert if invalid
            setInputValue(String(value));
        } else if (numValue !== Number(value)) {
            onChange(numValue);
        } else if (trimmed !== String(value)) {
             // handles formatting differences like '05' vs '5'
            setInputValue(String(value));
        }
    };
    
    if (!editable) {
        return <span className={`flex items-center justify-center w-full h-full text-center ${isTotal ? 'font-bold text-white' : 'text-text-secondary'}`}>{value}</span>
    }
    return <input type="number" value={inputValue} onChange={e => setInputValue(e.target.value)} onBlur={handleBlur} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} className="bg-transparent w-full h-full text-center text-white outline-none focus:ring-2 focus:ring-accent-primary rounded-sm" />
};

const MixedBinCellDisplay: React.FC<{ category: 'mixedWood' | 'mixedPlastic'; bins: BinCounts; customBinTypes: CustomBinType[]; }> = ({ category, bins, customBinTypes }) => {
    const subBins = customBinTypes
        .filter(b => b.category === category && bins[b.id] && Number(bins[b.id]) > 0)
        .sort((a, b) => a.name.localeCompare(b.name));

    if (subBins.length === 0) {
        const total = bins[category] || 0;
        return <span className="flex items-center justify-center w-full h-full font-medium">{total}</span>;
    }

    return (
        <div className="text-xs text-left p-1 space-y-0.5 h-full overflow-y-auto">
            {subBins.map(bin => (
                <div key={bin.id} className="flex justify-between items-center whitespace-nowrap">
                    <span className="text-text-secondary truncate">{bin.name}:</span>
                    <span className="font-semibold text-white ml-2">{bins[bin.id]}</span>
                </div>
            ))}
        </div>
    );
};


// --- MAIN COMPONENT ---
const BinStockPage: React.FC<BinStockPageProps> = ({ data, onCommand, isLoading, onBinMovement, onDirectEdit, setConfirmationRequest, onAddBinType, onRemoveBinType, onUpdateBinColor, onAddParty, onRemoveParty, onUpdateNotes, onUpdateStatusCount }) => {
  const [newMovement, setNewMovement] = useState({ type: 'sent' as 'sent'|'received'|'returned', quantity: '' as number | '', binId: '', partyName: '', transporter: '', binContents: '' });
  const [modal, setModal] = useState<'addParty' | 'addStandardBin' | 'addMixedBin' | 'editColor' | 'breakdown' | 'history' | null>(null);
  const [modalConfig, setModalConfig] = useState<any>({});
  const [newItemName, setNewItemName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);
  const [newMixedBinSubCategory, setNewMixedBinSubCategory] = useState<'mixedWood' | 'mixedPlastic'>('mixedWood');
  const [breakdownData, setBreakdownData] = useState<BinCounts | null>(null);
  const [notes, setNotes] = useState(data.notes);
  const [searchTerm, setSearchTerm] = useState('');
  
  const notesTimeoutRef = useRef<number | null>(null);
  
  useEffect(() => {
    setNotes(data.notes);
  }, [data.notes]);
  
  const allParties = useMemo(() => {
    const parties = [...data.owedToUs, ...data.weOwe];
    return parties.filter((party, index, self) => 
        index === self.findIndex((p) => p.name === party.name)
    );
  }, [data.owedToUs, data.weOwe]);

  const calculatedData = useMemo<BinStockData>(() => {
    // This is a client-side calculation to show mixed bin totals based on their sub-components.
    const draft = JSON.parse(JSON.stringify(data));
    const customMixedWoodBins = draft.customBinTypes.filter((b: CustomBinType) => b.category === 'mixedWood').map((b: CustomBinType) => b.id);
    const customMixedPlasticBins = draft.customBinTypes.filter((b: CustomBinType) => b.category === 'mixedPlastic').map((b: CustomBinType) => b.id);
    
    const updateMixedTotals = (target: { bins: BinCounts } | BinCounts) => {
        const bins = 'bins' in target ? target.bins : target;
  (bins as BinCounts)['mixedWood'] = customMixedWoodBins.reduce((sum: number, binId: string) => sum + (Number((bins as BinCounts)[binId]) || 0), 0);
  (bins as BinCounts)['mixedPlastic'] = customMixedPlasticBins.reduce((sum: number, binId: string) => sum + (Number((bins as BinCounts)[binId]) || 0), 0);
    };
    
  Object.values(draft.statuses).forEach((status: any) => updateMixedTotals(status as BinCounts));
    draft.owedToUs.forEach((party: BinParty) => updateMixedTotals(party));
    draft.weOwe.forEach((party: BinParty) => updateMixedTotals(party));
    return draft;
  }, [data]);

  const filteredOwedToUs = useMemo(() => {
    if (!searchTerm.trim()) return calculatedData.owedToUs;
    return calculatedData.owedToUs.filter(party => party.name.toLowerCase().includes(searchTerm.trim().toLowerCase()));
  }, [calculatedData.owedToUs, searchTerm]);
  
  const filteredWeOwe = useMemo(() => {
    if (!searchTerm.trim()) return calculatedData.weOwe;
    return calculatedData.weOwe.filter(party => party.name.toLowerCase().includes(searchTerm.trim().toLowerCase()));
  }, [calculatedData.weOwe, searchTerm]);

  const handleAddParty = () => {
    if (!newItemName) return;
    onAddParty(newItemName.trim());
    setModal(null);
    setNewItemName('');
  };
  
  const handleRemoveParty = (partyId: string, partyName: string) => {
    onRemoveParty(partyId, partyName);
  };

  const handleAddStandardBinType = () => {
    if (!newItemName.trim() || !selectedColor) {
      alert("Please enter a name and select a color.");
      return;
    }
    onAddBinType({ name: newItemName.trim(), color: selectedColor, category: 'standard' });
    setModal(null);
    setNewItemName('');
    setSelectedColor(COLOR_PALETTE[0]);
  };
  
  const handleAddMixedBinType = () => {
    if (!newItemName.trim() || !selectedColor) {
        alert("Please enter a name and select a color.");
        return;
    }
    onAddBinType({
        name: newItemName.trim(),
        color: selectedColor,
        category: 'mixed',
        sub_category: newMixedBinSubCategory,
    });
    setModal(null);
    setNewItemName('');
    setSelectedColor(COLOR_PALETTE[0]);
    setNewMixedBinSubCategory('mixedWood');
  };

  const handleRemoveBinType = (binIdToRemove: string) => {
    onRemoveBinType(binIdToRemove);
  };

  const handleUpdateBinColor = () => {
    const { binId } = modalConfig;
    if (!binId || !selectedColor) return;
    onUpdateBinColor(binId, selectedColor);
    setModal(null);
  };
  
  const handleLogMovement = () => {
    const { type, quantity, binId, partyName, transporter, binContents } = newMovement;
    if (!quantity || !binId || !partyName.trim()) {
      alert("Please fill all required fields: Quantity, Bin Type, and Party Name.");
      return;
    }
    const bin = calculatedData.binTypes.find((b:any) => b.id === binId);
    if (!bin) return;

    const movementDetails = {
        type,
        quantity: Number(quantity),
        binId,
        partyName: partyName.trim(),
        transporter: transporter.trim(),
        binContents: binContents.trim()
    };
    
    const message = (
        <div className="space-y-2">
            <p>Please confirm you want to log the following movement:</p>
            <ul className="list-disc list-inside bg-bg-primary p-3 rounded-md space-y-1 text-sm">
                <li><strong>Action:</strong> {movementDetails.type.charAt(0).toUpperCase() + movementDetails.type.slice(1)}</li>
                <li><strong>Quantity:</strong> {movementDetails.quantity}</li>
                <li><strong>Bin Type:</strong> {bin.name}</li>
                <li><strong>Party:</strong> {movementDetails.partyName}</li>
                {movementDetails.binContents && <li><strong>Contents:</strong> {movementDetails.binContents}</li>}
                {movementDetails.transporter && <li><strong>Via:</strong> {movementDetails.transporter}</li>}
            </ul>
        </div>
    );

    setConfirmationRequest({
        title: 'Confirm Bin Movement',
        message,
        onConfirm: () => {
            onBinMovement(movementDetails);
            setNewMovement({ type: 'sent', quantity: '', binId: '', partyName: '', transporter: '', binContents: '' });
        }
    });
  };
  
  const handleStatusBinChange = (statusKey: keyof BinStockData['statuses'], binId: string, newValue: number | '') => {
      const finalNewValue = newValue === '' ? 0 : Number(newValue);
      onUpdateStatusCount(statusKey, binId, finalNewValue);
  };

    const handlePartyBinChange = (partyId: string, binId: string, newValue: number | '') => {
        const finalNewValue = newValue === '' ? 0 : Number(newValue);
        const party = allParties.find(p => p.id === partyId);
        const bin = [...data.binTypes, ...data.customBinTypes].find(b => b.id === binId);
        if(!party || !bin) return;

        const oldValue = Number(party.bins[binId] || 0);

        const message = (
             <p>Are you sure you want to manually update <strong>{party.name}</strong>'s balance for <strong>{bin.name}</strong> from <strong>{oldValue}</strong> to <strong>{finalNewValue}</strong>?</p>
        );

        setConfirmationRequest({
            title: 'Confirm Manual Edit',
            message,
            onConfirm: () => {
                onDirectEdit({ partyId, binId, newValue: finalNewValue });
            }
        });
    };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newNotes = e.target.value;
    setNotes(newNotes);
    if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current);
    }
    notesTimeoutRef.current = window.setTimeout(() => {
        onUpdateNotes(newNotes);
    }, 1000);
  };
  
  const handleBreakdownSave = () => {
    if (!breakdownData || !modalConfig.context) return;
    const { partyId, partyType, statusKey } = modalConfig.context;

    console.log("Saving breakdown data...", { partyId, partyType, statusKey, breakdownData });
    // TODO: This logic now needs to be handled in Dashboard.tsx via a new prop
    // It will involve multiple upserts into bin_balances or bin_status_counts

    setModal(null);
    setBreakdownData(null);
  };
  
  const standardBins = useMemo(() => calculatedData.binTypes.filter((b:any) => b.category === 'standard'), [calculatedData.binTypes]);
  const mixedBins = useMemo(() => calculatedData.binTypes.filter((b:any) => b.category === 'mixed'), [calculatedData.binTypes]);

  const todaysMovements = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const movements = data.history
      .filter(entry => {
        const entryDate = new Date(entry.timestamp);
        return entry.type === 'movement' && entryDate >= today && entry.details;
      });
      
    const sent = movements.filter(m => m.details?.movementType === 'sent');
    const received = movements.filter(m => m.details?.movementType === 'received');
    const returned = movements.filter(m => m.details?.movementType === 'returned');
    
    return { sent, received, returned };
  }, [data.history]);


  // --- RENDER ---
  const renderBinTableHeader = (bins: BinTypeDefinition[], addAction?: () => void) => (
    <>
      {bins.map(bin => (
        <th key={bin.id} className="p-0 w-36 text-center font-semibold text-text-secondary group relative align-top">
          <div className="h-20 bg-bg-primary flex flex-col justify-center items-center p-2 text-center relative border-b-2 border-border-primary">
            <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: bin.color }}></div>
            <div className="absolute top-0 left-0 h-full w-1" style={{ backgroundColor: bin.color }}></div>
            <div className="relative z-10 flex items-center justify-center gap-2 mb-1 flex-grow">
              <span className="font-bold text-white text-sm text-center leading-tight uppercase">{bin.name}</span>
            </div>
            <div className="relative z-10 flex items-center gap-2 mt-auto text-text-secondary">
              <button onClick={() => { setModal('editColor'); setModalConfig({ binId: bin.id }); setSelectedColor(bin.color); }} className="hover:text-white" title="Edit Color"><Palette size={12}/></button>
              {!bin.isDefault && (
                <button onClick={() => handleRemoveBinType(bin.id)} className="hover:text-danger" title="Delete Bin Type"><Trash2 size={12}/></button>
              )}
            </div>
          </div>
        </th>
      ))}
      {addAction && (
        <th className="p-0 w-24 align-top">
           <div className="h-20 bg-bg-primary flex justify-center items-center p-2 border-b-2 border-border-primary">
             <button onClick={addAction} className="flex flex-col items-center text-accent-primary hover:text-purple-400" title="Add New Bin Type">
               <PlusCircle size={24}/>
               <span className="text-xs font-semibold mt-1">ADD BIN</span>
             </button>
           </div>
        </th>
      )}
    </>
  );

 const renderStatusRow = (row: typeof STATUS_ROWS[0], bins: BinTypeDefinition[]) => (
    bins.map(bin => {
      const isMixed = bin.category === 'mixed';
      const targetBins = calculatedData.statuses[row.key];
      if (!targetBins) return <td key={`${row.key}-${bin.id}`}></td>;

      if (isMixed) {
        return (
          <td key={bin.id} className="p-0 w-36 align-top h-full">
            <button onClick={() => { setModal('breakdown'); setModalConfig({ context: { category: bin.id, partyType: 'statuses', statusKey: row.key }}); setBreakdownData(JSON.parse(JSON.stringify(targetBins))); }} className="w-full h-14 text-left hover:bg-bg-secondary transition-colors font-medium">
              <MixedBinCellDisplay category={bin.id as 'mixedWood' | 'mixedPlastic'} bins={targetBins} customBinTypes={calculatedData.customBinTypes}/>
            </button>
          </td>
        );
      }
      return (
        <td key={bin.id} className="p-0 w-36 h-14">
          <EditableBinCell editable={row.editable} isTotal={row.key === 'total'} value={targetBins[bin.id]} onChange={(newValue) => handleStatusBinChange(row.key, bin.id, newValue)}/>
        </td>
      );
    })
  );

  const renderPartyRow = (party: BinParty, partyType: 'owedToUs' | 'weOwe', bins: BinTypeDefinition[]) => (
    bins.map(bin => {
      const isMixed = bin.category === 'mixed';
      if (isMixed) {
        return (
          <td key={`${party.id}-${bin.id}`} className="p-0 w-36 align-top h-full">
            <button onClick={() => { setModal('breakdown'); setModalConfig({ context: { category: bin.id, partyId: party.id, partyType }}); setBreakdownData(JSON.parse(JSON.stringify(party.bins))); }} className="w-full h-14 text-left hover:bg-bg-secondary transition-colors font-medium">
              <MixedBinCellDisplay category={bin.id as 'mixedWood' | 'mixedPlastic'} bins={party.bins} customBinTypes={calculatedData.customBinTypes}/>
            </button>
          </td>
        );
      }
      return (
        <td key={`${party.id}-${bin.id}`} className="p-0 w-36 h-14">
          <EditableBinCell editable={true} value={party.bins[bin.id]} onChange={(newValue) => handlePartyBinChange(party.id, bin.id, newValue)}/>
        </td>
      );
    })
  );

  const TodaysMovementsSummary = () => {
    const { sent, received, returned } = todaysMovements;
    const MovementList = ({ title, items, colorClass }: {title: string; items: BinHistoryEntry[]; colorClass: string}) => (
        <div className="flex-1 bg-bg-primary p-3 rounded-md border border-border-primary">
            <h4 className={`font-semibold mb-2 ${colorClass}`}>{title}</h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
                {items.length > 0 ? (
                    items.map(item => (
                        <p key={item.id} className="text-xs text-text-primary bg-bg-secondary p-1.5 rounded">
                            {item.change}
                        </p>
                    ))
                ) : (
                    <p className="text-xs text-text-secondary italic">No movements.</p>
                )}
            </div>
        </div>
    );

    return (
        <div className="pt-4">
            <h3 className="text-xl font-bold text-text-primary mb-2">Today's Detailed Movements</h3>
            <div className="flex flex-col md:flex-row gap-4">
                <MovementList title="Sent" items={sent} colorClass="text-red-400" />
                <MovementList title="Received" items={received} colorClass="text-green-400" />
                <MovementList title="Returned" items={returned} colorClass="text-blue-400" />
            </div>
        </div>
    );
};
  

  return (
    <div className="bg-bg-secondary rounded-lg p-4 space-y-4 border border-border-primary">
      {/* Modals */}
      {modal === 'addParty' && <ModalWrapper title="Add New Party" onClose={() => setModal(null)}><form onSubmit={(e) => { e.preventDefault(); handleAddParty(); }} className="space-y-4"><input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Enter party name..." autoFocus className="w-full bg-bg-primary border border-border-primary rounded-md p-2 text-white focus:ring-2 focus:ring-accent-primary outline-none" /><div className="flex justify-end"><button type="submit" className="px-4 py-2 rounded-md bg-accent-primary hover:bg-purple-700 text-white font-semibold">Add Party</button></div></form></ModalWrapper>}
      {modal === 'addStandardBin' && <ModalWrapper title="Add New Standard Bin Type" onClose={() => setModal(null)}><form onSubmit={(e) => { e.preventDefault(); handleAddStandardBinType(); }} className="space-y-4"><input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Enter bin name..." autoFocus className="w-full bg-bg-primary border border-border-primary rounded-md p-2 text-white focus:ring-2 focus:ring-accent-primary outline-none" /><ColorPicker selectedColor={selectedColor} onSelect={setSelectedColor} /><div className="flex justify-end"><button type="submit" className="px-4 py-2 rounded-md bg-accent-primary hover:bg-purple-700 text-white font-semibold">Add Bin</button></div></form></ModalWrapper>}
      {modal === 'addMixedBin' && <ModalWrapper title="Add New Mixed Bin Type" onClose={() => setModal(null)}>
        <form onSubmit={(e) => { e.preventDefault(); handleAddMixedBinType(); }} className="space-y-4">
            <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Enter bin name..." autoFocus className="w-full bg-bg-primary border border-border-primary rounded-md p-2 text-white focus:ring-2 focus:ring-accent-primary outline-none" />
            <div>
                <label className="text-sm font-medium text-text-secondary mb-2 block">Category</label>
                <div className="flex gap-2">
                    <button type="button" onClick={() => setNewMixedBinSubCategory('mixedWood')} className={`flex-1 p-2 rounded-md text-sm font-semibold border-2 ${newMixedBinSubCategory === 'mixedWood' ? 'border-accent-primary bg-accent-primary/20' : 'border-transparent bg-bg-primary'}`}>Mixed Wood</button>
                    <button type="button" onClick={() => setNewMixedBinSubCategory('mixedPlastic')} className={`flex-1 p-2 rounded-md text-sm font-semibold border-2 ${newMixedBinSubCategory === 'mixedPlastic' ? 'border-accent-primary bg-accent-primary/20' : 'border-transparent bg-bg-primary'}`}>Mixed Plastic</button>
                </div>
            </div>
            <ColorPicker selectedColor={selectedColor} onSelect={setSelectedColor} />
            <div className="flex justify-end"><button type="submit" className="px-4 py-2 rounded-md bg-accent-primary hover:bg-purple-700 text-white font-semibold">Add Bin</button></div>
        </form>
      </ModalWrapper>}
      {modal === 'editColor' && <ModalWrapper title="Edit Bin Color" onClose={() => setModal(null)}><div className="space-y-4"><ColorPicker selectedColor={selectedColor} onSelect={setSelectedColor} /><div className="flex justify-end"><button onClick={handleUpdateBinColor} className="px-4 py-2 rounded-md bg-accent-primary hover:bg-purple-700 text-white font-semibold">Save Color</button></div></div></ModalWrapper>}
      {modal === 'breakdown' && <ModalWrapper title={`Breakdown for ${calculatedData.binTypes.find((b:any)=>b.id===modalConfig.context.category)?.name}`} onClose={() => setModal(null)} size="lg">
        {breakdownData && modalConfig.context ? (
            <div className="space-y-4">
                <p className="text-sm text-text-secondary">
                    Specify the counts for each sub-type. The total will be calculated automatically.
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto p-1">
                    {data.customBinTypes
                        .filter(b => b.category === modalConfig.context.category)
                        .map(bin => (
                            <div key={bin.id} className="flex items-center justify-between bg-bg-primary p-2 rounded-md">
                                <label className="text-white font-medium">{bin.name}</label>
                                <input
                                    type="number"
                                    value={breakdownData[bin.id] ?? ''}
                                    onChange={e => setBreakdownData(prev =>
                                        prev
                                            ? { ...prev, [bin.id]: e.target.value === '' ? '' : Number(e.target.value) }
                                            : null
                                    )}
                                    className="w-24 bg-bg-secondary border border-border-primary rounded-md p-2 text-white text-right"
                                />
                            </div>
                        ))}
                    {data.customBinTypes.filter(b => b.category === modalConfig.context.category).length === 0 && (
                        <p className="text-text-secondary text-center py-4">
                            No sub-types configured for this category.
                        </p>
                    )}
                </div>
                <div className="flex justify-end pt-2 border-t border-border-primary mt-4">
                    <button onClick={handleBreakdownSave} className="px-4 py-2 rounded-md bg-accent-primary hover:bg-purple-700 text-white font-semibold">
                        Save Breakdown
                    </button>
                </div>
            </div>
        ) : (
            <p>Loading breakdown data...</p>
        )}
      </ModalWrapper>}
      {modal === 'history' && <ModalWrapper title="Bin History Log" onClose={() => setModal(null)} size="xl"><div className="max-h-[70vh] overflow-y-auto"><table className="w-full text-left text-sm text-text-primary"><thead className="bg-bg-primary sticky top-0"><tr><th className="p-2">Timestamp</th><th className="p-2">Type</th><th className="p-2">Change</th><th className="p-2">Details</th></tr></thead><tbody>{data.history.map(entry => (<tr key={entry.id} className="border-b border-border-primary"><td className="p-2 whitespace-nowrap">{new Date(entry.timestamp).toLocaleString()}</td><td className="p-2"><span className="text-xs bg-border-primary px-2 py-0.5 rounded-full">{entry.type}</span></td><td className="p-2">{entry.change}</td><td className="p-2 text-xs text-text-secondary">{entry.details ? Object.entries(entry.details).map(([key, value]) => `${key}: ${value}`).join(', ') : ''}</td></tr>))}</tbody></table></div></ModalWrapper>}

      {/* Header & AI */}
      <div className="flex flex-wrap justify-between items-center gap-2"><h2 className="text-2xl font-bold text-white">Bin Stock Take</h2><div className="flex items-center gap-2"><button onClick={() => setModal('history')} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-border-primary hover:bg-gray-700 text-white font-semibold"><History size={16}/> View History</button><div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" /><input type="date" defaultValue={new Date().toISOString().split('T')[0]} className="bg-bg-primary border border-border-primary rounded-md pl-9 pr-2 py-1.5 text-white" /></div></div></div>
      <CommandBar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onSubmit={(e) => { e.preventDefault(); onCommand(searchTerm); }}
          isLoading={isLoading}
      />
      
      {/* --- STATUS TABLES --- */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-grow bg-bg-primary/50 rounded-lg overflow-hidden border border-border-primary"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-bg-primary"><tr><th className="p-3 w-48 font-semibold text-text-secondary sticky left-0 bg-bg-primary z-10">METRIC</th>{renderBinTableHeader(standardBins, () => { setSelectedColor(COLOR_PALETTE[0]); setModal('addStandardBin'); })}</tr></thead><tbody>{STATUS_ROWS.map(row => (<tr key={row.key} className="border-t border-border-primary"><td className="p-3 w-48 font-semibold text-text-secondary sticky left-0 bg-bg-secondary z-10">{row.label}</td>{renderStatusRow(row, standardBins)}</tr>))}</tbody></table></div></div>
        <div className="flex-shrink-0 bg-bg-primary/50 rounded-lg overflow-hidden border border-border-primary"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-bg-primary"><tr>{renderBinTableHeader(mixedBins, () => { setSelectedColor(COLOR_PALETTE[0]); setModal('addMixedBin'); })}</tr></thead><tbody>{STATUS_ROWS.map(row => (<tr key={row.key} className="border-t border-border-primary">{renderStatusRow(row, mixedBins)}</tr>))}</tbody></table></div></div>
      </div>

      {/* --- OWED TO US --- */}
      <div className="pt-4">
          <div className="flex justify-between items-center mb-2"><h3 className="text-xl font-bold text-text-primary">Owed To Us</h3><button onClick={() => { setModal('addParty'); }} className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md bg-accent-secondary hover:bg-cyan-700 text-white font-semibold"><PlusCircle size={14}/> Add Party</button></div>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-grow bg-bg-primary/50 rounded-lg overflow-hidden border border-border-primary"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-bg-primary"><tr><th className="p-3 w-48 font-semibold text-text-secondary sticky left-0 bg-bg-primary z-10">PARTY</th>{renderBinTableHeader(standardBins)}</tr></thead><tbody>{filteredOwedToUs.map(party => (<tr key={party.id} className="border-t border-border-primary"><td className="w-48 sticky left-0 bg-bg-secondary z-10 p-2"><div className="flex items-center justify-between"><span className="font-semibold text-white">{party.name}</span><button onClick={() => handleRemoveParty(party.id, party.name)} className="text-text-secondary hover:text-danger"><Trash2 size={14}/></button></div></td>{renderPartyRow(party, 'owedToUs', standardBins)}</tr>))}</tbody></table></div></div>
            <div className="flex-shrink-0 bg-bg-primary/50 rounded-lg overflow-hidden border border-border-primary"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-bg-primary"><tr>{renderBinTableHeader(mixedBins)}</tr></thead><tbody>{filteredOwedToUs.map(party => (<tr key={party.id} className="border-t border-border-primary">{renderPartyRow(party, 'owedToUs', mixedBins)}</tr>))}</tbody></table></div></div>
          </div>
      </div>

       {/* --- WE OWE --- */}
      <div className="pt-4">
          <div className="flex justify-between items-center mb-2"><h3 className="text-xl font-bold text-text-primary">We Owe</h3><button onClick={() => { setModal('addParty'); }} className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md bg-accent-secondary hover:bg-cyan-700 text-white font-semibold"><PlusCircle size={14}/> Add Party</button></div>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-grow bg-bg-primary/50 rounded-lg overflow-hidden border border-border-primary"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-bg-primary"><tr><th className="p-3 w-48 font-semibold text-text-secondary sticky left-0 bg-bg-primary z-10">PARTY</th>{renderBinTableHeader(standardBins)}</tr></thead><tbody>{filteredWeOwe.map(party => (<tr key={party.id} className="border-t border-border-primary"><td className="w-48 sticky left-0 bg-bg-secondary z-10 p-2"><div className="flex items-center justify-between"><span className="font-semibold text-white">{party.name}</span><button onClick={() => handleRemoveParty(party.id, party.name)} className="text-text-secondary hover:text-danger"><Trash2 size={14}/></button></div></td>{renderPartyRow(party, 'weOwe', standardBins)}</tr>))}</tbody></table></div></div>
            <div className="flex-shrink-0 bg-bg-primary/50 rounded-lg overflow-hidden border border-border-primary"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-bg-primary"><tr>{renderBinTableHeader(mixedBins)}</tr></thead><tbody>{filteredWeOwe.map(party => (<tr key={party.id} className="border-t border-border-primary">{renderPartyRow(party, 'weOwe', mixedBins)}</tr>))}</tbody></table></div></div>
          </div>
      </div>
      
      <TodaysMovementsSummary />
      
       {/* Log New Movement & Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        <div className="bg-bg-primary p-3 rounded-md border border-border-primary">
            <h3 className="text-sm font-semibold text-text-secondary mb-2">Log New Movement</h3>
            <form onSubmit={(e) => { e.preventDefault(); handleLogMovement(); }} className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                    <select value={newMovement.type} onChange={e => setNewMovement(p => ({...p, type: e.target.value as any}))} className="bg-bg-secondary border border-border-primary rounded-md p-2 text-white text-sm"><option value="sent">Sent</option><option value="received">Received</option><option value="returned">Returned</option></select>
                    <input type="number" value={newMovement.quantity} onChange={e => setNewMovement(p => ({...p, quantity: e.target.value === '' ? '' : Number(e.target.value)}))} placeholder="Quantity" required className="bg-bg-secondary border border-border-primary rounded-md p-2 text-white text-sm" />
                </div>
                <select value={newMovement.binId} onChange={e => setNewMovement(p => ({...p, binId: e.target.value}))} required className="w-full bg-bg-secondary border border-border-primary rounded-md p-2 text-white text-sm">
                    <option value="">Select Bin Type...</option>
                    {calculatedData.binTypes.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <input
                    type="text"
                    value={newMovement.binContents}
                    onChange={e => setNewMovement(p => ({...p, binContents: e.target.value}))}
                    placeholder="Bin Contents (e.g., Nartjie, Empty)"
                    className="w-full bg-bg-secondary border border-border-primary rounded-md p-2 text-white text-sm"
                />
                <input
                    list="parties-datalist"
                    value={newMovement.partyName}
                    onChange={e => setNewMovement(p => ({...p, partyName: e.target.value}))}
                    placeholder="Select or add a new party..."
                    required
                    className="w-full bg-bg-secondary border border-border-primary rounded-md p-2 text-white text-sm"
                />
                <datalist id="parties-datalist">
                    {allParties.map(p => <option key={p.id} value={p.name} />)}
                </datalist>
                
                <div className="flex gap-2">
                <input type="text" value={newMovement.transporter} onChange={e => setNewMovement(p => ({...p, transporter: e.target.value}))} placeholder="Transporter / Info (Optional)" className="flex-grow bg-bg-secondary border border-border-primary rounded-md p-2 text-white text-sm" />
                <button type="submit" className="p-2 bg-accent-primary hover:bg-purple-700 rounded-md text-white"><Save size={18}/></button>
                </div>
            </form>
        </div>
        <div className="bg-bg-primary p-3 rounded-md border border-border-primary">
            <h3 className="text-sm font-semibold text-text-secondary mb-2">Company / Farm Notes</h3>
            <textarea value={notes} onChange={handleNotesChange} rows={5} className="w-full bg-bg-secondary border border-border-primary rounded-md p-2 text-white placeholder-text-secondary focus:ring-2 focus:ring-accent-primary outline-none text-sm" placeholder="Enter notes..."/>
        </div>
      </div>
    </div>
  );
};

export default BinStockPage;