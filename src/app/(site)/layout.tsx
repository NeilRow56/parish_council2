// export const metadata: Metadata = {
//   title: "FlowX - Dashboard",
//   description: APP_DESCRIPTION,
//   // metadataBase: new URL(SERVER_URL)
// };

import AppNav from '@/components/shared/app-nav'

export default async function SiteLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className='h-screen flex-1'>
      <AppNav />
      {children}
    </div>
  )
}
