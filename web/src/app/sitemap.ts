import type { MetadataRoute } from 'next'
import { getAllActiveTickers } from '@/lib/queries/stocks'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/compare`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${SITE_URL}/money-flow`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${SITE_URL}/investors`, changeFrequency: 'weekly', priority: 0.5 },
  ]

  const tickers = await getAllActiveTickers()
  const stockRoutes: MetadataRoute.Sitemap = tickers.map(({ ticker }) => ({
    url: `${SITE_URL}/stock/${ticker.toUpperCase()}`,
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  return [...staticRoutes, ...stockRoutes]
}
