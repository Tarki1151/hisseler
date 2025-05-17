import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Tüm ürünleri getir
    const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    res.status(200).json(products);
  } else if (req.method === 'POST') {
    // Yeni ürün ekle (symbol, name, type)
    const { symbol, name, type } = req.body;
    if (!symbol || !name || !type) {
      return res.status(400).json({ error: 'Eksik veri' });
    }
    const product = await prisma.product.upsert({
      where: { symbol },
      update: {},
      create: { symbol, name, type },
    });
    res.status(201).json(product);
  } else if (req.method === 'DELETE') {
    // Ürün ve ilişkili ChartData sil
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Eksik id' });
    await prisma.chartData.deleteMany({ where: { productId: Number(id) } });
    await prisma.product.delete({ where: { id: Number(id) } });
    res.status(204).end();
  } else {
    res.status(405).end();
  }
}
