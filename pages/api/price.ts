import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { symbol } = req.query;
  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Symbol param required' });
  }
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    const response = await axios.get(url);
    const result = response.data.quoteResponse?.result?.[0];
    const price = result?.regularMarketPrice;
    if (typeof price === 'number') {
      res.status(200).json({ price });
    } else {
      res.status(404).json({ error: 'Price not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Price API error', details: (err as Error).message });
  }
}
