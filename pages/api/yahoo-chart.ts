import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { prisma } from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { symbol, range = '6mo', interval = '1d', store } = req.query;
  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Symbol param required' });
  }

  if (store === '1') {
    // Sadece günlük (1d) interval için 20 yıllık veri DB'ye kaydedilir
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=20y`;
      const response = await axios.get(url);
      const result = response.data.chart.result[0];
      const timestamps = result.timestamp;
      const ohlc = result.indicators.quote[0];
      // Product'ı bul
      const product = await prisma.product.findUnique({ where: { symbol } });
      if (!product) return res.status(404).json({ error: 'Product not found' });
      // Eski veriyi sil
      await prisma.chartData.deleteMany({ where: { productId: product.id } });
      // Toplu ekle
      const chartData = timestamps.map((t: number, i: number) => ({
        productId: product.id,
        time: t,
        open: ohlc.open[i],
        high: ohlc.high[i],
        low: ohlc.low[i],
        close: ohlc.close[i],
        volume: ohlc.volume[i],
      })).filter((d: any) => d.open && d.high && d.low && d.close);
      // Prisma toplu insert
      for (let i = 0; i < chartData.length; i += 500) {
        await prisma.chartData.createMany({ data: chartData.slice(i, i + 500) });
      }
      res.status(200).json({ status: 'ok', count: chartData.length });
    } catch (err) {
      res.status(500).json({ error: 'Yahoo Finance API error', details: (err as Error).message });
    }
    return;
  }

  // DB'den oku ve gönder
  try {
    const product = await prisma.product.findUnique({ where: { symbol: symbol as string } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    // Eğer interval 1d ise DB'den oku
    if (interval === '1d') {
      const chartData = await prisma.chartData.findMany({
        where: { productId: product.id },
        orderBy: { time: 'asc' },
      });
      if (chartData.length > 0) {
        return res.status(200).json(chartData.map((d: any) => ({
          time: d.time,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume,
        })));
      }
    }
    // Eğer interval 1wk veya 1mo ise DB'deki günlük veriden topla
    if (interval === '1wk' || interval === '1mo') {
      const daily = await prisma.chartData.findMany({
        where: { productId: product.id },
        orderBy: { time: 'asc' },
      });
      if (daily.length > 0) {
        // Helper: haftanın ilk günü Pazar (UTC)
        function getWeekStart(ts: number) {
          const d = new Date(ts * 1000);
          d.setUTCHours(0, 0, 0, 0);
          d.setUTCDate(d.getUTCDate() - d.getUTCDay());
          return Math.floor(d.getTime() / 1000);
        }
        // Helper: ayın ilk günü
        function getMonthStart(ts: number) {
          const d = new Date(ts * 1000);
          d.setUTCHours(0, 0, 0, 0);
          d.setUTCDate(1);
          return Math.floor(d.getTime() / 1000);
        }
        const groups: Record<string, typeof daily> = {};
        for (const item of daily) {
          let key = '';
          if (interval === '1wk') key = String(getWeekStart(item.time));
          if (interval === '1mo') key = String(getMonthStart(item.time));
          if (!groups[key]) groups[key] = [];
          groups[key].push(item);
        }
        const agg = Object.entries(groups).map(([key, arr]) => {
          arr.sort((a, b) => a.time - b.time);
          return {
            time: Number(key),
            open: arr[0].open,
            high: Math.max(...arr.map(x => x.high)),
            low: Math.min(...arr.map(x => x.low)),
            close: arr[arr.length - 1].close,
            volume: arr.reduce((s, x) => s + x.volume, 0),
          };
        });
        return res.status(200).json(agg);
      }
    }
    // DB'de hiç veri yoksa Yahoo'dan çek
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
    const response = await axios.get(url);
    const resultArr = response.data.chart.result;
    if (!resultArr || !Array.isArray(resultArr) || resultArr.length === 0) {
      return res.status(404).json({ error: 'Sembol veya fiyat verisi bulunamadı' });
    }
    const result = resultArr[0];
    const timestamps = result.timestamp;
    const ohlc = result.indicators.quote[0];
    const data = timestamps.map((t: number, i: number) => ({
      time: t,
      open: ohlc.open[i],
      high: ohlc.high[i],
      low: ohlc.low[i],
      close: ohlc.close[i],
      volume: ohlc.volume[i],
    }));
    return res.status(200).json(data);
  } catch (err: any) {
    if (err?.response?.status === 404) {
      return res.status(404).json({ error: 'Sembol veya fiyat verisi bulunamadı', details: err.message });
    }
    res.status(500).json({ error: 'ChartData DB error', details: (err as Error).message });
  }
}
