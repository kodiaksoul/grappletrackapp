'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

interface SearchableDropdownProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  personalOptions?: string[];
  placeholder: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  otherLabel?: string;
  /** Render a compact variant (smaller padding/font) for inline editing */
  compact?: boolean;
}

export default function SearchableDropdown({
  value,
  onChange,
  options,
  personalOptions = [],
  placeholder,
  allowEmpty = false,
  emptyLabel = '-- Select --',
  otherLabel = 'Other (Custom)',
  compact = false,
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return options;
    return options.filter((opt) => opt.toLowerCase().includes(query));
  }, [options, searchQuery]);

  const filteredPersonalOptions = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return personalOptions;
    return personalOptions.filter((opt) => opt.toLowerCase().includes(query));
  }, [personalOptions, searchQuery]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    setSearchQuery('');
  };

  const btnPadding = compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-xs';
  const itemPadding = compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-xs';

  return (
    <div className="relative w-full text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        className={`w-full bg-main border border-gray-800 rounded-lg ${btnPadding} text-primary focus:outline-none focus:border-neon text-left flex justify-between items-center transition-all duration-200`}
      >
        <span className="truncate">
          {value === 'Other'
            ? otherLabel
            : value === '' && allowEmpty
            ? emptyLabel
            : value || placeholder}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          className={`w-3.5 h-3.5 text-secondary flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 border border-gray-800 bg-main/95 backdrop-blur-md rounded-lg shadow-xl overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-800 bg-main/50">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full bg-surface border border-gray-800 rounded-md px-3 py-1.5 text-xs text-primary placeholder-gray-500 focus:outline-none focus:border-neon"
              autoFocus
            />
          </div>

          <div className="max-h-48 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-gray-800">
            {allowEmpty && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className={`w-full text-left ${itemPadding} hover:bg-neon/15 hover:text-neon transition-colors ${
                  value === '' ? 'bg-neon/10 text-neon font-semibold' : 'text-primary'
                }`}
              >
                {emptyLabel}
              </button>
            )}

            {filteredOptions.length === 0 && filteredPersonalOptions.length === 0 ? (
              <div className={`${itemPadding} text-secondary italic`}>No matches found</div>
            ) : (
              <>
                {filteredOptions.map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left ${itemPadding} hover:bg-neon/15 hover:text-neon transition-colors ${
                      value === opt ? 'bg-neon/10 text-neon font-semibold' : 'text-primary'
                    }`}
                  >
                    {opt}
                  </button>
                ))}

                {filteredPersonalOptions.length > 0 && (
                  <>
                    <div className="px-4 py-1 text-[9px] font-bold text-secondary uppercase tracking-widest bg-zinc-900/60 border-y border-gray-800/40 select-none">
                      Personal Dictionary
                    </div>
                    {filteredPersonalOptions.map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => {
                          onChange(opt);
                          setIsOpen(false);
                        }}
                        className={`w-full text-left ${itemPadding} hover:bg-neon/15 hover:text-neon transition-colors ${
                          value === opt ? 'bg-neon/10 text-neon font-semibold' : 'text-primary'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => {
                onChange('Other');
                setIsOpen(false);
              }}
              className={`w-full text-left ${itemPadding} border-t border-gray-800/50 hover:bg-neon/15 hover:text-neon transition-colors font-medium ${
                value === 'Other' ? 'bg-neon/10 text-neon font-semibold' : 'text-secondary'
              }`}
            >
              {otherLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
