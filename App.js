import React, { useContext, useState } from 'react';
import { AuthContext } from './AuthContext';
import BookCatalog from './BookCatalog';

const API = 'http://localhost:5000';

function LoginRegister() {
  const { login } = useContext(AuthContext);
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    address: '',
    phone: '',
  });

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        const res = await fetch(`${API}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            role: form.role,
          }),
        });
        const data = await res.json();
        if (!res.ok) return alert(data.message || 'Login failed');
        login(data);
      } else {
        const res = await fetch(`${API}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) return alert(data.message || 'Register failed');
        login(data);
      }
    } catch (e) {
      alert('Request failed');
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <h2 style={{ marginBottom: 8 }}>{isLogin ? 'Login' : 'Register'}</h2>
      <form onSubmit={submit}>
        {!isLogin && (
          <>
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ display: 'block', width: '100%', marginBottom: 8 }}
            />
            <input
              placeholder="Address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              style={{ display: 'block', width: '100%', marginBottom: 8 }}
            />
            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              style={{ display: 'block', width: '100%', marginBottom: 8 }}
            />
          </>
        )}
        <input
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          style={{ display: 'block', width: '100%', marginBottom: 8 }}
        />
        <input
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          style={{ display: 'block', width: '100%', marginBottom: 8 }}
        />
        <div style={{ marginBottom: 8 }}>
          <label>Role: </label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="submit" style={{ width: '100%' }}>
          {isLogin ? 'Login' : 'Register'}
        </button>
      </form>

      <div style={{ marginTop: 10 }}>
        <button onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? 'Create an account' : 'Already have an account? Login'}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const { authUser, logout } = useContext(AuthContext);

  return (
    <div>
      <header style={{ borderBottom: '1px solid #ddd', padding: 10, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ margin: 0 }}>📚 Book Rental System</h3>
          <div style={{ marginLeft: 'auto' }}>
            {authUser ? (
              <>
                <span style={{ marginRight: 12 }}>
                  Hello, {authUser.name} — Role: <b>{authUser.role}</b>
                </span>
                <button onClick={logout}>Logout</button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {!authUser ? <LoginRegister /> : <BookCatalog />}
    </div>
  );
}
