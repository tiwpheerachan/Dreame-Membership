-- ============================================================
-- Migration 0020: Refund logic — รองรับ 'redeemed' status
--
-- ปัญหาก่อนหน้า: refund_redemption ไม่ block 'redeemed' (ยังไม่ใช้ code)
-- ทำให้ admin refund ได้ → คืน points + stock — แต่ Shopify code ยังใช้ได้
-- (เพราะ RPC ไม่รู้เรื่อง Shopify)
--
-- ตอนนี้ Node ฝั่ง /api/admin/redemptions/[id] (route.ts) handle Shopify cleanup
-- เอง RPC แค่คืน points + stock + status เปลี่ยนเป็น cancelled
--
-- ปรับ RPC ให้:
--   1. รองรับ status 'redeemed', 'expired' (เพิ่งเพิ่มใน migration 0019)
--   2. Allow refund ทุก status ยกเว้น delivered + cancelled
-- ============================================================

CREATE OR REPLACE FUNCTION public.refund_redemption(
  p_redemption_id UUID,
  p_admin_id      UUID,
  p_reason        TEXT
) RETURNS JSONB AS $$
DECLARE
  v_red    public.redemptions%ROWTYPE;
BEGIN
  SELECT * INTO v_red FROM public.redemptions WHERE id = p_redemption_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'redemption not found');
  END IF;
  IF v_red.status = 'cancelled' THEN
    RETURN jsonb_build_object('error', 'ยกเลิกไปแล้ว');
  END IF;
  IF v_red.status = 'delivered' THEN
    RETURN jsonb_build_object('error', 'ใช้ code/ส่งของแล้ว ไม่สามารถ refund ได้');
  END IF;

  -- คืน points
  UPDATE public.users
     SET total_points = total_points + v_red.points_used
   WHERE id = v_red.user_id;

  -- คืน stock ถ้า reward นั้นเป็น limited stock
  UPDATE public.rewards
     SET stock_remaining = COALESCE(stock_remaining, 0) + 1
   WHERE id = v_red.reward_id
     AND stock IS NOT NULL;

  UPDATE public.redemptions
     SET status        = 'cancelled',
         refunded_at   = NOW(),
         refunded_by   = p_admin_id,
         refund_reason = p_reason
   WHERE id = p_redemption_id;

  RETURN jsonb_build_object(
    'success',          true,
    'refunded_points',  v_red.points_used,
    'was_status',       v_red.status,
    'shopify_code',     v_red.shopify_code  -- ฝั่ง Node จะใช้ลบ Shopify code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
