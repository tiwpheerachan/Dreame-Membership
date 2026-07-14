'use client'
import { useState, useMemo } from 'react'
import { Upload, CheckCircle, XCircle, Download, FileText, AlertTriangle } from 'lucide-react'

const TEMPLATE = `member_id,phone,email,order_sn,invoice_no,channel,channel_type,model_name,sku,serial_number,purchase_date,total_amount,warranty_months
DRM-100001,,,DRM-2025001,INV-001,STORE,ONSITE,Dreame X40 Ultra,RLS3D,SN12345,2025-01-15,40990,24
,0812345678,,DRM-2025002,INV-002,SHOPEE,ONLINE,"Dreame H12, Pro Edition",H12-SKU,SN67890,2025-02-01,8990,12`

interface RowResult { row: number; ok: boolean; message: string }
interface Result { total: number; success: number; failed: number; results: RowResult[] }

// RFC 4180 minimal CSV parser — handles quoted fields with commas and escaped quotes
function parseCSVLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else cur += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { cells.push(cur); cur = '' }
      else cur += ch
    }
  }
  cells.push(cur)
  return cells.map(c => c.trim())
}

function parseCSV(text: string) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = parseCSVLine(lines[0])
  const rows = lines.slice(1).map(l => {
    const cells = parseCSVLine(l)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = cells[i] || '' })
    return obj
  })
  return { headers, rows }
}

// Schema validation rules
const REQUIRED_FIELDS = ['order_sn', 'channel'] as const
const NUMERIC_FIELDS = ['total_amount', 'warranty_months'] as const
const DATE_FIELDS = ['purchase_date'] as const
const VALID_CHANNELS = ['STORE', 'SHOPEE', 'LAZADA', 'WEBSITE', 'TIKTOK', 'BRANDSHOP', 'OTHER']
const VALID_CHANNEL_TYPES = ['ONLINE', 'ONSITE']

function validateRow(row: Record<string, string>, rowIdx: number): string[] {
  const errs: string[] = []

  // Must have at least one user identifier
  if (!row.member_id?.trim() && !row.phone?.trim() && !row.email?.trim()) {
    errs.push('ต้องมี member_id หรือ phone หรือ email อย่างน้อย 1 อย่าง')
  }

  for (const f of REQUIRED_FIELDS) {
    if (!row[f]?.trim()) errs.push(`${f} จำเป็น`)
  }

  for (const f of NUMERIC_FIELDS) {
    const v = row[f]?.trim()
    if (v && isNaN(Number(v))) errs.push(`${f} ต้องเป็นตัวเลข (got "${v}")`)
  }

  for (const f of DATE_FIELDS) {
    const v = row[f]?.trim()
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      errs.push(`${f} ต้องเป็น YYYY-MM-DD (got "${v}")`)
    }
  }

  if (row.channel && !VALID_CHANNELS.includes(row.channel.toUpperCase())) {
    errs.push(`channel "${row.channel}" ไม่ valid (ต้องเป็น ${VALID_CHANNELS.join('/')})`)
  }

  if (row.channel_type && !VALID_CHANNEL_TYPES.includes(row.channel_type.toUpperCase())) {
    errs.push(`channel_type ต้องเป็น ONLINE หรือ ONSITE`)
  }

  return errs
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Record<string, string>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  // Validation per row
  const validation = useMemo(() => preview.map((r, i) => validateRow(r, i)), [preview])
  const errorCount  = validation.filter(e => e.length > 0).length
  const validRows   = preview.filter((_, i) => validation[i].length === 0)
  const canImport   = preview.length > 0 && validRows.length > 0

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f); setResult(null)
    const text = await f.text()
    const { headers, rows } = parseCSV(text)
    setHeaders(headers)
    setPreview(rows)
  }

  async function runImport() {
    if (validRows.length === 0) return
    setImporting(true); setResult(null)
    const r = await fetch('/api/admin/import/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: validRows }),
    })
    const d = await r.json()
    setImporting(false)
    if (r.ok) setResult(d)
    else alert(d.error || 'นำเข้าไม่สำเร็จ')
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'dreame_purchases_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--admin-bg)' }}>
      <header className="border-b flex-shrink-0"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="px-6 lg:px-8 py-5">
          <p style={{ color: 'var(--admin-gold)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500, marginBottom: 4 }}>
            Bulk Import
          </p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--admin-ink)' }}>นำเข้า Purchase (CSV)</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--admin-ink-mute)' }}>
            อัพโหลด CSV เพื่อสร้าง purchase หลายรายการ — ระบบจะให้คะแนนอัตโนมัติ
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-5 space-y-5">

      {/* Schema info */}
      <div className="admin-card p-5">
        <p className="text-xs mb-3" style={{ color: 'var(--admin-ink-mute)' }}>
          คอลัมน์:{' '}
          <code className="px-1.5 py-0.5 rounded text-[11px]"
            style={{ background: 'var(--admin-bg)', color: 'var(--admin-ink-soft)' }}>
            member_id, phone, email, order_sn, invoice_no, channel, channel_type, model_name, sku, serial_number, purchase_date, total_amount, warranty_months
          </code>
        </p>
        <p className="text-xs mb-3" style={{ color: 'var(--admin-ink-mute)' }}>
          ระบบจะหา user จาก <strong>member_id / phone / email</strong> (อันใดอันหนึ่ง) — ถ้าไม่พบจะข้ามแถว
        </p>
        <button onClick={downloadTemplate} className="admin-btn admin-btn-ghost">
          <Download size={13} /> Download template
        </button>
      </div>

      {/* Upload */}
      <div className="admin-card p-5">
        <label className="flex flex-col items-center gap-3 cursor-pointer rounded-xl p-9"
          style={{ border: '2px dashed var(--admin-border)', background: 'var(--admin-bg)' }}>
          <Upload size={28} style={{ color: 'var(--admin-ink-mute)' }} />
          <p className="font-semibold text-sm" style={{ color: 'var(--admin-ink)' }}>
            {file ? file.name : 'คลิกเพื่อเลือก CSV หรือลากไฟล์มาวาง'}
          </p>
          <p className="text-xs" style={{ color: 'var(--admin-ink-faint)' }}>
            UTF-8 · comma-separated · รองรับ quoted fields (RFC 4180) · max 10MB
          </p>
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
        </label>
      </div>

      {/* Validation summary */}
      {preview.length > 0 && (
        <div className="admin-card p-4 flex items-center gap-4"
          style={{
            borderColor: errorCount > 0 ? 'rgba(177,66,66,0.25)' : 'rgba(58,142,90,0.25)',
            background: errorCount > 0 ? 'rgba(177,66,66,0.04)' : 'rgba(58,142,90,0.04)',
          }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: errorCount > 0 ? 'rgba(177,66,66,0.12)' : 'rgba(58,142,90,0.12)' }}>
            {errorCount > 0
              ? <AlertTriangle size={18} style={{ color: '#B14242' }} />
              : <CheckCircle size={18} style={{ color: '#3A8E5A' }} />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: 'var(--admin-ink)' }}>
              {errorCount > 0
                ? `เจอข้อผิดพลาด ${errorCount} แถว — จะข้ามและ import เฉพาะ ${validRows.length} แถวที่ valid`
                : `ทุกแถวผ่านการตรวจสอบ — พร้อม import ${preview.length} แถว`}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--admin-ink-mute)' }}>
              schema validation: required fields, format date, ตัวเลข, channel enum
            </p>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="admin-card overflow-hidden">
          <div className="px-5 py-4 flex justify-between items-center"
            style={{ borderBottom: '1px solid var(--admin-border-2)' }}>
            <div>
              <p className="font-bold text-sm flex items-center gap-1.5" style={{ color: 'var(--admin-ink)' }}>
                <FileText size={13} /> Preview · {preview.length} แถว
              </p>
              <p className="text-xs" style={{ color: 'var(--admin-ink-mute)' }}>
                ตรวจดูก่อนยืนยันการนำเข้า — แถวที่มี error จะถูกข้าม
              </p>
            </div>
            <button onClick={runImport} disabled={!canImport || importing} className="admin-btn admin-btn-ink">
              {importing ? 'กำลังนำเข้า...' : `Import ${validRows.length} แถวที่ valid`}
            </button>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Status</th>
                  {headers.map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 50).map((r, i) => {
                  const errs = validation[i]
                  const hasErr = errs.length > 0
                  return (
                    <tr key={i} style={{ background: hasErr ? 'rgba(177,66,66,0.04)' : undefined }}>
                      <td className="muted">{i + 1}</td>
                      <td>
                        {hasErr
                          ? <span className="admin-pill admin-pill-red" title={errs.join('\n')}>
                              <XCircle size={10} /> {errs.length} error
                            </span>
                          : <span className="admin-pill admin-pill-green">
                              <CheckCircle size={10} /> ok
                            </span>}
                      </td>
                      {headers.map(h => <td key={h} className="text-[11px]">{r[h] || '-'}</td>)}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {preview.length > 50 && (
              <p className="p-3 text-center text-xs" style={{ color: 'var(--admin-ink-faint)' }}>
                แสดง 50 แถวแรก · ทั้งหมด {preview.length} แถว ({validRows.length} valid, {errorCount} invalid)
              </p>
            )}
          </div>
        </div>
      )}

      {/* Show first errors detail */}
      {errorCount > 0 && (
        <div className="admin-card p-5">
          <p className="text-sm font-bold mb-3 flex items-center gap-1.5" style={{ color: '#B14242' }}>
            <AlertTriangle size={14} /> รายละเอียด errors ({errorCount})
          </p>
          <div className="space-y-2 max-h-48 overflow-auto">
            {validation.map((errs, i) => {
              if (errs.length === 0) return null
              return (
                <div key={i} className="rounded-lg p-2"
                  style={{ background: 'rgba(177,66,66,0.06)', border: '1px solid rgba(177,66,66,0.20)' }}>
                  <p className="text-xs font-semibold" style={{ color: '#B14242' }}>
                    แถว {i + 1}: {preview[i].order_sn || '(no order_sn)'}
                  </p>
                  <ul className="ml-4 mt-1 text-[11px] list-disc" style={{ color: 'var(--admin-ink-mute)' }}>
                    {errs.map((e, j) => <li key={j}>{e}</li>)}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="admin-card p-5">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="admin-card-flat p-4 text-center">
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--admin-ink-mute)' }}>Total</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--admin-ink)' }}>{result.total}</p>
            </div>
            <div className="admin-card-flat p-4 text-center"
              style={{ borderColor: 'rgba(58,142,90,0.25)', background: 'rgba(58,142,90,0.04)' }}>
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#3A8E5A' }}>Success</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: '#3A8E5A' }}>{result.success}</p>
            </div>
            <div className="admin-card-flat p-4 text-center"
              style={{ borderColor: 'rgba(177,66,66,0.25)', background: 'rgba(177,66,66,0.04)' }}>
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#B14242' }}>Failed</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: '#B14242' }}>{result.failed}</p>
            </div>
          </div>

          <table className="admin-table">
            <thead><tr><th>Row</th><th>Status</th><th>Message</th></tr></thead>
            <tbody>
              {result.results.map((r, i) => (
                <tr key={i}>
                  <td className="muted">{r.row}</td>
                  <td>{r.ok
                    ? <CheckCircle size={14} style={{ color: '#3A8E5A' }} />
                    : <XCircle size={14} style={{ color: '#B14242' }} />}</td>
                  <td className="text-xs">{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  )
}
