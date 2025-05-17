import puppeteer from 'puppeteer';

/**
 * Yahoo Finance web scraping: Analist öneri ve hedef fiyatlarını puppeteer ile çeker.
 * @param symbol Hisse kodu (örn: AAPL, AKBNK.IS)
 * @returns { buy, hold, sell, targetLow, targetHigh, targetMean, targetMedian }
 */
export async function scrapeYahooAnalyst(symbol: string) {
  const url = `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/analysts`;
  console.log('[scrapeYahooAnalyst] Başlıyor:', url);
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36');
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  // Beklenen tablo ve kutular yüklenene kadar bekle
  await new Promise(res => setTimeout(res, 2500));

  // Hedef fiyat tablosu ve öneri kutusu içeriğini al
  const result = await page.evaluate(() => {
    try {
      let buy: number | null = null, hold: number | null = null, sell: number | null = null;
      let targetMean: number | null = null, targetHigh: number | null = null, targetLow: number | null = null, targetMedian: number | null = null;

      // "Recommendation Rating" veya "Recommendation Trends" kutusu
      const recBox = Array.from(document.querySelectorAll('section')).find(sec =>
        sec.textContent && /recommendation/i.test(sec.textContent)
      );
      if (recBox) {
        const liArr = recBox.querySelectorAll('li');
        liArr.forEach(li => {
          const text = li.textContent || '';
          if (/buy/i.test(text)) buy = parseInt(text.replace(/\D/g, ''));
          if (/hold/i.test(text)) hold = parseInt(text.replace(/\D/g, ''));
          if (/sell/i.test(text)) sell = parseInt(text.replace(/\D/g, ''));
        });
      }

      // "Price Target" tablosu
      const priceTable = Array.from(document.querySelectorAll('table')).find(tbl =>
        tbl.previousElementSibling && tbl.previousElementSibling.textContent &&
        /price target/i.test(tbl.previousElementSibling.textContent)
      );
      if (priceTable) {
        Array.from(priceTable.querySelectorAll('tr')).forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            const key = cells[0].textContent?.toLowerCase() || '';
            const val = parseFloat((cells[1].textContent || '').replace(/[^0-9.,]/g, '').replace(',', '.'));
            if (key.includes('average')) targetMean = val;
            if (key.includes('high')) targetHigh = val;
            if (key.includes('low')) targetLow = val;
            if (key.includes('median')) targetMedian = val;
          }
        });
      }

      return {
        recommendations: { buy, hold, sell },
        priceTargets: { mean: targetMean, high: targetHigh, low: targetLow, median: targetMedian }
      };
    } catch (e) {
      return { error: 'DOM parse hatası', details: (e instanceof Error ? e.message : e) };
    }
  });

  await browser.close();
  console.log('[scrapeYahooAnalyst] Sonuç:', result);
  return result;
}
