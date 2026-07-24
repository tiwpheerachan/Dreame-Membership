import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Store } from 'lucide-react'
import type { Branch } from '@/types'
import BranchCard from '@/components/user/BranchCard'
import BackButton from '@/components/user/BackButton'

export default async function BranchesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Public marketing content — bypass RLS via the service client so the list
  // renders even when RLS policies aren't applied on the production DB.
  const service = createServiceClient()
  const { data: branches, error } = await service
    .from('branches')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) console.error('[branches] query failed:', error)

  const list = (branches || []) as Branch[]
  const isEmpty = list.length === 0

  return (
    <div className="page-enter" style={{ paddingTop: 18, background: '#fff', minHeight: '100vh' }}>
      <header style={{ padding: '14px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <BackButton />
          <p className="kicker" style={{ margin: 0 }}>Our Stores</p>
        </div>
        <h1 className="display" style={{ margin: 0, fontSize: 30, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
          <span style={{ fontWeight: 800 }}>รวมสาขา</span>{' '}
          <span className="serif-i" style={{ fontWeight: 400 }}>ของเรา</span>
        </h1>
        {!isEmpty && (
          <p className="serif-i" style={{ fontSize: 12, color: 'var(--ink-mute)', margin: '8px 0 0' }}>
            {list.length} สาขาพร้อมให้บริการ · แตะเพื่อนำทางไปยังร้าน
          </p>
        )}
      </header>

      {isEmpty ? (
        <div style={{ padding: '0 16px' }}>
          <div className="card-product" style={{ overflow: 'hidden', padding: '60px 28px', textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, margin: '0 auto 18px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg,var(--gold-glow),var(--gold-pale))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--gold-deep)',
              boxShadow: '0 8px 24px rgba(160,120,43,0.15)',
            }}>
              <Store size={28} strokeWidth={1.4} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 800 }}>
              ยังไม่มี<span className="serif-i" style={{ fontWeight: 400 }}>ข้อมูลสาขา</span>
            </h3>
            <p className="serif-i" style={{ fontSize: 12.5, color: 'var(--ink-mute)', margin: 0, lineHeight: 1.7, maxWidth: 280, marginInline: 'auto' }}>
              กลับมาดูใหม่เร็ว ๆ นี้ — เรากำลังขยายสาขาเพิ่มเติม
            </p>
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {list.map(b => <BranchCard key={b.id} branch={b} />)}
        </div>
      )}
    </div>
  )
}
