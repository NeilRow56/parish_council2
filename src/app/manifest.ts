import type { MetadataRoute } from 'next'

import { branding } from '@/lib/branding'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: branding.appName,
    short_name: branding.appName,
    description: branding.metadata.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#064e3b',
    icons: [
      {
        src: branding.logoPath,
        sizes: '580x116',
        type: 'image/png'
      }
    ]
  }
}
