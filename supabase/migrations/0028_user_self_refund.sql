-- ============================================================
-- Migration 0028: User self-refund coupon
--
-- เปิดให้ user แลกคืน reward coupon ที่ยังไม่ใช้
-- → คืนแต้มกลับ + ลบคูปอง + cancel redemption
--
-- เงื่อนไข:
--   - เจ้าของ coupon เท่านั้น (auth.uid() = coupon.user_id)
--   - coupon ยังไม่ใช้ (used_at IS NULL)
--   - coupon ยังไม่หมดอายุ
--   - redemption.status ∈ ('redeemed', 'pending')   -- ไม่ใช่ delivered/shipped
--   - coupon มาจาก reward (auto_issue_key LIKE 'REWARD_%')
-- ============================================================

CREATE OR REPLACE FUNCTION public.self_refund_coupon(
  p_coupon_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_caller       UUID := auth.uid();
  v_coupon       public.coupons%ROWTYPE;
  v_red          public.redemptions%ROWTYPE;
  v_user_total   INTEGER;
  v_new_balance  INTEGER;
  v_reward_name  TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- 1. หา coupon + lock
  SELECT * INTO v_coupon FROM public.coupons WHERE id = p_coupon_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'ไม่พบคูปอง');
  END IF;

  -- 2. เช็คเจ้าของ
  IF v_coupon.user_id IS NULL OR v_coupon.user_id <> v_caller THEN
    RETURN jsonb_build_object('error', 'คุณไม่ใช่เจ้าของคูปอง');
  END IF;

  -- 3. เช็คว่าคูปองมาจาก reward
  IF v_coupon.auto_issue_key IS NULL OR v_coupon.auto_issue_key NOT LIKE 'REWARD_%' THEN
    RETURN jsonb_build_object('error', 'คูปองนี้ไม่สามารถแลกคืนได้');
  END IF;

  -- 4. ต้องยังไม่ใช้ + ยังไม่หมดอายุ
  IF v_coupon.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'คูปองถูกใช้ไปแล้ว ไม่สามารถแลกคืนได้');
  END IF;
  IF v_coupon.valid_until < CURRENT_DATE THEN
    RETURN jsonb_build_object('error', 'คูปองหมดอายุแล้ว ไม่สามารถแลกคืนได้');
  END IF;

  -- 5. หา redemption ที่ link กับ coupon นี้ (ผ่าน shopify_code = coupon.code)
  SELECT * INTO v_red
    FROM public.redemptions
   WHERE user_id      = v_caller
     AND shopify_code = v_coupon.code
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'ไม่พบประวัติการแลกคูปองนี้');
  END IF;

  IF v_red.status NOT IN ('redeemed', 'pending') THEN
    RETURN jsonb_build_object('error',
      'คูปองนี้ไม่สามารถแลกคืนได้ (status: ' || v_red.status || ')');
  END IF;

  -- 6. คืน points
  SELECT total_points INTO v_user_total
    FROM public.users WHERE id = v_caller FOR UPDATE;
  v_new_balance := v_user_total + v_red.points_used;
  UPDATE public.users SET total_points = v_new_balance WHERE id = v_caller;

  -- 7. คืน stock
  UPDATE public.rewards
     SET stock_remaining = COALESCE(stock_remaining, 0) + 1
   WHERE id = v_red.reward_id AND stock IS NOT NULL;

  -- 8. cancel redemption
  UPDATE public.redemptions
     SET status        = 'cancelled',
         refunded_at   = NOW(),
         refunded_by   = v_caller,
         refund_reason = 'user_self_refund'
   WHERE id = v_red.id;

  -- 9. archive coupon (status=archived) — ไม่ให้โผล่ใน /coupons อีก
  -- ทำผ่าน status เพราะ valid_until เป็น NOT NULL อาจมี constraint
  UPDATE public.coupons
     SET status = 'archived',
         updated_at = NOW()
   WHERE id = p_coupon_id;

  -- 10. เขียน points_log
  v_reward_name := COALESCE(v_red.reward_snapshot->>'name', 'reward');
  INSERT INTO public.points_log (
    user_id, points_delta, balance_after, type, description
  ) VALUES (
    v_caller, v_red.points_used, v_new_balance, 'ADMIN_ADJUST',
    'แลกคืนคูปอง: ' || v_reward_name
  );

  RETURN jsonb_build_object(
    'success', true,
    'refunded_points', v_red.points_used,
    'new_balance',     v_new_balance,
    'reward_name',     v_reward_name,
    'coupon_code',     v_coupon.code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.self_refund_coupon(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
