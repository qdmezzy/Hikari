import { Link } from 'react-router-dom'

export function Nav() {
  return (
    <nav style={{ padding: 16, borderBottom: '1px solid #ddd' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <strong>Hikari</strong>
          <Link to="/">Home</Link>
          <Link to="/search">Search</Link>
          <Link to="/dashboard">Dashboard</Link>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link to="/login">Login</Link>
        </div>
      </div>
    </nav>
  )
}
