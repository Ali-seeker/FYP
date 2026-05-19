import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ width: '400px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Login to Your Store</h2>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input 
            type="email" 
            placeholder="Email Address" 
            value={email} onChange={e => setEmail(e.target.value)}
            style={{ padding: '10px', borderRadius: '5px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)' }}
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} onChange={e => setPassword(e.target.value)}
            style={{ padding: '10px', borderRadius: '5px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)' }}
          />
          <button type="submit" style={{ padding: '10px', background: 'var(--accent)', color: 'white', borderRadius: '5px', fontWeight: 'bold' }}>
            Login
          </button>
        </form>
        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          Don't have an account? <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => navigate('/register')}>Register here</span>
        </p>
      </div>
    </div>
  );
};

export default Login;
