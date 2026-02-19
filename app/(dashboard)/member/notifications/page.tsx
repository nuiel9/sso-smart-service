import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotificationList } from '@/components/dashboard/NotificationList'

// Revalidate every 60 seconds so SSR data stays reasonably fresh
export const revalidate = 60

export const metadata = {
  title: 'การแจ้งเตือน — SSO Smart Service',
  description: 'ประวัติการแจ้งเตือนทั้งหมดของคุณ',
}

export default async function NotificationsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch first page + total count on the server
  const { data: notifications, count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('member_id', user.id)
    .order('sent_at', { ascending: false })
    .range(0, 19) // first 20 items

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b px-4 py-4 mb-4 sm:hidden">
        <h1 className="text-lg font-semibold text-gray-900">การแจ้งเตือน</h1>
      </div>

      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <NotificationList
          initialNotifications={notifications ?? []}
          initialTotal={count ?? 0}
        />
      </div>
    </div>
  )
}
