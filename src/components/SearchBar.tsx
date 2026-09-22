import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [showHelper, setShowHelper] = useState(false);

  const handleChange = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  const addChip = (token: string) => {
    const next = query ? `${query.trim()} ${token}` : token;
    handleChange(next);
  };

  return (
    <div className="relative group">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setShowHelper(true)}
          onBlur={() => setTimeout(() => setShowHelper(false), 200)}
          placeholder="Search... (e.g. starts:B, len:5, type:Base)"
          className="pl-9 pr-9 h-9 text-xs"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleClear}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      {/* Quick Filter Chips Helper */}
      {showHelper && (
        <div className="absolute left-0 top-10 z-50 p-2.5 bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-xl space-y-1.5 w-72 text-[10px]">
          <p className="font-semibold text-foreground flex items-center justify-between">
            <span>⚡ Smart Search Filters</span>
            <span className="text-[9px] text-muted-foreground font-normal">Click to insert</span>
          </p>
          <div className="flex flex-wrap gap-1">
            {[
              { label: 'starts:B', desc: 'Starts with B' },
              { label: 'ends:01', desc: 'Ends with 01' },
              { label: 'len:5', desc: 'Length = 5' },
              { label: 'len>5', desc: 'Length > 5' },
              { label: 'type:Base', desc: 'Type is Base' },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => addChip(chip.label)}
                className="px-1.5 py-0.5 rounded border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-mono font-medium transition-colors"
                title={chip.desc}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
