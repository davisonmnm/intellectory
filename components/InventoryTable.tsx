import React, { useState, useMemo, useEffect } from 'react';
import { StockItem, EditableStockItemKey } from '../types';
import { Edit2, Trash2, Search, Send, Loader, Table, List, FileText, History as HistoryIcon } from 'lucide-react';

type InventoryViewMode = 'table' | 'card';
type View = 'dashboard' | 'binStock' | 'history' | 'settings';

interface InventoryTableProps {
  data: (StockItem & { used: number; remaining: number; stockValue: number })[];
  onUpdate: (itemId: string, field: EditableStockItemKey, value: number) => void;
  onCommand: (command: string) => void;
  isLoading: boolean;
  onEditClick: (itemId: string) => void;
  onDeleteClick: (itemId: string) => void;
  viewMode: InventoryViewMode;
  setViewMode: (mode: InventoryViewMode) => void;
  onOpenReport: () => void;
  onNavigate: (view: 'history' | 'settings' | 'dashboard' | 'binStock') => void;
  currentView: View;
}

const metrics: { key: keyof (StockItem & { used: number; remaining: number; stockValue: number }); label: string; editable: boolean; calculated?: boolean, highlight?: string }[] = [
  { key: 'opening_stock', label: 'OPENING STOCK', editable: false },
  { key: 'added_today', label: 'Added Today', editable: true },
  { key: 'packed', label: 'Packed', editable: true },
  { key: 'lost', label: 'Lost', editable: true },
  { key: 'used', label: 'USED', editable: false, calculated: true, highlight: 'text-orange-400' },
  { key: 'remaining', label: 'REMAINING', editable: false, calculated: true, highlight: 'text-yellow-400 font-bold' },
  { key: 'alert_level', label: 'Alert Level', editable: true },
  { key: 'price', label: 'PRICE (R)', editable: true },
  { key: 'stockValue', label: 'STOCK VALUE (R)', editable: false, calculated: true, highlight: 'text-green-400 font-bold' },
];

const EditableCell: React.FC<{item: any, mKey: EditableStockItemKey, onUpdate: any, className?: string}> = ({item, mKey, onUpdate, className=""}) => {
    const [inputValue, setInputValue] = useState(String(item[mKey] ?? ''));
    const [isValid, setIsValid] = useState(true);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    const handleBlur = () => {
        const rawValue = inputValue.trim();
        const originalValue = item[mKey];

        if (rawValue === '') {
            if (originalValue !== 0) onUpdate(item.id, mKey, 0);
            setInputValue('0');
            setIsValid(true);
            return;
        }

        const numValue = parseFloat(rawValue);
        
        if (isNaN(numValue) || numValue < 0) {
            setIsValid(false);
            setTimeout(() => {
                setInputValue(String(originalValue ?? ''));
                setIsValid(true);
            }, 1500);
        } else {
            setIsValid(true);
            if (numValue !== originalValue) {
                onUpdate(item.id, mKey, numValue);
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        } else if (e.key === 'Escape') {
            setInputValue(String(item[mKey] ?? ''));
            setIsValid(true);
            e.currentTarget.blur();
        }
    };

    useEffect(() => {
        setInputValue(String(item[mKey] ?? ''));
    }, [item, mKey]);

    return (
        <input
            type="text"
            value={inputValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onFocus={(e) => e.target.select()}
            className={`bg-transparent w-full h-full text-white outline-none rounded-sm transition-shadow ${className}
                        ${!isValid ? 'ring-2 ring-danger' : 'focus:ring-2 focus:ring-accent-primary'}`}
        />
    );
}

const CommandBar: React.FC<{ 
    searchTerm: string;
    setSearchTerm: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    isLoading: boolean; 
}> = ({ searchTerm, setSearchTerm, onSubmit, isLoading }) => {
    return (
        <form onSubmit={onSubmit} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
            <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name, or use cat:Groenkloof price:>5..."
                className="w-full bg-bg-secondary border border-border-primary rounded-md pl-10 pr-14 py-2 text-white placeholder-text-secondary focus:ring-2 focus:ring-accent-primary outline-none"
                disabled={isLoading}
            />
            <button type="submit" title="Ask a Question" className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center bg-accent-primary hover:bg-purple-700 text-white font-semibold p-1.5 rounded-md transition-colors disabled:bg-border-primary disabled:cursor-not-allowed" disabled={isLoading || !searchTerm.trim()}>
                {isLoading ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
        </form>
    )
}

const NoResults: React.FC = () => (
    <div className="text-center py-16 px-4 bg-bg-secondary rounded-lg border border-border-primary">
        <Search size={48} className="mx-auto text-border-primary" />
        <h3 className="mt-4 text-xl font-bold text-white">No Matching Items Found</h3>
        <p className="mt-1 text-text-secondary">Try adjusting your search terms or filters.</p>
    </div>
);

const TableView: React.FC<Omit<InventoryTableProps, 'viewMode' | 'setViewMode' | 'onCommand' | 'isLoading' | 'onOpenReport' | 'onNavigate' | 'currentView'>> = ({ data, onUpdate, onEditClick, onDeleteClick }) => {
    if (data.length === 0) return <NoResults />;
    return (
    <div className="bg-bg-secondary rounded-lg overflow-hidden border border-border-primary">
    <div className="flex">
      <div className="flex-shrink-0 w-32 md:w-40 border-r border-border-primary">
        <div className="h-20 bg-bg-primary flex items-center p-2 md:p-3 border-b-2 border-border-primary">
          <span className="font-bold text-sm md:text-base">METRIC</span>
        </div>
        {metrics.map(metric => (
          <div key={metric.key} className="h-11 flex items-center p-2 md:p-3 border-b border-border-primary transition-colors hover:bg-bg-primary">
            <span className={`text-xs font-semibold ${metric.highlight ? metric.highlight.split(' ')[0] : 'text-text-secondary'}`}>{metric.label}</span>
          </div>
        ))}
      </div>
      <div className="flex-grow overflow-x-auto">
        <div className="flex">
          {data.map((item, index) => (
            <div key={item.id} className={`w-32 md:w-40 flex-shrink-0 ${index < data.length - 1 ? 'border-r border-border-primary' : ''}`}>
              <div className="h-20 bg-bg-primary flex flex-col justify-center items-center p-2 text-center relative border-b-2 border-border-primary">
                <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: item.color }}></div>
                <div className="absolute top-0 left-0 h-full w-1" style={{ backgroundColor: item.color }}></div>
                <div className="relative z-10 flex items-center justify-center gap-2 mb-1 flex-grow"><span className="font-bold text-white text-sm text-center leading-tight whitespace-normal break-words">{item.name}</span></div>
                <div className="relative z-10 flex items-center gap-2 mt-auto text-text-secondary">
                  <button onClick={() => onEditClick(item.id)} className="hover:text-white" title="Edit Item"><Edit2 size={12}/></button>
                  <button onClick={() => onDeleteClick(item.id)} className="hover:text-danger" title="Delete Item"><Trash2 size={12}/></button>
                </div>
              </div>
              {metrics.map(metric => (
                <div key={`${item.id}-${metric.key}`} className="h-11 flex items-center justify-center p-0 border-b border-border-primary bg-bg-secondary/50 transition-colors hover:bg-bg-primary">
                  {metric.editable ? (
                    <EditableCell item={item} mKey={metric.key as EditableStockItemKey} onUpdate={onUpdate} className="text-center" />
                  ) : (
                    <span className={`font-medium text-sm px-2 ${metric.highlight || 'text-white'}`}>
                      {typeof item[metric.key] === 'number' ? (item[metric.key] as number).toLocaleString(undefined, { minimumFractionDigits: (item[metric.key] as number) % 1 !== 0 ? 2 : 0, maximumFractionDigits: 4 }) : item[metric.key]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
    );
};

const CardView: React.FC<Omit<InventoryTableProps, 'viewMode' | 'setViewMode' | 'onCommand' | 'isLoading' | 'onOpenReport' | 'onNavigate' | 'currentView'>> = ({ data, onUpdate, onEditClick, onDeleteClick }) => {
    const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

    if (data.length === 0) return <NoResults />;
    
    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
            {data.map(item => {
                const isExpanded = item.id === expandedCardId;
                return (
                    <div key={item.id} className="bg-bg-secondary rounded-lg border border-border-primary border-l-4" style={{ borderLeftColor: item.color }}>
                        <div className="p-3 flex justify-between items-start border-b border-border-primary">
                            <h3 onClick={() => setExpandedCardId(isExpanded ? null : item.id)} className="font-bold text-white break-words mr-2 cursor-pointer">{item.name}</h3>
                            <div className="flex items-center gap-3 text-text-secondary flex-shrink-0">
                                <button onClick={(e) => { e.stopPropagation(); onEditClick(item.id); }} className="hover:text-white" title="Edit Item"><Edit2 size={16}/></button>
                                <button onClick={(e) => { e.stopPropagation(); onDeleteClick(item.id); }} className="hover:text-danger" title="Delete Item"><Trash2 size={16}/></button>
                            </div>
                        </div>
                        <div onClick={() => setExpandedCardId(isExpanded ? null : item.id)} className="cursor-pointer transition-all duration-300 ease-in-out">
                            {isExpanded ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 p-3">
                                    {metrics.map(metric => (
                                        <div key={metric.key} className={`flex items-center justify-between text-sm ${metric.calculated ? 'bg-bg-primary/50 p-2 rounded-md' : ''}`}>
                                            <span className={`text-xs font-semibold ${metric.highlight ? metric.highlight.split(' ')[0] : 'text-text-secondary'}`}>{metric.label}</span>
                                            {metric.editable ? (
                                                <EditableCell item={item} mKey={metric.key as EditableStockItemKey} onUpdate={onUpdate} className="text-right w-20" />
                                            ) : (
                                                <span className={`font-medium ${metric.highlight || 'text-white'}`}>
                                                    {typeof item[metric.key] === 'number' ? (item[metric.key] as number).toLocaleString() : item[metric.key]}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-3 space-y-2">
                                    <div>
                                        <p className="text-xs text-text-secondary">Remaining</p>
                                        <p className="font-bold text-white text-lg">{item.remaining.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary">Stock Value (R)</p>
                                        <p className="font-bold text-green-400 text-lg">{item.stockValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};


const InventoryTable: React.FC<InventoryTableProps> = (props) => {
  const { data, viewMode, setViewMode, onOpenReport, onNavigate, currentView } = props;
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    const lowercasedFilter = searchTerm.toLowerCase().trim();
    if (!lowercasedFilter) {
      return data;
    }

    const terms = lowercasedFilter.split(' ').filter(t => t);
    const nameTerms: string[] = [];
    const fieldFilters: { key: string; operator: string; value: string | number; value2?: number }[] = [];

    // Parse search terms for keywords like 'cat:books' or 'price:>10'
    terms.forEach(term => {
      const numericMatch = term.match(/^(\w+):([<>]?)(\d*\.?\d+)-?(\d*\.?\d+)?$/);
      if (numericMatch) {
        const [, key, operator, value1, value2] = numericMatch;
        if (value2) { // Range like price:50-100
          fieldFilters.push({ key, operator: 'range', value: parseFloat(value1), value2: parseFloat(value2) });
        } else { // Simple numeric like price:>50 or price:50
          fieldFilters.push({ key, operator: operator || '=', value: parseFloat(value1) });
        }
      } else if (term.includes(':')) { // Text search like cat:deons
        const [key, ...valueParts] = term.split(':');
        fieldFilters.push({ key, operator: '=', value: valueParts.join(':') });
      } else { // It's part of the name search
        nameTerms.push(term);
      }
    });

    return data.filter(item => {
      // 1. Match against name (fuzzy search)
      const nameMatch = nameTerms.every(term => item.name.toLowerCase().includes(term));
      if (!nameMatch) return false;

      // 2. Match against all field filters
      const fieldMatch = fieldFilters.every(filter => {
        let itemValue: string | number | undefined;
        // Map filter keys to actual item properties
        switch (filter.key) {
          case 'cat':
          case 'category':
            itemValue = item.category.toLowerCase();
            break;
          case 'price':
            itemValue = item.price;
            break;
          case 'remaining':
            itemValue = item.remaining;
            break;
          case 'value':
            itemValue = item.stockValue;
            break;
          default:
            return true; // Ignore unknown filter keys
        }
        if (itemValue === undefined) return false;

        if (typeof itemValue === 'string') {
            return itemValue.includes(String(filter.value));
        }
        
        if (typeof itemValue === 'number') {
            const filterValue1 = filter.value as number;
            switch (filter.operator) {
                case '>': return itemValue > filterValue1;
                case '<': return itemValue < filterValue1;
                case '=': return itemValue === filterValue1;
                case 'range': return itemValue >= filterValue1 && itemValue <= (filter.value2 as number);
                default: return false;
            }
        }
        return false;
      });

      return fieldMatch;
    });
  }, [data, searchTerm]);

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    props.onCommand(searchTerm);
    // Don't clear search term, user might want to see the command they just ran
  };
  
  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-center gap-3 mb-3">
        <div className="w-full flex-grow">
          <CommandBar 
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onSubmit={handleCommandSubmit}
            isLoading={props.isLoading}
          />
        </div>
        <div className="w-full md:w-auto flex-shrink-0 flex items-center gap-2">
          <button onClick={onOpenReport} className="flex-1 flex justify-center items-center gap-2 bg-border-primary hover:bg-gray-700 text-white font-semibold px-3 py-1.5 rounded-md transition-colors text-sm">
            <FileText size={16}/> Report
          </button>
          <button 
            onClick={() => onNavigate('history')} 
            className={`flex-1 flex justify-center items-center gap-2 font-semibold px-3 py-1.5 rounded-md transition-colors text-sm ${currentView === 'history' ? 'bg-accent-primary text-white' : 'bg-border-primary hover:bg-gray-700 text-white'}`}>
            <HistoryIcon size={16}/> History
          </button>
          <div className="items-center ml-2 flex">
              <button onClick={() => setViewMode(viewMode === 'table' ? 'card' : 'table')} className="p-2 rounded-md bg-bg-secondary border border-border-primary text-text-secondary">
                  {viewMode === 'table' ? <List size={20}/> : <Table size={20}/>}
              </button>
          </div>
        </div>
      </div>
      
      {viewMode === 'table' && <TableView {...props} data={filteredData} />}
      {viewMode === 'card' && <CardView {...props} data={filteredData} />}
    </div>
  );
};

export default InventoryTable;