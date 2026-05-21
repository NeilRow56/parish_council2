import type { Metadata } from 'next'
import './globals.css'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { branding } from '@/lib/branding'

export const metadata: Metadata = {
  title: branding.metadata.title,
  description: branding.metadata.description,
  openGraph: {
    title: branding.metadata.ogTitle,
    description: branding.metadata.ogDescription,
    siteName: branding.siteName
  },
  twitter: {
    card: 'summary',
    title: branding.metadata.ogTitle,
    description: branding.metadata.ogDescription
  },
  icons: {
    icon: branding.logoPath,
    apple: branding.logoPath
  },
  applicationName: branding.appName
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en' className='h-full antialiased'>
      <body className='h-screen flex-1'>
        <Toaster
          position='bottom-center'
          richColors={false}
          closeButton
          toastOptions={{
            duration: 5000,
            unstyled: true,
            classNames: {
              toast:
                'flex min-w-[320px] max-w-[420px] items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5',

              title: 'font-medium text-slate-900',
              description: 'mt-0.5 text-xs leading-5 text-slate-500',

              success:
                'border-emerald-200 bg-white text-slate-900 before:h-2 before:w-2 before:shrink-0 before:rounded-full before:bg-emerald-500',
              error:
                'border-red-200 bg-white text-slate-900 before:h-2 before:w-2 before:shrink-0 before:rounded-full before:bg-red-500',
              warning:
                'border-amber-200 bg-white text-slate-900 before:h-2 before:w-2 before:shrink-0 before:rounded-full before:bg-amber-500',
              info: 'border-blue-200 bg-white text-slate-900 before:h-2 before:w-2 before:shrink-0 before:rounded-full before:bg-blue-500',
              loading:
                'border-blue-200 bg-white text-slate-900 before:h-2 before:w-2 before:shrink-0 before:animate-pulse before:rounded-full before:bg-blue-500',

              actionButton:
                'ml-auto rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700',

              cancelButton:
                'ml-auto rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50',

              closeButton:
                'rounded-full border border-slate-200 bg-white text-slate-400 hover:text-slate-700'
            }
          }}
        />
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  )
}
