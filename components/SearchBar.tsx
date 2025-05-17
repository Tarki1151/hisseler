import { useState } from 'react';
import axios from 'axios';

type ResultItem = {
  symbol: string;
  name: string;
  type: string;
  region: string;
};

type Props = {
  onSelect: (item: ResultItem) => void;
};

export default function SearchBar({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (q: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/search?query=${encodeURIComponent(q)}`);
      setResults(res.data.results || []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  };

  return (
    <div className="relative w-full">
      <input
        className="w-full border px-3 py-2 rounded"
        placeholder="Hisse/ETF ara (örn. AGNC, AAPL, QQQ)"
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          if (e.target.value.length > 1) handleSearch(e.target.value);
          else setResults([]);
        }}
      />
      {loading && <div className="absolute right-2 top-2 text-xs">...</div>}
      {results.length > 0 && (
        <ul className="absolute w-full bg-white border rounded mt-1 z-10 max-h-64 overflow-y-auto">
          {results.filter(item => item.symbol && item.type).map(item => (
            <li
              key={item.symbol + '-' + item.type}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
              onClick={() => {
                onSelect(item);
                setQuery('');
                setResults([]);
              }}
            >
              <span className="font-semibold">{item.symbol}</span> - {item.name} <span className="text-xs text-gray-500">({item.type})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
