import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { prisma } from '../../lib/prisma';

// Yahoo Finance summaryDetail endpoint returns analyst recommendations and target prices
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { symbol } = req.query;
  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Symbol param required' });
  }
  try {
    // 1. Önce cache kontrolü
    const cache = await prisma.analystCache.findUnique({ where: { symbol } });
    const now = new Date();
    let useCache = false;
    if (cache) {
      const fetchedAt = new Date(cache.fetchedAt);
      const diffDays = (now.getTime() - fetchedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays < 7) {
        useCache = true;
      }
    }
    if (useCache) {
      return res.status(200).json(cache.data);
    }

    // Yahoo Finance recommendation-trend endpoint (sadece buy/hold/sell)
    const recUrl = `https://query2.finance.yahoo.com/v1/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=recommendationTrend`;

    let recRes;
    try {
      recRes = await axios.get(recUrl);
    } catch (err: any) {
      if (err?.response?.status === 429) {
        // Çok fazla istek hatası, cache varsa onu dön
        if (cache) {
          return res.status(200).json(cache.data);
        } else {
          return res.status(429).json({ error: 'Çok fazla istek yapıldı, lütfen daha sonra tekrar deneyin.' });
        }
      }
      throw err;
    }

    // Parse recommendation trend
    let buy = 0, hold = 0, sell = 0;
    const recTrend = recRes.data.quoteSummary?.result?.[0]?.recommendationTrend?.trend;
    if (Array.isArray(recTrend) && recTrend.length > 0) {
      // Use the most recent (first) period
      const latest = recTrend[0];
      buy = latest.strongBuy + latest.buy;
      hold = latest.hold;
      sell = latest.strongSell + latest.sell;
    }

    // Analyst price targets: Alpha Vantage
    const alphaKey = process.env.ALPHA_VANTAGE_API_KEY;
    let targetLow = null, targetHigh = null, targetMean = null, targetMedian = null;
    let usedScraping = false;
    if (alphaKey) {
      try {
        const alphaUrl = `https://www.alphavantage.co/query?function=ANALYST_ESTIMATES&symbol=${encodeURIComponent(symbol)}&apikey=${alphaKey}`;
        const alphaRes = await axios.get(alphaUrl);
        targetMean = alphaRes.data?.annualTargetMeanEstimate ?? null;
        targetHigh = alphaRes.data?.annualTargetHighEstimate ?? null;
        targetLow = alphaRes.data?.annualTargetLowEstimate ?? null;
        targetMedian = alphaRes.data?.annualTargetMedianEstimate ?? null;
      } catch (err) {
        // Alpha Vantage hatası olursa priceTargets null kalır
      }
    }

    // Eğer hem Yahoo hem Alpha Vantage verisi alınamazsa, scraping ile dene
    let recommendationsFinal = { buy, hold, sell };
    let priceTargetsFinal = { low: targetLow, high: targetHigh, mean: targetMean, median: targetMedian };
    if (
      (buy === 0 && hold === 0 && sell === 0) &&
      !targetMean && !targetHigh && !targetLow && !targetMedian
    ) {
      try {
        const { scrapeYahooAnalyst } = await import('../../utils/scrapeYahooAnalyst');
        const scraped = await scrapeYahooAnalyst(symbol);
        if (scraped) {
          recommendationsFinal = scraped.recommendations;
          priceTargetsFinal = scraped.priceTargets;
          usedScraping = true;
        }
      } catch (err) {
        // scraping başarısız olursa veri null kalır
      }
    }

    const data = {
      recommendations: recommendationsFinal,
      priceTargets: priceTargetsFinal,
      source: usedScraping ? 'scraping' : (alphaKey ? 'alpha' : 'yahoo')
    };
    // Cache'i güncelle
    await prisma.analystCache.upsert({
      where: { symbol },
      update: { fetchedAt: now, data },
      create: { symbol, fetchedAt: now, data },
    });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Analyst API error', details: (err as Error).message });
  }
}
