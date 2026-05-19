import React, { useContext, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LayoutDashboard, Package, Receipt, LogOut, Bot } from 'lucide-react';
import AssistantInterface from '../components/AssistantInterface';

const Layout = () => {
    const { user, logout } = useContext(AuthContext);
    const [isAssistantOpen, setAssistantOpen] = useState(false);

    return (
        <div className="saas-layout">
            <aside className="saas-sidebar glass-panel-no-radius">
                <div className="saas-brand">
                    <h2>Inventory<span style={{color: 'var(--accent)'}}>Pro</span></h2>
                    <p className="saas-brand-sub">{user?.name}</p>
                </div>
                
                <nav className="saas-nav">
                    <NavLink to="/" className={({isActive}) => isActive ? "saas-nav-link active" : "saas-nav-link"}>
                        <LayoutDashboard size={20} /> Dashboard
                    </NavLink>
                    <NavLink to="/inventory" className={({isActive}) => isActive ? "saas-nav-link active" : "saas-nav-link"}>
                        <Package size={20} /> Products
                    </NavLink>
                    <NavLink to="/sales" className={({isActive}) => isActive ? "saas-nav-link active" : "saas-nav-link"} style={{ display: 'none' }}>
                        <Receipt size={20} /> Sales Ledger
                    </NavLink>
                </nav>

                <div className="saas-sidebar-footer">
                    <button className="saas-nav-link" onClick={logout} style={{ width: '100%' }}>
                        <LogOut size={20} /> Logout
                    </button>
                </div>
            </aside>

            <main className="saas-main">
                <header className="saas-topbar">
                    <div className="search-placeholder">
                       {/* Global Search could go here */}
                    </div>
                    <div className="topbar-actions">
                        <button className="ai-fab-button" onClick={() => setAssistantOpen(true)}>
                            <Bot size={24} />
                            <span>AI</span>
                        </button>
                    </div>
                </header>

                <div className="saas-content">
                    <Outlet />
                </div>
            </main>

            {/* AI Drawer */}
            <div className={`ai-drawer ${isAssistantOpen ? 'open' : ''}`}>
                <div className="ai-drawer-header">
                   <h3>AI</h3>
                   <button onClick={() => setAssistantOpen(false)} style={{ color: 'var(--text-main)', fontSize: '1.5rem' }}>&times;</button>
                </div>
                <div className="ai-drawer-content">
                   <AssistantInterface onActionSuccess={() => {}} />
                </div>
            </div>
            
            {isAssistantOpen && <div className="ai-drawer-overlay" onClick={() => setAssistantOpen(false)}></div>}
        </div>
    );
};

export default Layout;
