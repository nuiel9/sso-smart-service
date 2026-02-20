import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NotificationBell } from '@/components/dashboard/NotificationBell'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { createClient } from '@/lib/supabase/server'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/member')

  // Fetch notifications
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('member_id', user.id)
    .order('sent_at', { ascending: false })
    .limit(5)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-purple-900 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">SSO Smart Service</h1>
            <p className="text-purple-200 text-sm">ผู้ดูแลระบบ</p>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell initialNotifications={notifications || []} />
            <div className="text-right">
              <p className="font-medium">Admin</p>
              <p className="text-purple-200 text-sm">ส่วนกลาง</p>
            </div>
            <LogoutButton variant="ghost" className="text-white hover:bg-white/10" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-4 space-y-6">
        {/* System Stats */}
        <section className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">
                ผู้ใช้งานทั้งหมด
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">1,234,567</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">
                ใช้งานวันนี้
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">45,678</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">
                AI Conversations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">12,345</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">
                AI Accuracy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-600">94.5%</p>
            </CardContent>
          </Card>
        </section>

        {/* Admin Tabs */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">จัดการผู้ใช้</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            <TabsTrigger value="ai">AI Settings</TabsTrigger>
            <TabsTrigger value="system">ระบบ</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>การจัดการผู้ใช้งาน</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">
                  ระบบจัดการผู้ใช้งาน, กำหนดสิทธิ์, และดูประวัติการใช้งาน
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Audit Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    {
                      action: 'LOGIN',
                      user: 'admin@sso.go.th',
                      time: '2024-01-15 10:30:00',
                      ip: '192.168.1.100',
                    },
                    {
                      action: 'VIEW_PROFILE',
                      user: 'officer001',
                      time: '2024-01-15 10:28:00',
                      ip: '192.168.1.101',
                    },
                    {
                      action: 'APPROVE_BENEFIT',
                      user: 'officer002',
                      time: '2024-01-15 10:25:00',
                      ip: '192.168.1.102',
                    },
                  ].map((log, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center p-2 bg-gray-50 rounded"
                    >
                      <div>
                        <span className="font-mono text-sm bg-gray-200 px-2 py-1 rounded">
                          {log.action}
                        </span>
                        <span className="ml-2 text-gray-600">{log.user}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {log.time} - {log.ip}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai">
            <Card>
              <CardHeader>
                <CardTitle>AI Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Confidence Threshold</span>
                    <span className="font-mono">0.7</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Model</span>
                    <span className="font-mono">typhoon-v2-70b-instruct</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Max Tokens</span>
                    <span className="font-mono">1024</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system">
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>API Status</span>
                    <span className="text-green-600">Online</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Database</span>
                    <span className="text-green-600">Connected</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Typhoon LLM</span>
                    <span className="text-green-600">Available</span>
                  </div>
                  <div className="flex justify-between">
                    <span>LINE API</span>
                    <span className="text-green-600">Connected</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
