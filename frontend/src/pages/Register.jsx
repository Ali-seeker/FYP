import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await register(name, email, password, businessName);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ width: '400px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Create Account</h2>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input 
            type="text" 
            placeholder="Your Name" 
            value={name} onChange={e => setName(e.target.value)}
            style={{ padding: '10px', borderRadius: '5px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)' }}
          />
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
          <hr style={{ borderColor: 'var(--border-color)', margin: '10px 0' }} />
          <input 
            type="text" 
            placeholder="Store Name" 
            value={businessName} onChange={e => setBusinessName(e.target.value)}
            style={{ padding: '10px', borderRadius: '5px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)' }}
          />
          <button type="submit" style={{ padding: '10px', background: 'var(--accent)', color: 'white', borderRadius: '5px', fontWeight: 'bold' }}>
            Register & Setup Store
          </button>
        </form>
        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          Already have an account? <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => navigate('/login')}>Login</span>
        </p>
      </div>
    </div>
  );
};

export default Register;
