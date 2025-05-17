import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi } from 'lightweight-charts';
import axios from 'axios';

type Interval = '1d' | '1wk' | '1mo';

function DividendBox({ symbol }: { symbol: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dividends, setDividends] = useState<{date: string, amount: number, currency: string, description: string}[]>([]);
  const [price, setPrice] = useState<number|null>(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const [priceError, setPriceError] = useState('');

  // Temettü verilerini çek
  useEffect(() => {
    setLoading(true);
    setError('');
    setDividends([]);
    axios.get(`/api/dividends?symbol=${symbol}`)
      .then(res => {
        setDividends(res.data.dividends || []);
        setLoading(false);
      })
      .catch(err => {
        setError('Temettü verisi alınamadı.');
        setLoading(false);
      });
  }, [symbol]);

  // Güncel fiyatı: Son günün kapanış fiyatı olarak al
  useEffect(() => {
    setPriceLoading(true);
    setPriceError('');
    setPrice(null);
    axios.get(`/api/yahoo-chart?symbol=${symbol}&interval=1d&range=1y`)
      .then(res => {
        const data = res.data;
        if (Array.isArray(data) && data.length > 0) {
          const last = data[data.length - 1];
          if (typeof last.close === 'number') setPrice(last.close);
          else setPriceError('Fiyat alınamadı.');
        } else {
          setPriceError('Fiyat alınamadı.');
        }
        setPriceLoading(false);
      })
      .catch(() => {
        setPriceError('Fiyat alınamadı.');
        setPriceLoading(false);
      });
  }, [symbol]);

  // Temettü verimi: Bugünden tam 1 yıl öncesine kadar olan tüm temettülerin (net, %20 vergi düşülerek) toplamı / son kapanış fiyatı
  let annualNetDividend = 0;
  if (dividends.length > 0) {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime());
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    const lastYearDivs = dividends.filter(d => {
      const dt = new Date(d.date);
      return dt >= oneYearAgo && dt <= now;
    });
    annualNetDividend = lastYearDivs.reduce((acc, d) => acc + d.amount * 0.8, 0);
  }
  let yieldPct = null;
  if (price && annualNetDividend > 0) {
    yieldPct = (annualNetDividend / price) * 100;
  }

  return (
    <div className="w-full bg-white rounded shadow p-4 mt-4 border border-gray-200">
      <div className="flex flex-col gap-1 mb-2">
        <div className="font-bold text-base text-green-700">
          Yıllık Temettü Verimi: {priceLoading ? '...' : (yieldPct !== null ? yieldPct.toFixed(2) + '%' : 'Hesaplanamadı')}
        </div>
        <div className="text-xs text-gray-500">
          (Son 1 yıl içindeki tüm ödemelerin toplamı, %20 vergi sonrası: {annualNetDividend.toFixed(2)} {dividends[0]?.currency || ''} / Son kapanış fiyatı: {price !== null ? price : '...'} {dividends[0]?.currency || ''})
        </div>
      </div>
      <div className="font-semibold mb-2 text-sm text-amber-700">Son 52 Temettü</div>
      {loading && <div className="text-xs text-gray-500">Yükleniyor...</div>}
      {error && <div className="text-xs text-red-500">{error}</div>}
      {!loading && !error && dividends.length === 0 && (
        <div className="text-xs text-gray-500">Temettü verisi bulunamadı.</div>
      )}
      {!loading && !error && dividends.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-[320px] text-xs">
            <thead>
              <tr className="text-gray-700 bg-gray-50">
                <th className="px-2 py-1 text-left">Tarih</th>
                <th className="px-2 py-1 text-right">Tutar</th>
                <th className="px-2 py-1 text-left">Para Birimi</th>
              </tr>
            </thead>
            <tbody>
              {dividends.slice(0, 52).map((d, i) => (
                <tr key={d.date + '-' + i} className="border-b last:border-0">
                  <td className="px-2 py-1 whitespace-nowrap">{d.date}</td>
                  <td className="px-2 py-1 text-right">{d.amount}</td>
                  <td className="px-2 py-1">{d.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AnalystBox({ symbol }: { symbol: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<{
    recommendations: { buy: number; hold: number; sell: number; };
    priceTargets: { low: number|null; high: number|null; mean: number|null; median: number|null; }
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    setData(null);
    axios.get(`/api/analyst?symbol=${symbol}`)
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Analist verisi alınamadı.');
        setLoading(false);
      });
  }, [symbol]);

  return (
    <div className="w-full bg-white rounded shadow p-4 mt-4 border border-gray-200">
      <div className="font-semibold mb-2 text-sm text-blue-700">Analist Önerileri ve Hedef Fiyatlar</div>
      {loading && <div className="text-xs text-gray-500">Yükleniyor...</div>}
      {error && <div className="text-xs text-red-500">{error}</div>}
      {!loading && !error && data && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-4 text-xs">
            <span className="bg-green-100 text-green-700 px-2 py-1 rounded">Al: <b>{data.recommendations.buy}</b></span>
            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">Tut: <b>{data.recommendations.hold}</b></span>
            <span className="bg-red-100 text-red-700 px-2 py-1 rounded">Sat: <b>{data.recommendations.sell}</b></span>
          </div>
          <div className="flex flex-wrap gap-4 text-xs mt-2">
            <span>En Düşük Hedef: <b>{data.priceTargets.low !== null ? data.priceTargets.low : '-'}</b></span>
            <span>En Yüksek Hedef: <b>{data.priceTargets.high !== null ? data.priceTargets.high : '-'}</b></span>
            <span>Ortalama Hedef: <b>{data.priceTargets.mean !== null ? data.priceTargets.mean : '-'}</b></span>
            <span>Medyan Hedef: <b>{data.priceTargets.median !== null ? data.priceTargets.median : '-'}</b></span>
          </div>
        </div>
      )}
      {!loading && !error && !data && (
        <div className="text-xs text-gray-500">Analist verisi bulunamadı.</div>
      )}
    </div>
  );
}

export default function Chart({ symbol }: { symbol: string }) {
  const [showFibo, setShowFibo] = useState(false);
  const fiboLinesRef = useRef<any[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const rsiChartInstance = useRef<IChartApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [interval, setInterval] = useState<Interval>('1d');

  useEffect(() => {
    setLoading(true);
    setError('');
    // Eski chart varsa kaldır
    if (chartInstance.current) {
      chartInstance.current.remove();
      chartInstance.current = null;
    }
    if (rsiChartInstance.current) {
      rsiChartInstance.current.remove();
      rsiChartInstance.current = null;
    }
    // chartRef ve rsiRef içini temizle
    if (chartRef.current) {
      while (chartRef.current.firstChild) {
        chartRef.current.removeChild(chartRef.current.firstChild);
      }
    }
    if (rsiRef.current) {
      while (rsiRef.current.firstChild) {
        rsiRef.current.removeChild(rsiRef.current.firstChild);
      }
    }
    axios.get(`/api/yahoo-chart?symbol=${symbol}&interval=${interval}`)
      .then(res => {
        if (!chartRef.current || !rsiRef.current) return;
        if (!res.data || !Array.isArray(res.data) || res.data.length === 0) {
          setError('Veri bulunamadı.');
          setLoading(false);
          return;
        }
        // RSI hesapla (interval'e göre periyot: günlükte 14 gün, haftalıkta 14 hafta, aylıkta 14 ay)
        const calcRSI = (data: any[], period = 14) => {
          const rsi: { time: string, value: number }[] = [];
          let gains = 0, losses = 0;
          for (let i = 1; i <= period; i++) {
            const diff = data[i].close - data[i - 1].close;
            if (diff >= 0) gains += diff; else losses -= diff;
          }
          gains /= period;
          losses /= period;
          rsi[period] = {
            time: new Date(data[period].time * 1000).toISOString().slice(0, 10),
            value: losses === 0 ? 100 : 100 - 100 / (1 + gains / losses)
          };
          for (let i = period + 1; i < data.length; i++) {
            const diff = data[i].close - data[i - 1].close;
            let gain = diff > 0 ? diff : 0;
            let loss = diff < 0 ? -diff : 0;
            gains = (gains * (period - 1) + gain) / period;
            losses = (losses * (period - 1) + loss) / period;
            rsi[i] = {
              time: new Date(data[i].time * 1000).toISOString().slice(0, 10),
              value: losses === 0 ? 100 : 100 - 100 / (1 + gains / losses)
            };
          }
          return rsi.filter(Boolean);
        };
        // Zaman aralığına göre RSI periyodu belirle
        let rsiPeriod = 14;
        // interval: '1d' (günlük), '1wk' (haftalık), '1mo' (aylık)
        if (interval === '1d') rsiPeriod = 14;
        else if (interval === '1wk') rsiPeriod = 14;
        else if (interval === '1mo') rsiPeriod = 14;
        const rsiData = calcRSI(res.data, rsiPeriod);
        // Fiyat ana grafik
        const chart = createChart(chartRef.current, { width: chartRef.current.offsetWidth, height: 400, layout: { background: { color: '#fff' } } });
        chartInstance.current = chart;
        const series = chart.addCandlestickSeries();
        series.setData(res.data);
        // Fibonacci çizgileri eklemeden önce önceki çizgileri sil
        if (fiboLinesRef.current && fiboLinesRef.current.length > 0) {
          fiboLinesRef.current.forEach((line: any) => {
            if (line && typeof line.remove === 'function') line.remove();
          });
          fiboLinesRef.current = [];
        }
        if (!res.data || !Array.isArray(res.data) || res.data.length === 0) {
          setError('Veri bulunamadı veya sembol geçersiz.');
          setLoading(false);
          return;
        }
        if (showFibo && chart && series) {
          // Grafikte görünen aralığın en yüksek ve en düşük fiyatını bul
          const timeScale = chart.timeScale();
          const visibleRange = timeScale.getVisibleRange();
          if (!visibleRange) return;
          const barsInRange = res.data.filter((bar: any) => bar.time >= visibleRange.from && bar.time <= visibleRange.to);
          if (barsInRange.length === 0) return;
          const high = Math.max(...barsInRange.map((b: any) => b.high));
          const low = Math.min(...barsInRange.map((b: any) => b.low));
          const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
          const colors = ['#1976d2', '#388e3c', '#fbc02d', '#ff9800', '#e53935', '#8e24aa', '#455a64'];
          fiboLinesRef.current = levels.map((level, idx) => {
            const price = high - (high - low) * level;
            return series.createPriceLine({
              price,
              color: colors[idx],
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: `Fibo ${level}`
            });
          });
        } else {
          // Önceki fibo çizgilerini kaldır
          if (fiboLinesRef.current && fiboLinesRef.current.length > 0) {
            fiboLinesRef.current.forEach((line: any) => line.remove());
            fiboLinesRef.current = [];
          }
        }
        // 200 günlük SMA hesapla ve ekle (her zaman aralığında 200 gün üzerinden)
        const calcSMA200Gunluk = (data: any[], interval: string) => {
          // 1d ise zaten doğrudan 200 günlük
          if (interval === '1d') {
            const sma: { time: string, value: number }[] = [];
            for (let i = 199; i < data.length; i++) {
              const sum = data.slice(i - 199, i + 1).reduce((acc, d) => acc + d.close, 0);
              sma.push({ time: new Date(data[i].time * 1000).toISOString().slice(0, 10), value: sum / 200 });
            }
            return sma;
          }
          // Haftalık veya aylık: Her veri noktasında, o haftanın/ayın son günü dahil, geriye doğru 200 günün ortalamasını al
          const sma: { time: string, value: number }[] = [];
          for (let i = 0; i < data.length; i++) {
            const endTime = data[i].time;
            // 200 gün öncesine kadar olan günleri bul
            const daysBack = 200;
            // Tüm günlük veriyi çekmek için API'den alınan data'da sadece haftalık/aylık varsa, burada DB'den günlük veriye erişmek gerekir. Ama şu an sadece gelen data ile çalışıyoruz.
            // Yani haftalık/aylıkta, her veri noktasında, o noktanın time'ı <= t <= (time - 200 gün) olan kapanışların ortalamasını al
            // Ancak veri sadece haftalık/aylık ise, bu durumda 200 veri değil, 200 gün öncesini kapsayan kadar veri alınabilir.
            // Yani, haftalıkta her nokta için, 200 gün öncesinden bugüne kadar olan data'daki close'ların ortalaması alınır.
            const MS_PER_DAY = 24 * 60 * 60;
            const startTime = endTime - daysBack * MS_PER_DAY;
            const relevant = data.filter(d => d.time >= startTime && d.time <= endTime);
            if (relevant.length > 0) {
              const sum = relevant.reduce((acc, d) => acc + d.close, 0);
              sma.push({ time: new Date(data[i].time * 1000).toISOString().slice(0, 10), value: sum / relevant.length });
            }
          }
          return sma;
        };
        const smaData = calcSMA200Gunluk(res.data, interval);
        const smaLine = chart.addLineSeries({ color: '#1976d2', lineWidth: 2 });
        smaLine.setData(smaData);
        // RSI ayrı chart
        const rsiChart = createChart(rsiRef.current, { 
          width: chartRef.current.offsetWidth, 
          height: 100, 
          layout: { background: { color: '#fff' } }, 
          rightPriceScale: { 
            visible: true, 
            scaleMargins: { top: 0.15, bottom: 0.15 } 
          } 
        });
        rsiChartInstance.current = rsiChart;
        
        // RSI değerine göre renk belirle
        const coloredRSIData = rsiData.map(item => ({
          ...item,
          color: item.value > 70 ? '#ff4d4f' : item.value < 30 ? '#52c41a' : '#a259ec'
        }));
        
        // RSI çizgisi
        const rsiLine = rsiChart.addLineSeries({ 
          color: '#a259ec', 
          lineWidth: 2,
          lastValueVisible: true,
          priceLineVisible: true
        });
        
        // RSI çizgisini renklendirilmiş veriyle güncelle
        rsiLine.setData(coloredRSIData);
        
        // 70 ve 30 seviyeleri için yatay çizgiler ekle
        rsiChart.addLineSeries({
          color: '#ff4d4f',
          lineWidth: 1,
          lineStyle: 2, // 2 = dashed
          priceScaleId: 'right',
          lastValueVisible: false,
          priceLineVisible: false
        }).setData([
          { time: rsiData[0]?.time, value: 70 },
          { time: rsiData[rsiData.length - 1]?.time, value: 70 }
        ]);
        
        rsiChart.addLineSeries({
          color: '#52c41a',
          lineWidth: 1,
          lineStyle: 2, // 2 = dashed
          priceScaleId: 'right',
          lastValueVisible: false,
          priceLineVisible: false
        }).setData([
          { time: rsiData[0]?.time, value: 30 },
          { time: rsiData[rsiData.length - 1]?.time, value: 30 }
        ]);
        
        rsiChart.priceScale('right').applyOptions({ 
          autoScale: true, 
          scaleMargins: { top: 0.15, bottom: 0.15 } 
        });
        rsiChart.timeScale().fitContent();
        // Grafiklerin timeScale'ini senkronize et
        if (chart && rsiChart) {
          chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
            if (range) {
              rsiChart.timeScale().setVisibleRange(range);
            }
          });
          rsiChart.timeScale().subscribeVisibleTimeRangeChange((range) => {
            if (range) {
              chart.timeScale().setVisibleRange(range);
            }
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Chart API error:', err);
        setError('Veri alınamadı.');
        setLoading(false);
      });
    return () => {
      if (chartInstance.current) {
        chartInstance.current.remove();
        chartInstance.current = null;
      }
      // Fibo çizgilerini temizle
      if (fiboLinesRef.current && fiboLinesRef.current.length > 0) {
        fiboLinesRef.current.forEach((line: any) => {
          if (line && typeof line.remove === 'function') line.remove();
        });
        fiboLinesRef.current = [];
      }
    };
  }, [symbol, interval, showFibo]);

  // Tarih aralığı gösterimi için state
  const [dateRange, setDateRange] = useState<{min: string, max: string}>({min: '', max: ''});

  // Veri geldiğinde tarih aralığını güncelle
  useEffect(() => {
    if (!loading && !error && chartRef.current) {
      // Chart'ın datası DOM'da yok, tekrar çekmek gerek
      axios.get(`/api/yahoo-chart?symbol=${symbol}&interval=${interval}`)
        .then(res => {
          if (Array.isArray(res.data) && res.data.length > 0) {
            const min = res.data[0].time;
            const max = res.data[res.data.length - 1].time;
            const format = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
            setDateRange({ min: format(min), max: format(max) });
          } else {
            setDateRange({ min: '', max: '' });
          }
        });
    }
  }, [symbol, interval, loading, error]);

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <button
          className={`px-2 py-1 rounded ${interval === '1d' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setInterval('1d')}
        >Günlük</button>
        <button
          className={`px-2 py-1 rounded ${interval === '1wk' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setInterval('1wk')}
        >Haftalık</button>
        <button
          className={`px-2 py-1 rounded ${interval === '1mo' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setInterval('1mo')}
        >Aylık</button>
      </div>
      <div className="text-xs text-gray-500 mb-1">
        {dateRange.min && dateRange.max && (
          <span>Tarih aralığı: <b>{dateRange.min}</b> - <b>{dateRange.max}</b></span>
        )}
      </div>
      <label className="flex items-center gap-2 mb-2 select-none cursor-pointer">
        <input
          type="checkbox"
          checked={showFibo}
          onChange={e => setShowFibo(e.target.checked)}
          className="accent-amber-500 w-4 h-4"
        />
        <span className="text-sm">Fibonacci Göster</span>
      </label>
      <div ref={chartRef} className="w-full h-[400px]" style={{ position: 'relative', minHeight: 400, background: '#fff' }} />
      <div ref={rsiRef} className="w-full h-[100px]" style={{ position: 'relative', minHeight: 100, background: '#fff', marginTop: 8 }} />
      {/* Temettü kutusu */}
      <DividendBox symbol={symbol} />
      {/* Analist önerileri ve hedef fiyat kutusu */}
      <AnalystBox symbol={symbol} />
      {loading && <div className="text-center mt-2">Yükleniyor...</div>}
      {error && <div className="text-center text-red-500 mt-2">{error}</div>}
      {error && (
        <div className="text-center text-gray-500 mt-2">
          Lütfen geçerli bir sembol seçtiğinizden ve veri kaynağının erişilebilir olduğundan emin olun.
        </div>
      )}
    </div>
  );
}

