-- ============================================================
-- Migration 0015: Coupon status (active / paused / archived)
--
-- เพิ่มคอลัมน์ status ที่ตาราง coupons เพื่อให้ admin
--   • ปิดการใช้ชั่วคราว (paused) — user เห็น แต่กดใช้ไม่ได้ ผ่าน UI
--   • เก็บถาวร (archived) — ซ่อนจากทุกคน รวมทั้ง admin filter ปกติ
-- โดยไม่ต้องลบ row → เก็บ data + audit ไว้ครบ
--
-- 'draft' ใช้สำหรับคูปองที่กำลังสร้าง แต่ยังไม่พร้อมเปิดให้ใช้
-- (ตอนนี้ frontend ยังไม่มี draft flow — เผื่อ extend ภายหลัง)
-- ============================================================

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'archived', 'draft'));

COMMENT ON COLUMN public.coupons.status IS
  'active = ใช้งานได้ปกติ | paused = ปิดชั่วคราว ฝั่ง user ไม่เห็น | archived = ซ่อนถาวร | draft = ยังไม่พร้อมเปิด';

-- Index: query fast ฝั่ง user (filter status = active)
CREATE INDEX IF NOT EXISTS idx_coupons_user_active
  ON public.coupons(user_id, status, valid_until DESC)
  WHERE user_id IS NOT NULL AND status = 'active';

-- ── Update self_heal function to skip draft/archived ─
-- (active + paused เท่านั้นที่ "นับ" ว่ามีคูปอง)
CREATE OR REPLACE FUNCTION public.self_heal_user_coupons(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_before INTEGER;
  v_after  INTEGER;
  v_active BOOLEAN;
BEGIN
  SELECT is_active INTO v_active FROM public.users WHERE id = p_user_id;
  IF NOT FOUND OR NOT v_active THEN RETURN 0; END IF;

  SELECT COUNT(*) INTO v_before
    FROM public.coupons
   WHERE user_id = p_user_id
     AND status IN ('active', 'paused');

  PERFORM public.apply_tier_coupons(p_user_id);
  PERFORM public.apply_shopify_tier_campaigns(p_user_id, 'signup');

  SELECT COUNT(*) INTO v_after
    FROM public.coupons
   WHERE user_id = p_user_id
     AND status IN ('active', 'paused');

  RETURN v_after - v_before;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
