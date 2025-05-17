import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { symbol } = req.query;
  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Symbol param required' });
  }
  try {
    // Yahoo Finance chart endpoint with events=div
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=10y&events=div`;
    const response = await axios.get(url);
    const result = response.data.chart.result[0];
    const dividends = result.events && result.events.dividends ? Object.values(result.events.dividends) : [];
    // Sort by date desc, get last 100
    const last100 = dividends
      .sort((a: any, b: any) => b.date - a.date)
      .slice(0, 100)
      .map((d: any) => ({
        date: new Date(d.date * 1000).toISOString().slice(0, 10),
        amount: d.amount,
        currency: d.currency || '',
        description: d.description || ''
      }));
    res.status(200).json({ dividends: last100 });
  } catch (err) {
    res.status(500).json({ error: 'Dividend API error', details: (err as Error).message });
  }
}
