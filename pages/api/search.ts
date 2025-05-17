import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req.query;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query param required' });
  }
  try {
    // Yahoo Finance search endpoint (unofficial, public)
    const yurl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&lang=en-US&region=US`;
    const yres = await axios.get(yurl);
    const items = (yres.data.quotes || []).filter((item: any) =>
      (item.quoteType === 'EQUITY' || item.quoteType === 'ETF')
    ).map((item: any) => ({
      symbol: item.symbol,
      name: item.shortname || item.longname || item.symbol,
      type: item.quoteType,
      region: item.exchange || ''
    }));
    res.status(200).json({ results: items });
  } catch (err) {
    res.status(500).json({ error: 'Search API error', details: (err as Error).message });
  }
}
