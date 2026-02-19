import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { NotificationBell } from '@/components/dashboard/NotificationBell'

export default function OfficerDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-green-800 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">SSO Smart Service</h1>
            <p className="text-green-200 text-sm">เจ้าหน้าที่ สปส.</p>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="text-right">
              <p className="font-medium">เจ้าหน้าที่</p>
              <p className="text-green-200 text-sm">สาขากรุงเทพฯ</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-4 space-y-6">
        {/* Stats Overview */}
        <section className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">
                คำร้องรอดำเนินการ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-orange-600">23</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">
                AI Escalation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">5</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">
                ดำเนินการวันนี้
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">47</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">
                เวลาตอบกลับเฉลี่ย
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">12 นาที</p>
            </CardContent>
          </Card>
        </section>

        {/* Pending Cases */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            คำร้องรอดำเนินการ
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {[
                  {
                    id: 'REQ-2024-001',
                    type: 'กรณีเจ็บป่วย',
                    name: 'นายสมชาย ใจดี',
                    time: '10 นาทีที่แล้ว',
                    priority: 'urgent',
                  },
                  {
                    id: 'REQ-2024-002',
                    type: 'กรณีว่างงาน',
                    name: 'นางสาวสมหญิง รักดี',
                    time: '30 นาทีที่แล้ว',
                    priority: 'normal',
                  },
                  {
                    id: 'REQ-2024-003',
                    type: 'AI Escalation',
                    name: 'นายวิชัย มั่งมี',
                    time: '1 ชั่วโมงที่แล้ว',
                    priority: 'escalated',
                  },
                ].map((item) => (
                  <div
                    key={item.id}
                    className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        {item.id} • {item.type}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <Badge
                        variant={
                          item.priority === 'urgent'
                            ? 'destructive'
                            : item.priority === 'escalated'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {item.priority === 'urgent'
                          ? 'เร่งด่วน'
                          : item.priority === 'escalated'
                          ? 'AI ส่งต่อ'
                          : 'ปกติ'}
                      </Badge>
                      <span className="text-sm text-gray-500">{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
