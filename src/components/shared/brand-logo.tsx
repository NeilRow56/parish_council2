import Image from 'next/image'

import { branding } from '@/lib/branding'

export function BrandLogo({
  className = 'h-9 w-auto',
  dark = false
}: {
  className?: string
  dark?: boolean
}) {
  return (
    <Image
      src={branding.logoPath}
      alt={branding.appName}
      width={580}
      height={116}
      priority
      className={className}
      data-theme={dark ? 'dark' : 'light'}
    />
  )
}
