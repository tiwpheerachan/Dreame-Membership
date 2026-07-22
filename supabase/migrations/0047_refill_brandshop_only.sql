-- ============================================================
-- Migration 0047: auto-grant น้ำยาฟรี "เฉพาะ Brand Shop"
--
-- เดิม (0044) grant ทุกช่องทางที่เป็นหุ่นยนต์ ≥30,000. ตอนนี้จำกัดให้เฉพาะ
-- ออเดอร์ที่ระบบจำแนกเป็น Brand Shop (channel = 'BRANDSHOP') เท่านั้น
-- (มาจากปุ่มหน้าร้าน + BQ shop_type='brand_shop'). ช่องอื่น (online / หน้าร้านทั่วไป)
-- จะไม่ได้สิทธิน้ำยาอัตโนมัติอีกต่อไป.
--
-- เงื่อนไขครบ: channel=BRANDSHOP  AND  status ยืนยันแล้ว  AND  ยอด ≥30,000  AND  หุ่นยนต์
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_grant_refill()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone     text;
  v_name      text;
  v_has_robot boolean := false;
  v_item      jsonb;
BEGIN
  -- ★ เฉพาะ Brand Shop เท่านั้น
  IF NEW.channel::text <> 'BRANDSHOP' THEN RETURN NEW; END IF;
  -- ยืนยันแล้วเท่านั้น
  IF NEW.status NOT IN ('BQ_VERIFIED','ADMIN_APPROVED') THEN RETURN NEW; END IF;
  -- UPDATE: ทำเฉพาะตอน "เพิ่งเปลี่ยนเป็นยืนยัน"
  IF TG_OP = 'UPDATE' AND OLD.status IN ('BQ_VERIFIED','ADMIN_APPROVED') THEN RETURN NEW; END IF;
  -- ยอด ≥ 30,000
  IF COALESCE(NEW.total_amount, 0) < 30000 THEN RETURN NEW; END IF;
  -- เคยให้สิทธิจากออเดอร์นี้แล้ว?
  IF EXISTS (SELECT 1 FROM public.refill_privileges WHERE purchase_reg_id = NEW.id) THEN RETURN NEW; END IF;

  -- เป็นหุ่นยนต์ไหม
  v_has_robot := public.is_dreame_robot(NEW.model_name);
  IF NOT v_has_robot AND NEW.bq_raw_data IS NOT NULL THEN
    FOR v_item IN
      SELECT jsonb_array_elements(COALESCE(NEW.bq_raw_data->'items', '[]'::jsonb))
    LOOP
      IF public.is_dreame_robot(v_item->>'item_name')
         OR public.is_dreame_robot(v_item->>'model_name') THEN
        v_has_robot := true;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  IF NOT v_has_robot THEN RETURN NEW; END IF;

  -- เบอร์ (จำเป็น NOT NULL)
  SELECT NULLIF(right(regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g'), 9), ''),
         u.full_name
    INTO v_phone, v_name
  FROM public.users u WHERE u.id = NEW.user_id;
  IF v_phone IS NULL OR length(v_phone) < 9 THEN
    RAISE WARNING 'auto_grant_refill: reg % (BRANDSHOP) qualifies but user % has no valid phone — skipped', NEW.id, NEW.user_id;
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.refill_privileges (
      user_id, phone, customer_name, transaction_id, model, order_amount,
      purchased_at, source, purchase_reg_id, note
    ) VALUES (
      NEW.user_id, v_phone, v_name, NEW.order_sn, NEW.model_name, NEW.total_amount,
      COALESCE(NEW.purchase_date::timestamptz, NEW.created_at, now()),
      'AUTO_PURCHASE', NEW.id,
      'auto: Brand Shop robot ≥30,000'
    );
  EXCEPTION
    WHEN unique_violation THEN NULL;
    WHEN others THEN RAISE WARNING 'auto_grant_refill failed for reg %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ล้างสิทธิ auto ที่ให้ไปก่อนหน้ากับช่องทางที่ไม่ใช่ Brand Shop (รวม backfill/test เดิม)
-- soft-delete เพื่อกู้คืนได้ถ้าจำเป็น
UPDATE public.refill_privileges rp
SET deleted_at = COALESCE(rp.deleted_at, now())
FROM public.purchase_registrations pr
WHERE rp.purchase_reg_id = pr.id
  AND rp.source = 'AUTO_PURCHASE'
  AND pr.channel::text <> 'BRANDSHOP'
  AND rp.deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
