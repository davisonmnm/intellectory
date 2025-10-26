
import React from 'react';

interface SummaryCardsProps {
  stats: {
    totalRemaining: number;
    totalStockValue: number;
    lowStockCount: number;
    totalItems: number;
  };
  onLowStockClick: () => void;
}

const SummaryCard: React.FC<{ title: string; value: string; color: string; subtext?: string; onClick?: () => void }> = ({ title, value, color, subtext, onClick }) => {
  const isClickable = !!onClick;
  return (
    <div 
      className={`bg-bg-secondary p-2.5 rounded-lg border-l-4 ${color} flex-shrink-0 w-40 sm:w-48 ${isClickable ? 'cursor-pointer hover:bg-border-primary transition-colors' : ''}`}
      onClick={onClick}
    >
      <p className="text-sm text-text-secondary truncate">{title}</p>
      <p className="text-2xl font-bold text-white truncate">{value}</p>
      {subtext && <p className="text-xs text-text-secondary">{subtext}</p>}
    </div>
  );
};

const SummaryCards: React.FC<SummaryCardsProps> = ({ stats, onLowStockClick }) => {
  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      <SummaryCard 
        title="Total Remaining" 
        value={stats.totalRemaining.toLocaleString()} 
        color="border-accent-primary" 
      />
      <SummaryCard 
        title="Stock Value (R)" 
        value={stats.totalStockValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
        color="border-accent-secondary" 
      />
      <SummaryCard 
        title="Low Stock" 
        value={`${stats.lowStockCount} items`}
        color="border-warning"
        onClick={stats.lowStockCount > 0 ? onLowStockClick : undefined}
      />
      <SummaryCard 
        title="Total Items" 
        value={`${stats.totalItems} items`}
        color="border-success"
      />
    </div>
  );
};

export default SummaryCards;
