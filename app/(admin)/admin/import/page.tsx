'use client'
import { useState } from 'react'
import { Upload, CheckCircle, XCircle, Download, FileText } from 'lucide-react'

const TEMPLATE = `member_id,phone,email,order_sn,invoice_no,channel,channel_type,model_name,sku,serial_number,purchase_date,total_amount,warranty_months
DRM-100001,,,DRM-2025001,INV-001,STORE,ONSITE,Dreame X40 Ultra,RLS3D,SN12345,2025-01-15,40990,24
,0812345678,,DRM-2025002,INV-002,SHOPEE,ONLINE,Dreame H12,H12-SKU,SN67890,2025-02-01,8990,12`

interface RowResult {
  row: number; ok: boolean; message: string;
}

interface Result {
  total: number; success: number; failed: number; results: RowResult[]
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Record<string, string>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  function parseCSV(text: string) {
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length === 0) return { headers: [], rows: [] }
    const head = lines[0].split(',').map(h => h.trim())
    const rows = lines.slice(1).map(l => {
      const cells = l.split(',')
      const obj: Record<string, string> = {}
      head.forEach((h, i) => { obj[h] = (cells[i] || '').trim() })
      return obj
    })
    return { headers: head, rows }
  }

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
    if (preview.length === 0) return
    setImporting(true); setResult(null)
    const r = await fetch('/api/admin/import/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: preview }),
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
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 className="admin-h1">นำเข้า Purchase (CSV)</h1>
        <p className="admin-sub">อัพโหลด CSV เพื่อสร้าง purchase ทีละหลายรายการ — ระบบจะให้คะแนนอัตโนมัติ</p>
      </div>

      <div className="admin-card" style={{ padding: 20, marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: 'var(--ink-mute)', margin: '0 0 12px' }}>
          คอลัมน์: <code>member_id, phone, email, order_sn, invoice_no, channel, channel_type, model_name, sku, serial_number, purchase_date, total_amount, warranty_months</code>
        </p>
        <p style={{ fontSize: 12, color: 'var(--ink-mute)', margin: '0 0 12px' }}>
          ระบบจะหา user จาก <strong>member_id หรือ phone หรือ email</strong> (อันใดอันหนึ่ง) — ถ้าไม่พบจะข้ามแถว
        </p>
        <button onClick={downloadTemplate} className="admin-btn admin-btn-ghost">
          <Download size={13} /> Download template
        </button>
      </div>

      {/* Upload */}
      <div className="admin-card" style={{ padding: 20, marginBottom: 16 }}>
        <label style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          padding: 36, border: '2px dashed var(--line)', borderRadius: 'var(--r-md)',
          cursor: 'pointer', background: 'var(--bg-soft)',
        }}>
          <Upload size={28} color="var(--ink-mute)" />
          <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>
            {file ? file.name : 'คลิกเพื่อเลือก CSV หรือลากไฟล์มาวาง'}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-mute)' }}>UTF-8 · comma-separated · max 10MB</p>
          <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
        </label>
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="admin-card" style={{ marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--hair)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}><FileText size={13} style={{ verticalAlign: 'baseline' }} /> Preview · {preview.length} แถว</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-mute)' }}>ตรวจดูก่อนยืนยันการนำเข้า</p>
            </div>
            <button onClick={runImport} disabled={importing} className="admin-btn admin-btn-ink">
              {importing ? 'กำลังนำเข้า...' : `Import ${preview.length} รายการ`}
            </button>
          </div>
          <div style={{ maxHeight: 360, overflow: 'auto' }}>
            <table className="admin-table">
              <thead><tr><th>#</th>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {preview.slice(0, 50).map((r, i) => (
                  <tr key={i}>
                    <td className="muted">{i + 1}</td>
                    {headers.map(h => <td key={h} style={{ fontSize: 11 }}>{r[h] || '-'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 50 && (
              <p style={{ padding: 12, fontSize: 11, color: 'var(--ink-mute)', textAlign: 'center' }}>
                แสดง 50 แถวแรก · ทั้งหมด {preview.length} แถวจะถูกนำเข้า
              </p>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="admin-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div className="admin-card-flat" style={{ flex: 1, padding: '14px 16px' }}>
              <p style={{ fontSize: 10, color: 'var(--ink-mute)', margin: '0 0 4px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Total</p>
              <p style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{result.total}</p>
            </div>
            <div className="admin-card-flat" style={{ flex: 1, padding: '14px 16px', borderColor: 'rgba(46,122,61,0.20)' }}>
              <p style={{ fontSize: 10, color: 'var(--green)', margin: '0 0 4px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Success</p>
              <p style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--green)' }}>{result.success}</p>
            </div>
            <div className="admin-card-flat" style={{ flex: 1, padding: '14px 16px', borderColor: 'rgba(180,58,58,0.20)' }}>
              <p style={{ fontSize: 10, color: 'var(--red)', margin: '0 0 4px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Failed</p>
              <p style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--red)' }}>{result.failed}</p>
            </div>
          </div>

          <table className="admin-table">
            <thead><tr><th>Row</th><th>Status</th><th>Message</th></tr></thead>
            <tbody>
              {result.results.map((r, i) => (
                <tr key={i}>
                  <td className="muted">{r.row}</td>
                  <td>{r.ok ? <CheckCircle size={14} color="var(--green)" /> : <XCircle size={14} color="var(--red)" />}</td>
                  <td style={{ fontSize: 12 }}>{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
