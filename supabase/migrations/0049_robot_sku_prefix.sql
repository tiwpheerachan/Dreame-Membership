-- ============================================================
-- Migration 0049: จำแนกหุ่นยนต์จากรหัส SKU (RLX/RLR/RLL) + backfill ที่ตกหล่น
--
-- ปัญหา: ออเดอร์ Brand Shop บางตัวชื่อสินค้าเป็น "รหัส SKU ล้วน" เช่น RLX83LE
--        (ไม่มีคำว่า robot/หุ่นยนต์/机器人 และไม่ใช่รูปแบบ X50/L40) → is_dreame_robot
--        อ่านไม่ออก → ไม่ auto-grant น้ำยา ทั้งที่เข้าเงื่อนไข (Brand Shop ≥30,000)
--
-- ตรวจ BQ แล้ว: prefix RLX/RLR/RLL + ตัวเลข = SKU หุ่นยนต์ Dreame ทั้งหมด
--   RLR81CE=Aqua10 Pro Track · RLX85CE=X50 Ultra · RLX92DE=X60 Ultra
--   RLL43SE=L30S Ultra · RLL53SE=L10s/L50 Ultra · RLX83LE=หุ่นยนต์ Brand Shop ฿47,990
--
-- แก้: (A) เพิ่ม branch C ใน is_dreame_robot จับ ^rl[xrl][0-9]
--      (B) backfill ออเดอร์ Brand Shop ที่ยืนยันแล้ว+เข้าเงื่อนไขแต่ยังไม่ได้สิทธิ
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_dreame_robot(txt text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT txt IS NOT NULL AND (
    -- (A) คำบ่งชี้หุ่นยนต์ตรงๆ
    lower(txt) ~ 'robot'
    OR txt LIKE '%หุ่นยนต์%'
    OR txt LIKE '%机器人%'
    -- (B) รหัสรุ่นหุ่นยนต์ Dreame (X/L/Aqua) ที่ไม่ใช่อะไหล่
    OR (
      (lower(txt) ~ 'dreame' OR txt LIKE '%追觅%')
      AND lower(txt) ~ '(^|[^a-z0-9])(aqua ?10|x[1-6]0|l[1-5]0s?)([^0-9]|$)'
      AND lower(txt) !~ 'brush|filter|กรอง|แปรง|ผ้า|mop|อะไหล่|accessor|อุปกรณ์เสริม|配件|套装|滤网|尘袋|边刷|cleaner|solution|น้ำยา|hookup|rubber|dust|bag| set|ขั้วชาร์จ|ฐาน|บอดี้'
    )
    -- (C) รหัส SKU หุ่นยนต์ Dreame ล้วน (RLX/RLR/RLL + ตัวเลข) เช่น RLX83LE
    OR lower(txt) ~ '(^|[^a-z0-9])(rlx|rlr|rll)[0-9]'
  );
$$;

-- ── Backfill: Brand Shop ที่ยืนยันแล้ว + ≥30,000 + หุ่นยนต์ (ตามตัวจำแนกใหม่) ──
INSERT INTO public.refill_privileges (
  user_id, phone, customer_name, transaction_id, model, order_amount,
  purchased_at, source, purchase_reg_id, note)
SELECT pr.user_id,
       NULLIF(right(regexp_replace(COALESCE(u.phone,''), '\D','','g'), 9), ''),
       u.full_name, pr.order_sn, pr.model_name, pr.total_amount,
       COALESCE(pr.purchase_date::timestamptz, pr.created_at, now()),
       'AUTO_PURCHASE', pr.id, 'auto backfill: Brand Shop robot ≥30,000'
  FROM public.purchase_registrations pr
  JOIN public.users u ON u.id = pr.user_id
 WHERE pr.channel::text = 'BRANDSHOP'
   AND pr.status IN ('BQ_VERIFIED','ADMIN_APPROVED')
   AND COALESCE(pr.total_amount,0) >= 30000
   AND length(NULLIF(right(regexp_replace(COALESCE(u.phone,''), '\D','','g'),9),'')) = 9
   AND (public.is_dreame_robot(pr.model_name)
        OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(pr.bq_raw_data->'items','[]'::jsonb)) it
                   WHERE public.is_dreame_robot(it->>'item_name') OR public.is_dreame_robot(it->>'model_name')))
   AND NOT EXISTS (SELECT 1 FROM public.refill_privileges rp WHERE rp.purchase_reg_id = pr.id)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
