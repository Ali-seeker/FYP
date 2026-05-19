import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/analytics', {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        setAnalytics(res.data.data);
      } catch (err) {
        console.error("Failed to fetch analytics");
      }
    };
    if (user) fetchAnalytics();
  }, [user]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
           <h1 style={{fontSize: '2rem', fontWeight: 600}}>System Analytics</h1>
        </div>

        {/* Top KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
           <div className="glass-panel stat-card fade-in">
              <div className="stat-label">Top Selling Item</div>
              <div className="stat-value" style={{ fontSize: '1.5rem', marginTop: '10px' }}>
                 {analytics?.topSellers[0]?.name || 'N/A'}
              </div>
           </div>
           
           <div className="glass-panel stat-card fade-in">
              <div className="stat-label">Total Unique Products</div>
              <div className="stat-value" style={{ fontSize: '2rem', marginTop: '10px' }}>
                 {analytics?.topSellers?.length || 0}
              </div>
           </div>
        </div>

        {/* Middle Section: Chart & Insights */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ height: '400px' }}>
                <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>Top Products by Volume</h3>
                <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={analytics?.topSellers || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis dataKey="name" stroke="var(--text-muted)" />
                        <YAxis stroke="var(--text-muted)" />
                        <Tooltip contentStyle={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                        <Bar dataKey="quantity" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>⚡ Copilot Insights</h3>
               <div style={{ overflowY: 'auto', flex: 1, paddingRight: '1rem' }}>
               {analytics?.insights?.map((insight, idx) => (
                  <div key={idx} className={insight.includes('Urgent') || insight.includes('Warning') ? 'error-box' : 'response-box'} style={{ padding: '1rem', fontSize: '0.9rem', marginBottom: '10px' }}>
                      {insight}
                  </div>
               ))}
               </div>
            </div>
        </div>

        {/* Bottom Section: Tables */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="glass-panel">
                <h3 style={{ marginBottom: '1rem' }}>🏆 Top Sellers</h3>
                <table className="saas-table">
                  <tbody>
                    {analytics?.topSellers?.map((item, idx) => (
                        <tr key={idx}>
                            <td>{item.name}</td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{item.quantity} units</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
            </div>

            <div className="glass-panel">
                <h3 style={{ marginBottom: '1rem' }}>📉 Underachievers</h3>
                <table className="saas-table">
                  <tbody>
                    {analytics?.lowPerformers?.map((item, idx) => (
                        <tr key={idx}>
                            <td>{item.name}</td>
                            <td style={{ textAlign: 'right', color: 'var(--warning)', fontWeight: 'bold' }}>{item.quantity} units</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default Dashboard;
