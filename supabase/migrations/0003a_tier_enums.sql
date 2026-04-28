-- ============================================================
-- Migration 0003a: Add new tier enum values ONLY
-- ============================================================
-- ⚠️ ต้องรันไฟล์นี้ก่อน 0003b
-- เหตุผล: PostgreSQL ไม่อนุญาตให้ใช้ค่า enum ใหม่ในธุรกรรมเดียวกับที่ ALTER TYPE
-- ดังนั้นต้องรันให้ COMMIT จบก่อน แล้วค่อย UPDATE/CREATE FUNCTION ที่อ้างถึง enum ใหม่
-- ============================================================

ALTER TYPE user_tier ADD VALUE IF NOT EXISTS 'PLUS';
ALTER TYPE user_tier ADD VALUE IF NOT EXISTS 'PRO';
ALTER TYPE user_tier ADD VALUE IF NOT EXISTS 'ULTRA';
ALTER TYPE user_tier ADD VALUE IF NOT EXISTS 'MASTER';

-- ✅ เสร็จแล้ว — ไปรัน 0003b_tier_promo_data.sql ต่อ
