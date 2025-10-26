

import React, { useState, useMemo, useEffect } from 'react';
import { ActivityLogEntry } from '../types';
import { Calendar, FilterX } from 'lucide-react';

interface HistoryPageProps {
  history: ActivityLogEntry[];
  selectedDate?: string;
}

const HistoryPage: React.FC<HistoryPageProps> = ({ history, selectedDate }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (selectedDate) {
        setStartDate(selectedDate);
        setEndDate(selectedDate);
    }
  }, [selectedDate]);

  const filteredHistory = useMemo(() => {
    return history.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      if (startDate) {
        const filterStartDate = new Date(startDate + "T00:00:00");
        if (entryDate < filterStartDate) return false;
      }
      if (endDate) {
        const filterEndDate = new Date(endDate + "T23:59:59");
        if (entryDate > filterEndDate) return false;
      }
      return true;
    });
  }, [history, startDate, endDate]);

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="bg-bg-secondary rounded-lg p-4 space-y-3">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <h2 className="text-2xl font-bold text-white">Transaction History</h2>
        <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
                <label className="text-xs text-text-secondary absolute -top-2 left-3 bg-bg-secondary px-1">From</label>
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                <input 
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="bg-bg-primary border border-border-primary rounded-md pl-9 pr-2 py-1.5 text-white"
                />
            </div>
            <div className="relative">
                 <label className="text-xs text-text-secondary absolute -top-2 left-3 bg-bg-secondary px-1">To</label>
                 <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                 <input 
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="bg-bg-primary border border-border-primary rounded-md pl-9 pr-2 py-1.5 text-white"
                />
            </div>
            <button onClick={resetFilters} className="flex items-center gap-2 bg-border-primary hover:bg-gray-700 text-white font-semibold px-3 py-1.5 rounded-md transition-colors" title="Reset Filters">
                <FilterX size={16}/>
            </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-text-primary">
          <thead className="bg-bg-primary">
            <tr>
              <th className="p-2">Timestamp</th>
              <th className="p-2">User</th>
              <th className="p-2">Item Name</th>
              <th className="p-2">Change / Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.length > 0 ? filteredHistory.map(entry => (
              <tr key={entry.id} className="border-b border-border-primary hover:bg-bg-primary">
                <td className="p-2 whitespace-nowrap">{new Date(entry.timestamp).toLocaleString()}</td>
                <td className="p-2">{entry.users?.full_name || 'System Action'}</td>
                <td className="p-2">{entry.item_name}</td>
                <td className="p-2">{entry.change_description}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="text-center p-8 text-text-secondary">
                    <p className="font-semibold">No History Found</p>
                    <p>Try adjusting or clearing your date filters.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistoryPage;