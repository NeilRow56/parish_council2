export default async function SiteLayout({
  children
}: {
  children: React.ReactNode
}) {
  return <div className='h-screen flex-1'>{children}</div>
}
