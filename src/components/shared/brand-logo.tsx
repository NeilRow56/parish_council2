import Image from 'next/image'

import { branding } from '@/lib/branding'

type BrandLogoVariant = 'full' | 'icon'

export function BrandLogo({
  className = 'h-9 w-auto',
  dark = false,
  variant = 'full'
}: {
  className?: string
  dark?: boolean
  variant?: BrandLogoVariant
}) {
  const isIcon = variant === 'icon'

  return (
    <Image
      src={isIcon ? branding.iconLogoPath : branding.fullLogoPath}
      alt={branding.appName}
      width={isIcon ? 119 : 564}
      height={102}
      priority
      className={className}
      data-theme={dark ? 'dark' : 'light'}
    />
  )
}
