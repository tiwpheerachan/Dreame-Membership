-- ============================================================
-- Migration 0030: Fix self_refund_coupon — remove updated_at
--
-- ปัญหา: coupons table ไม่มี column updated_at (มีแค่ created_at)
-- → RPC fail ตอน archive coupon: "column updated_at does not exist"
--
-- แก้: เอา updated_at = NOW() ออก
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

  SELECT * INTO v_coupon FROM public.coupons WHERE id = p_coupon_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'ไม่พบคูปอง');
  END IF;

  IF v_coupon.user_id IS NULL OR v_coupon.user_id <> v_caller THEN
    RETURN jsonb_build_object('error', 'คุณไม่ใช่เจ้าของคูปอง');
  END IF;

  IF v_coupon.auto_issue_key IS NULL OR v_coupon.auto_issue_key NOT LIKE 'REWARD_%' THEN
    RETURN jsonb_build_object('error', 'คูปองนี้ไม่สามารถแลกคืนได้');
  END IF;

  IF v_coupon.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'คูปองถูกใช้ไปแล้ว ไม่สามารถแลกคืนได้');
  END IF;
  IF v_coupon.valid_until < CURRENT_DATE THEN
    RETURN jsonb_build_object('error', 'คูปองหมดอายุแล้ว ไม่สามารถแลกคืนได้');
  END IF;

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

  IF v_red.status NOT IN ('pending', 'redeemed', 'confirmed') THEN
    RETURN jsonb_build_object('error',
      CASE
        WHEN v_red.status = 'shipping'  THEN 'ของถูกจัดส่งแล้ว ไม่สามารถแลกคืนได้'
        WHEN v_red.status = 'delivered' THEN 'ใช้คูปองหรือรับของแล้ว ไม่สามารถแลกคืนได้'
        WHEN v_red.status = 'cancelled' THEN 'การแลกถูกยกเลิกไปแล้ว'
        WHEN v_red.status = 'expired'   THEN 'การแลกหมดอายุแล้ว'
        ELSE 'คูปองนี้ไม่สามารถแลกคืนได้ (status: ' || v_red.status || ')'
      END);
  END IF;

  -- คืน points
  SELECT total_points INTO v_user_total
    FROM public.users WHERE id = v_caller FOR UPDATE;
  v_new_balance := v_user_total + v_red.points_used;
  UPDATE public.users SET total_points = v_new_balance WHERE id = v_caller;

  -- คืน stock
  UPDATE public.rewards
     SET stock_remaining = COALESCE(stock_remaining, 0) + 1
   WHERE id = v_red.reward_id AND stock IS NOT NULL;

  -- cancel redemption
  UPDATE public.redemptions
     SET status        = 'cancelled',
         refunded_at   = NOW(),
         refunded_by   = v_caller,
         refund_reason = 'user_self_refund'
   WHERE id = v_red.id;

  -- archive coupon (FIX: ไม่มี updated_at, ใช้ status เดียวพอ)
  UPDATE public.coupons
     SET status = 'archived'
   WHERE id = p_coupon_id;

  -- points_log
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

NOTIFY pgrst, 'reload schema';
