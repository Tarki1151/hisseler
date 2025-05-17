import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import axios from 'axios';
import SearchBar from '../components/SearchBar';

const Chart = dynamic(() => import('../components/Chart'), { ssr: false });

type Product = {
  id: number;
  symbol: string;
  name: string;
  type: string;
};

type SearchResult = {
  symbol: string;
  name: string;
  type: string;
  region: string;
};

export default function Home() {
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeSymbol, setActiveSymbol] = useState<string>('AGNC');
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    axios.get('/api/products').then(res => setProducts(res.data));
  }, []);

  const handleAdd = async () => {
    if (!selected) return;
    setAddLoading(true);
    await axios.post('/api/products', {
      symbol: selected.symbol,
      name: selected.name,
      type: selected.type,
    });
    // 20 yıllık veri çekip DB'ye kaydet (arka planda)
    await axios.get(`/api/yahoo-chart?symbol=${selected.symbol}&store=1`);
    setAddLoading(false);
    setSelected(null);
    axios.get('/api/products').then(res => setProducts(res.data));
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-50">
      <Head>
        <title>Hisse/ETF Takip</title>
        <meta name="description" content="AGNC grafiği ile hisse/ETF takip uygulaması" />
      </Head>
      <main className="w-full max-w-2xl p-4 flex flex-col gap-8">
        <h1 className="text-2xl font-bold text-center">Hisse/ETF Takip Uygulaması</h1>
        <div className="bg-white rounded shadow p-4 mb-4">
          <SearchBar onSelect={item => {
            setSelected(item);
            setActiveSymbol('');
          }} />
          {selected && (
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{selected.symbol}</span> - {selected.name}
                <button
                  className="ml-auto px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
                  disabled={addLoading}
                  onClick={handleAdd}
                >
                  {addLoading ? 'Ekleniyor...' : 'Add'}
                </button>
              </div>
              <Chart symbol={selected.symbol} />
            </div>
          )}
        </div>
        <div className="bg-white rounded shadow p-4">
          <h2 className="text-lg font-semibold mb-2">Takip Listeniz</h2>
          <ul className="divide-y max-h-60 overflow-y-auto" style={{ minHeight: '0px' }}>
            {products.map(product => (
              <li
                key={product.symbol + '-' + product.type}
                className={`flex items-center py-2 px-2 rounded ${activeSymbol === product.symbol ? 'bg-blue-100' : ''}`}
              >
                <span
                  className="flex-1 cursor-pointer"
                  onClick={() => {
                    setActiveSymbol(product.symbol);
                    setSelected(null);
                  }}
                >
                  <span className="font-semibold">{product.symbol}</span> - {product.name}
                </span>
                <button
                  className="ml-2 text-red-500 hover:text-red-700 text-lg"
                  title="Sil"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await axios.delete('/api/products', { data: { id: product.id } });
                    setProducts(products => products.filter(p => p.id !== product.id));
                    if (activeSymbol === product.symbol) setActiveSymbol('');
                  }}
                >
                  🗑️
                </button>
              </li>
            ))}
          </ul>
        </div>
        {(!selected && activeSymbol) && (
          <div className="bg-white rounded shadow p-4">
            <h2 className="text-lg font-semibold mb-2">Grafik</h2>
            <Chart symbol={activeSymbol} />
          </div>
        )}
      </main>
    </div>
  );
}
