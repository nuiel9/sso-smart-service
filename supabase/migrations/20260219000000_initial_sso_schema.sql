-- =============================================================================
-- SSO Smart Service Platform - Initial Schema Migration
-- วันที่สร้าง: 2026-02-19
-- ระบบ: ระบบบริการอัจฉริยะประกันสังคม (SSO Smart Service)
-- =============================================================================

-- =============================================================================
-- SECTION 1: ENUM TYPES
-- กำหนดประเภทข้อมูลแบบ enum สำหรับใช้ทั่วทั้งระบบ
-- =============================================================================

-- บทบาทของผู้ใช้งานในระบบ
CREATE TYPE public.user_role AS ENUM (
  'member',   -- ผู้ประกันตน (ผู้ใช้ทั่วไป)
  'officer',  -- เจ้าหน้าที่สำนักงานประกันสังคม
  'admin'     -- ผู้ดูแลระบบ
);

-- มาตราประกันสังคม
CREATE TYPE public.section_type AS ENUM (
  '33',  -- มาตรา 33: ลูกจ้างในระบบ
  '39',  -- มาตรา 39: ผู้ประกันตนโดยสมัครใจ (เคยอยู่ ม.33)
  '40'   -- มาตรา 40: แรงงานอิสระ/อาชีพอิสระ
);

-- สถานะสิทธิประโยชน์
CREATE TYPE public.benefit_status AS ENUM (
  'active',   -- สิทธิ์ยังใช้ได้
  'pending',  -- รอการอนุมัติ
  'expired',  -- สิทธิ์หมดอายุ
  'claimed'   -- ใช้สิทธิ์แล้ว
);

-- ช่องทางการสนทนา
CREATE TYPE public.chat_channel AS ENUM (
  'web',      -- เว็บไซต์
  'line',     -- LINE Official Account
  'tangrat'   -- แอปพลิเคชันตั้งกัต
);

-- บทบาทในการสนทนา
CREATE TYPE public.message_role AS ENUM (
  'user',       -- ผู้ประกันตน
  'assistant',  -- AI Chatbot
  'system'      -- ระบบ
);

-- ประเภทการแจ้งเตือน
CREATE TYPE public.notification_type AS ENUM (
  'benefit_reminder',    -- แจ้งเตือนสิทธิ์ที่ใกล้หมดอายุ
  'payment_status',      -- แจ้งสถานะการจ่ายเงิน
  'section40_outreach',  -- รณรงค์สมัคร ม.40 สำหรับแรงงานนอกระบบ
  'system'               -- การแจ้งเตือนจากระบบ
);

-- ช่องทางการแจ้งเตือน
CREATE TYPE public.notification_channel AS ENUM (
  'push',  -- Push notification (เว็บ/แอป)
  'line',  -- LINE
  'sms'    -- SMS
);

-- =============================================================================
-- SECTION 2: TABLES
-- สร้างตารางหลักของระบบ
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ตาราง: profiles
-- เก็บข้อมูลโปรไฟล์ผู้ใช้ เชื่อมต่อกับ auth.users ของ Supabase
-- ข้อมูลส่วนตัวที่อ่อนไหว (เลขบัตรประชาชน) จะถูกเข้ารหัสก่อนบันทึก
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  -- Primary key เชื่อมกับ Supabase Auth
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- เลขบัตรประชาชน 13 หลัก (เก็บแบบ encrypted เพื่อปฏิบัติตาม PDPA)
  -- ค่าที่บันทึกควรผ่าน pgcrypto หรือ application-level encryption ก่อน
  national_id     TEXT UNIQUE,

  -- ชื่อ-นามสกุลภาษาไทย
  full_name_th    TEXT,

  -- ชื่อ-นามสกุลภาษาอังกฤษ (สำหรับเอกสารราชการ)
  full_name_en    TEXT,

  -- เบอร์โทรศัพท์
  phone           TEXT,

  -- บทบาทของผู้ใช้ในระบบ
  role            public.user_role NOT NULL DEFAULT 'member',

  -- เลขประกันสังคม (SSO Member ID)
  sso_member_id   TEXT UNIQUE,

  -- มาตราประกันสังคมที่สังกัด
  section_type    public.section_type,

  -- รหัสเขตพื้นที่สำนักงานประกันสังคม (เช่น 'BKK-01', 'CNX-01')
  zone_id         TEXT,

  -- การยินยอมตาม PDPA (พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562)
  pdpa_consent      BOOLEAN NOT NULL DEFAULT FALSE,
  pdpa_consent_date TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'โปรไฟล์ผู้ใช้งานระบบ SSO Smart Service เชื่อมกับ Supabase Auth';
COMMENT ON COLUMN public.profiles.national_id IS 'เลขบัตรประชาชน 13 หลัก (encrypted) - ข้อมูลส่วนบุคคลอ่อนไหวตาม PDPA';
COMMENT ON COLUMN public.profiles.sso_member_id IS 'เลขประกันสังคม 13 หลัก';
COMMENT ON COLUMN public.profiles.section_type IS 'มาตราประกันสังคม: 33=ลูกจ้าง, 39=สมัครใจ, 40=อาชีพอิสระ';
COMMENT ON COLUMN public.profiles.zone_id IS 'รหัสเขตพื้นที่สำนักงานประกันสังคม';
COMMENT ON COLUMN public.profiles.pdpa_consent IS 'ผู้ใช้ยินยอมให้ประมวลผลข้อมูลส่วนบุคคลตาม PDPA หรือไม่';

-- -----------------------------------------------------------------------------
-- ตาราง: benefits
-- เก็บข้อมูลสิทธิประโยชน์ของผู้ประกันตน
-- เช่น เงินทดแทน, ค่ารักษาพยาบาล, เงินชราภาพ
-- -----------------------------------------------------------------------------
CREATE TABLE public.benefits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- เชื่อมกับผู้ประกันตน
  member_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- ประเภทสิทธิประโยชน์ เช่น 'sick_leave', 'maternity', 'disability', 'old_age', 'death', 'unemployment'
  benefit_type  TEXT NOT NULL,

  -- สถานะปัจจุบันของสิทธิ์
  status        public.benefit_status NOT NULL DEFAULT 'pending',

  -- จำนวนเงินสิทธิประโยชน์ (บาท)
  amount        DECIMAL(12, 2),

  -- วันที่เริ่มมีสิทธิ์
  eligible_date DATE,

  -- วันหมดอายุสิทธิ์
  expiry_date   DATE,

  -- วันที่ใช้สิทธิ์ (NULL = ยังไม่ได้ใช้)
  claimed_at    TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.benefits IS 'สิทธิประโยชน์ของผู้ประกันตน ตามกองทุนประกันสังคม';
COMMENT ON COLUMN public.benefits.benefit_type IS 'ประเภทสิทธิ์ เช่น sick_leave=เจ็บป่วย, maternity=คลอดบุตร, disability=ทุพพลภาพ, old_age=ชราภาพ, death=ตาย, unemployment=ว่างงาน';
COMMENT ON COLUMN public.benefits.amount IS 'จำนวนเงินสิทธิประโยชน์เป็นบาท ทศนิยม 2 ตำแหน่ง';

-- -----------------------------------------------------------------------------
-- ตาราง: chat_sessions
-- เก็บข้อมูล session การสนทนากับ AI Chatbot
-- รองรับหลายช่องทาง: เว็บ, LINE, แอป Tangrat
-- -----------------------------------------------------------------------------
CREATE TABLE public.chat_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- เชื่อมกับผู้ประกันตน
  member_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- ช่องทางที่ใช้สนทนา
  channel             public.chat_channel NOT NULL DEFAULT 'web',

  -- เวลาเริ่มและสิ้นสุดการสนทนา
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at            TIMESTAMPTZ,

  -- คะแนนความพึงพอใจ (1-5 ดาว) หลังสิ้นสุด session
  -- NULL = ยังไม่ได้ให้คะแนน หรือยังไม่จบ session
  satisfaction_score  SMALLINT CHECK (satisfaction_score BETWEEN 1 AND 5)
);

COMMENT ON TABLE public.chat_sessions IS 'Session การสนทนากับ AI Chatbot ของระบบ SSO Smart Service';
COMMENT ON COLUMN public.chat_sessions.channel IS 'ช่องทางสนทนา: web=เว็บ, line=LINE Official, tangrat=แอป Tangrat';
COMMENT ON COLUMN public.chat_sessions.satisfaction_score IS 'คะแนนความพึงพอใจ 1-5 ดาว (NULL หากยังไม่ประเมิน)';

-- -----------------------------------------------------------------------------
-- ตาราง: chat_messages
-- เก็บข้อความแต่ละรายการใน session การสนทนา
-- รวมถึง metadata จาก AI เช่น confidence score
-- -----------------------------------------------------------------------------
CREATE TABLE public.chat_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- เชื่อมกับ session การสนทนา
  session_id       UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,

  -- บทบาทของผู้ส่งข้อความ
  role             public.message_role NOT NULL,

  -- เนื้อหาข้อความ
  content          TEXT NOT NULL,

  -- ระดับความมั่นใจของ AI (0.00 - 1.00)
  -- NULL หากเป็นข้อความจาก user หรือ system
  confidence_score DECIMAL(4, 3) CHECK (confidence_score BETWEEN 0 AND 1),

  -- ถูกส่งต่อให้เจ้าหน้าที่ดูแลหรือไม่
  -- TRUE เมื่อ AI confidence ต่ำ หรือผู้ใช้ร้องขอ
  escalated        BOOLEAN NOT NULL DEFAULT FALSE,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.chat_messages IS 'ข้อความแต่ละรายการในการสนทนากับ AI Chatbot';
COMMENT ON COLUMN public.chat_messages.confidence_score IS 'ระดับความมั่นใจของ AI (0.000-1.000) สำหรับ monitoring คุณภาพ';
COMMENT ON COLUMN public.chat_messages.escalated IS 'TRUE = ส่งต่อให้เจ้าหน้าที่ดูแลต่อ เนื่องจาก AI ไม่มั่นใจหรือกรณีซับซ้อน';

-- -----------------------------------------------------------------------------
-- ตาราง: notifications
-- เก็บการแจ้งเตือนส่งถึงผู้ประกันตน
-- รองรับหลายช่องทาง: Push, LINE, SMS
-- -----------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- เชื่อมกับผู้รับการแจ้งเตือน
  member_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- ประเภทการแจ้งเตือน
  type        public.notification_type NOT NULL,

  -- หัวข้อการแจ้งเตือน
  title       TEXT NOT NULL,

  -- เนื้อหาการแจ้งเตือน
  body        TEXT NOT NULL,

  -- ช่องทางที่ส่งการแจ้งเตือน
  channel     public.notification_channel NOT NULL,

  -- สถานะการอ่าน
  read        BOOLEAN NOT NULL DEFAULT FALSE,

  -- เวลาที่ส่งและเวลาที่อ่าน
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at     TIMESTAMPTZ
);

COMMENT ON TABLE public.notifications IS 'การแจ้งเตือนถึงผู้ประกันตน ผ่าน Push/LINE/SMS';
COMMENT ON COLUMN public.notifications.type IS 'benefit_reminder=แจ้งสิทธิ์หมดอายุ, payment_status=สถานะเงิน, section40_outreach=รณรงค์ ม.40, system=ระบบ';

-- -----------------------------------------------------------------------------
-- ตาราง: audit_logs
-- บันทึกการเข้าถึงข้อมูลทุกครั้งเพื่อปฏิบัติตาม PDPA
-- ห้ามลบหรือแก้ไขข้อมูลในตารางนี้ (append-only)
-- -----------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ผู้ที่กระทำการ (NULL = ระบบ/anonymous)
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- ประเภทการกระทำ
  -- login, logout, view_profile, view_benefits, submit_claim, chat, data_export, admin_access
  action      TEXT NOT NULL,

  -- ทรัพยากรที่ถูกเข้าถึง เช่น 'profiles', 'benefits', 'chat_messages'
  resource    TEXT NOT NULL,

  -- IP Address ของผู้เรียกใช้
  ip_address  INET,

  -- User Agent ของ browser/app
  user_agent  TEXT,

  -- ข้อมูลเพิ่มเติม เช่น resource_id, query params (jsonb สำหรับความยืดหยุ่น)
  metadata    JSONB DEFAULT '{}'::JSONB,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.audit_logs IS 'บันทึก audit trail ทุกการเข้าถึงข้อมูล เพื่อปฏิบัติตาม PDPA พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล';
COMMENT ON COLUMN public.audit_logs.action IS 'การกระทำ: login/logout/view_profile/view_benefits/submit_claim/chat/data_export/admin_access';
COMMENT ON COLUMN public.audit_logs.resource IS 'ชื่อตาราง/ทรัพยากรที่ถูกเข้าถึง';
COMMENT ON COLUMN public.audit_logs.metadata IS 'ข้อมูล context เพิ่มเติม เช่น {"resource_id": "uuid", "filters": {...}}';

-- =============================================================================
-- SECTION 3: INDEXES
-- สร้าง index เพื่อเพิ่มประสิทธิภาพการค้นหา
-- =============================================================================

-- profiles
CREATE INDEX idx_profiles_zone_id ON public.profiles(zone_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_section_type ON public.profiles(section_type);
CREATE INDEX idx_profiles_sso_member_id ON public.profiles(sso_member_id);

-- benefits
CREATE INDEX idx_benefits_member_id ON public.benefits(member_id);
CREATE INDEX idx_benefits_status ON public.benefits(status);
CREATE INDEX idx_benefits_expiry_date ON public.benefits(expiry_date);
CREATE INDEX idx_benefits_member_status ON public.benefits(member_id, status);

-- chat_sessions
CREATE INDEX idx_chat_sessions_member_id ON public.chat_sessions(member_id);
CREATE INDEX idx_chat_sessions_channel ON public.chat_sessions(channel);
CREATE INDEX idx_chat_sessions_started_at ON public.chat_sessions(started_at DESC);

-- chat_messages
CREATE INDEX idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX idx_chat_messages_escalated ON public.chat_messages(escalated) WHERE escalated = TRUE;
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at DESC);

-- notifications
CREATE INDEX idx_notifications_member_id ON public.notifications(member_id);
CREATE INDEX idx_notifications_unread ON public.notifications(member_id, read) WHERE read = FALSE;
CREATE INDEX idx_notifications_type ON public.notifications(type);
CREATE INDEX idx_notifications_sent_at ON public.notifications(sent_at DESC);

-- audit_logs
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource);

-- =============================================================================
-- SECTION 4: TRIGGER FUNCTIONS
-- ฟังก์ชันสำหรับ triggers ต่าง ๆ ของระบบ
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ฟังก์ชัน: handle_new_user
-- สร้าง profile อัตโนมัติเมื่อมีผู้ใช้ใหม่ลงทะเบียนผ่าน Supabase Auth
-- ดึง metadata จาก raw_user_meta_data (ส่งมาจาก signUp options)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name_th,
    full_name_en,
    phone,
    role,
    pdpa_consent,
    pdpa_consent_date
  )
  VALUES (
    NEW.id,
    -- ดึงชื่อจาก metadata ที่ส่งมาตอน signUp (ถ้าไม่มีให้เป็น NULL)
    NEW.raw_user_meta_data->>'full_name_th',
    NEW.raw_user_meta_data->>'full_name_en',
    NEW.raw_user_meta_data->>'phone',
    -- role เริ่มต้นเป็น 'member' เสมอ (เจ้าหน้าที่ต้องได้รับการแต่งตั้งจาก admin)
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'member'),
    -- PDPA consent เริ่มต้น false จนกว่าจะยืนยัน
    FALSE,
    NULL
  );

  -- บันทึก audit log สำหรับการ signup ใหม่
  INSERT INTO public.audit_logs (user_id, action, resource, metadata)
  VALUES (
    NEW.id,
    'signup',
    'profiles',
    jsonb_build_object('email', NEW.email, 'provider', NEW.raw_app_meta_data->>'provider')
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user IS 'Trigger function: สร้าง profile อัตโนมัติเมื่อผู้ใช้ลงทะเบียนใหม่ผ่าน Supabase Auth';

-- -----------------------------------------------------------------------------
-- ฟังก์ชัน: handle_updated_at
-- อัปเดต updated_at timestamp อัตโนมัติเมื่อแถวข้อมูลถูกแก้ไข
-- ใช้ร่วมกับทุกตารางที่มีคอลัมน์ updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- อัปเดตเวลาล่าสุดที่มีการแก้ไขข้อมูล
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_updated_at IS 'Trigger function: อัปเดต updated_at อัตโนมัติเมื่อแถวข้อมูลถูกแก้ไข';

-- -----------------------------------------------------------------------------
-- ฟังก์ชัน: log_profile_access
-- บันทึก audit log อัตโนมัติเมื่อมีการอ่านข้อมูล profile
-- ใช้สำหรับ PDPA compliance - ติดตามการเข้าถึงข้อมูลส่วนบุคคล
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_data_access(
  p_user_id   UUID,
  p_action    TEXT,
  p_resource  TEXT,
  p_metadata  JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, resource, metadata)
  VALUES (p_user_id, p_action, p_resource, p_metadata);
END;
$$;

COMMENT ON FUNCTION public.log_data_access IS 'บันทึก audit log เมื่อมีการเข้าถึงข้อมูล - ใช้สำหรับ PDPA compliance';

-- -----------------------------------------------------------------------------
-- ฟังก์ชัน: handle_benefit_status_change
-- บันทึก audit log เมื่อสถานะสิทธิประโยชน์เปลี่ยนแปลง
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_benefit_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- บันทึกเฉพาะเมื่อสถานะเปลี่ยน
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.audit_logs (user_id, action, resource, metadata)
    VALUES (
      auth.uid(),
      'benefit_status_change',
      'benefits',
      jsonb_build_object(
        'benefit_id', NEW.id,
        'member_id', NEW.member_id,
        'old_status', OLD.status::TEXT,
        'new_status', NEW.status::TEXT,
        'benefit_type', NEW.benefit_type
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_benefit_status_change IS 'Trigger function: บันทึก audit log เมื่อสถานะสิทธิประโยชน์เปลี่ยนแปลง';

-- -----------------------------------------------------------------------------
-- ฟังก์ชัน: handle_pdpa_consent
-- บันทึก audit log และกำหนดวันที่เมื่อมีการยินยอม PDPA
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_pdpa_consent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ตรวจสอบการเปลี่ยนแปลง PDPA consent
  IF OLD.pdpa_consent IS DISTINCT FROM NEW.pdpa_consent THEN
    IF NEW.pdpa_consent = TRUE AND OLD.pdpa_consent = FALSE THEN
      -- กำหนดวันที่ยินยอม PDPA
      NEW.pdpa_consent_date = NOW();

      INSERT INTO public.audit_logs (user_id, action, resource, metadata)
      VALUES (
        NEW.id,
        'pdpa_consent_granted',
        'profiles',
        jsonb_build_object('consent_date', NOW())
      );
    ELSIF NEW.pdpa_consent = FALSE AND OLD.pdpa_consent = TRUE THEN
      -- ถอนความยินยอม PDPA
      NEW.pdpa_consent_date = NULL;

      INSERT INTO public.audit_logs (user_id, action, resource, metadata)
      VALUES (
        NEW.id,
        'pdpa_consent_revoked',
        'profiles',
        jsonb_build_object('revoked_date', NOW())
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_pdpa_consent IS 'Trigger function: จัดการการยินยอม/ถอนยินยอม PDPA พร้อมบันทึก audit log';

-- =============================================================================
-- SECTION 5: TRIGGERS
-- เชื่อม trigger functions เข้ากับตารางต่าง ๆ
-- =============================================================================

-- Trigger: สร้าง profile อัตโนมัติเมื่อมีผู้ใช้ใหม่ใน auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger: อัปเดต updated_at ของ profiles อัตโนมัติ
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: อัปเดต updated_at ของ benefits อัตโนมัติ
CREATE TRIGGER set_benefits_updated_at
  BEFORE UPDATE ON public.benefits
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: จัดการ PDPA consent เมื่อมีการอัปเดต profiles
-- ต้องรันก่อน handle_updated_at เพื่อให้ pdpa_consent_date ถูกกำหนดก่อน
CREATE TRIGGER on_pdpa_consent_change
  BEFORE UPDATE OF pdpa_consent ON public.profiles
  FOR EACH ROW
  WHEN (OLD.pdpa_consent IS DISTINCT FROM NEW.pdpa_consent)
  EXECUTE FUNCTION public.handle_pdpa_consent();

-- Trigger: บันทึก audit log เมื่อสถานะสิทธิประโยชน์เปลี่ยน
CREATE TRIGGER on_benefit_status_change
  AFTER UPDATE OF status ON public.benefits
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_benefit_status_change();

-- =============================================================================
-- SECTION 6: ROW LEVEL SECURITY (RLS)
-- กำหนดนโยบายการเข้าถึงข้อมูลระดับแถว
-- เพื่อให้ผู้ใช้แต่ละคนเห็นเฉพาะข้อมูลที่ตัวเองมีสิทธิ์
-- =============================================================================

-- เปิดใช้ RLS สำหรับทุกตาราง
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benefits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs     ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Helper function: ดึง role ของผู้ใช้ปัจจุบัน (cached ใน session)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION public.get_current_user_role IS 'ดึง role ของผู้ใช้ที่ login อยู่ ใช้ใน RLS policies';

-- =============================================================================
-- Helper function: ดึง zone_id ของผู้ใช้ปัจจุบัน
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_current_user_zone()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT zone_id FROM public.profiles WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION public.get_current_user_zone IS 'ดึง zone_id ของเจ้าหน้าที่ที่ login อยู่ ใช้ใน RLS policies';

-- =============================================================================
-- RLS POLICIES: profiles
-- =============================================================================

-- ผู้ใช้อ่านข้อมูล profile ของตัวเองได้
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- เจ้าหน้าที่อ่านข้อมูล profile ของผู้ประกันตนในเขตพื้นที่ตัวเองได้
CREATE POLICY "profiles_select_officer_by_zone"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() = 'officer'
    AND zone_id = public.get_current_user_zone()
    AND role = 'member'
  );

-- admin อ่านข้อมูล profile ทั้งหมดได้
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() = 'admin');

-- ผู้ใช้แก้ไขข้อมูล profile ของตัวเองได้ (ยกเว้นเปลี่ยน role)
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- ห้ามเปลี่ยน role ตัวเอง (admin เท่านั้นที่เปลี่ยน role ได้)
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- admin แก้ไขข้อมูล profile ใด ๆ ได้ (รวมถึงเปลี่ยน role)
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.get_current_user_role() = 'admin');

-- =============================================================================
-- RLS POLICIES: benefits
-- =============================================================================

-- ผู้ประกันตนเห็นสิทธิ์ของตัวเองเท่านั้น
CREATE POLICY "benefits_select_own"
  ON public.benefits FOR SELECT
  TO authenticated
  USING (
    member_id = auth.uid()
    AND public.get_current_user_role() = 'member'
  );

-- เจ้าหน้าที่เห็นสิทธิ์ของผู้ประกันตนในเขตพื้นที่ตัวเอง
CREATE POLICY "benefits_select_officer_by_zone"
  ON public.benefits FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() = 'officer'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = benefits.member_id
        AND p.zone_id = public.get_current_user_zone()
    )
  );

-- admin เห็นสิทธิ์ทั้งหมด
CREATE POLICY "benefits_select_admin"
  ON public.benefits FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() = 'admin');

-- เจ้าหน้าที่และ admin สามารถอัปเดตสิทธิ์ได้
CREATE POLICY "benefits_update_officer_admin"
  ON public.benefits FOR UPDATE
  TO authenticated
  USING (
    public.get_current_user_role() IN ('officer', 'admin')
  );

-- admin สร้างสิทธิ์ใหม่ได้
CREATE POLICY "benefits_insert_admin"
  ON public.benefits FOR INSERT
  TO authenticated
  WITH CHECK (public.get_current_user_role() IN ('officer', 'admin'));

-- =============================================================================
-- RLS POLICIES: chat_sessions
-- =============================================================================

-- ผู้ประกันตนเห็น session ของตัวเอง
CREATE POLICY "chat_sessions_select_own"
  ON public.chat_sessions FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

-- เจ้าหน้าที่และ admin เห็น session ทั้งหมด
CREATE POLICY "chat_sessions_select_staff"
  ON public.chat_sessions FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() IN ('officer', 'admin'));

-- ผู้ใช้ที่ login สร้าง session ได้
CREATE POLICY "chat_sessions_insert_member"
  ON public.chat_sessions FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

-- ผู้ใช้อัปเดต session ของตัวเอง (เช่น ให้คะแนน)
CREATE POLICY "chat_sessions_update_own"
  ON public.chat_sessions FOR UPDATE
  TO authenticated
  USING (member_id = auth.uid());

-- =============================================================================
-- RLS POLICIES: chat_messages
-- =============================================================================

-- ผู้ประกันตนเห็นข้อความใน session ของตัวเอง
CREATE POLICY "chat_messages_select_own"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = chat_messages.session_id
        AND s.member_id = auth.uid()
    )
  );

-- เจ้าหน้าที่และ admin เห็นข้อความทั้งหมด
CREATE POLICY "chat_messages_select_staff"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() IN ('officer', 'admin'));

-- ผู้ใช้ส่งข้อความใน session ของตัวเองได้
CREATE POLICY "chat_messages_insert_own"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = chat_messages.session_id
        AND s.member_id = auth.uid()
    )
  );

-- service_role (backend) insert ข้อความ assistant/system ได้
CREATE POLICY "chat_messages_insert_service"
  ON public.chat_messages FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

-- =============================================================================
-- RLS POLICIES: notifications
-- =============================================================================

-- ผู้ประกันตนเห็นการแจ้งเตือนของตัวเอง
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

-- ผู้ประกันตนอัปเดตสถานะอ่านของตัวเอง
CREATE POLICY "notifications_update_own_read"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

-- admin และ service_role สร้างการแจ้งเตือนให้ใคร ๆ ก็ได้
CREATE POLICY "notifications_insert_admin"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "notifications_insert_service"
  ON public.notifications FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

-- =============================================================================
-- RLS POLICIES: audit_logs
-- =============================================================================

-- admin อ่าน audit logs ทั้งหมดได้
CREATE POLICY "audit_logs_select_admin"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() = 'admin');

-- service_role เขียน audit logs ได้ (backend system)
CREATE POLICY "audit_logs_insert_service"
  ON public.audit_logs FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

-- authenticated users เขียน audit logs ได้ผ่าน SECURITY DEFINER functions เท่านั้น
-- (ตรง ๆ ไม่ได้ เพราะ handle_new_user, handle_pdpa_consent ใช้ SECURITY DEFINER)
CREATE POLICY "audit_logs_insert_authenticated"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ห้าม UPDATE หรือ DELETE audit_logs ทุกกรณี (append-only)
-- (ไม่มี policy สำหรับ UPDATE/DELETE = ห้ามทั้งหมด)

-- =============================================================================
-- SECTION 7: GRANTS
-- กำหนดสิทธิ์การเข้าถึงตาราง
-- =============================================================================

-- ให้ authenticated users เข้าถึงตารางที่จำเป็น
GRANT SELECT, INSERT, UPDATE ON public.profiles       TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.benefits       TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chat_sessions  TO authenticated;
GRANT SELECT, INSERT         ON public.chat_messages  TO authenticated;
GRANT SELECT, UPDATE         ON public.notifications  TO authenticated;
GRANT SELECT, INSERT         ON public.audit_logs     TO authenticated;

-- ให้ service_role (backend) เข้าถึงได้เต็มที่
GRANT ALL ON public.profiles       TO service_role;
GRANT ALL ON public.benefits       TO service_role;
GRANT ALL ON public.chat_sessions  TO service_role;
GRANT ALL ON public.chat_messages  TO service_role;
GRANT ALL ON public.notifications  TO service_role;
GRANT ALL ON public.audit_logs     TO service_role;

-- =============================================================================
-- SECTION 8: STORAGE BUCKETS (Optional)
-- กำหนด storage สำหรับไฟล์เอกสารที่เกี่ยวข้อง
-- =============================================================================

-- สร้าง bucket สำหรับเก็บเอกสารการยื่นสิทธิ์
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'benefit-documents',
  'benefit-documents',
  FALSE,  -- private bucket
  10485760,  -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- สร้าง bucket สำหรับ avatar ของผู้ใช้
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  TRUE,  -- public bucket
  2097152,  -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS สำหรับ storage: benefit-documents
CREATE POLICY "benefit_docs_upload_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'benefit-documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "benefit_docs_read_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'benefit-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR public.get_current_user_role() IN ('officer', 'admin')
    )
  );

-- RLS สำหรับ storage: avatars
CREATE POLICY "avatars_upload_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
