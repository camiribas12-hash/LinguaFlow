import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Auth from './pages/Auth'
import TeacherApp from './pages/TeacherApp'
import StudentApp from './pages/StudentApp'

const Spinner = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3e6d2' }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🧠</div>
      <div style={{ fontSize: 15, color: '#7a7a7a', fontWeight: 500 }}>Carregando LinguaFlow...</div>
    </div>
  </div>
)

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) {
      console.error('Profile error:', error.message)
      // Profile not found or RLS error — sign out to reset
      await supabase.auth.signOut()
      setLoading(false)
      return
    }
    if (data) setProfile(data)
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) return <Spinner />
  if (!user || !profile) return <Auth onAuth={() => {}} />
  if (profile.role === 'teacher') return <TeacherApp user={user} profile={profile} onLogout={handleLogout} />
  return <StudentApp user={user} profile={profile} onLogout={handleLogout} />
}
