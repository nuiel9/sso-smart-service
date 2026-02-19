import { BenefitsCard } from '@/components/dashboard/BenefitsCard'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { NotificationBell } from '@/components/dashboard/NotificationBell'
import { ChatWindow } from '@/components/chat/ChatWindow'

export default function MemberDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-900 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">SSO Smart Service</h1>
            <p className="text-blue-200 text-sm">ผู้ประกันตน</p>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="text-right">
              <p className="font-medium">สวัสดี, ผู้ใช้</p>
              <p className="text-blue-200 text-sm">มาตรา 33</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-4 space-y-6">
        {/* Quick Actions */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            บริการด่วน
          </h2>
          <QuickActions />
        </section>

        {/* Benefits Overview */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            สิทธิประโยชน์ของคุณ
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <BenefitsCard
              title="กรณีเจ็บป่วย"
              description="ค่ารักษาพยาบาลและเงินทดแทนการขาดรายได้"
              status="พร้อมใช้"
              statusColor="green"
            />
            <BenefitsCard
              title="กรณีว่างงาน"
              description="เงินทดแทนกรณีว่างงาน"
              status="พร้อมใช้"
              statusColor="green"
            />
            <BenefitsCard
              title="กรณีชราภาพ"
              description="บำนาญชราภาพหรือบำเหน็จชราภาพ"
              status="สะสมอยู่"
              statusColor="blue"
            />
            <BenefitsCard
              title="กรณีคลอดบุตร"
              description="ค่าคลอดบุตรและเงินสงเคราะห์"
              status="พร้อมใช้"
              statusColor="green"
            />
            <BenefitsCard
              title="กรณีสงเคราะห์บุตร"
              description="เงินสงเคราะห์บุตรรายเดือน"
              status="ไม่มีสิทธิ์"
              statusColor="gray"
            />
            <BenefitsCard
              title="กรณีเสียชีวิต"
              description="ค่าทำศพและเงินสงเคราะห์"
              status="พร้อมใช้"
              statusColor="green"
            />
          </div>
        </section>

        {/* AI Chat Assistant */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            ถามตอบ AI ผู้ช่วย
          </h2>
          <ChatWindow />
        </section>
      </main>
    </div>
  )
}
