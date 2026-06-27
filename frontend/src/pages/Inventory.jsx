import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { Plus, Package, Pencil, Trash2, X, Check } from 'lucide-react';

const API = 'http://localhost:5000/api/inventory';

const Inventory = () => {
    const { user } = useContext(AuthContext);
    const [products, setProducts] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [editModal, setEditModal] = useState(null);   // { product } or null
    const [deleteConfirm, setDeleteConfirm] = useState(null); // product or null
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);

    // Add-product form
    const [newProductName, setNewProductName] = useState('');
    const [newProductPrice, setNewProductPrice] = useState('');
    const [newProductStock, setNewProductStock] = useState('');

    // Edit form
    const [editQty, setEditQty] = useState('');
    const [editPrice, setEditPrice] = useState('');

    const headers = { Authorization: `Bearer ${user?.token}` };

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchInventory = async () => {
        try {
            const res = await axios.get(API, { headers });
            // SAFE FIX: Agar res.data.data undefined ho toh baki options check karega
            setProducts(res.data.data || res.data || []);
        } catch {
            showToast('Failed to load products', 'error');
        }
    };

    useEffect(() => { if (user) fetchInventory(); }, [user]);

    const addProduct = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post(API, {
                name: newProductName,
                price: Number(newProductPrice),
                initialStock: Number(newProductStock)
            }, { headers });
            setNewProductName(''); setNewProductPrice(''); setNewProductStock('');
            setIsAdding(false);
            showToast('Product added successfully!');
            fetchInventory();
        } catch {
            showToast('Failed to add product', 'error');
        } finally { setLoading(false); }
    };

    const openEdit = (p) => {
        setEditQty(p.stockQuantity);
        setEditPrice(p.price);
        setEditModal(p);
    };

    const saveEdit = async () => {
        setLoading(true);
        try {
            await axios.put(`${API}/${editModal._id}`, {
                quantity: Number(editQty),
                price: Number(editPrice)
            }, { headers });
            showToast(`${editModal.name} updated!`);
            setEditModal(null);
            fetchInventory();
        } catch {
            showToast('Failed to update product', 'error');
        } finally { setLoading(false); }
    };

    const deleteProduct = async () => {
        setLoading(true);
        try {
            await axios.delete(`${API}/${deleteConfirm._id}`, { headers });
            showToast(`${deleteConfirm.name} deleted.`);
            setDeleteConfirm(null);
            fetchInventory();
        } catch {
            showToast('Failed to delete product', 'error');
        } finally { setLoading(false); }
    };

    const loadDemoData = async () => {
        await axios.get(`${API}/seed`, { headers });
        fetchInventory();
        showToast('Demo data loaded!');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'relative' }}>

            {/* ── Toast Notification ── */}
            {toast && (
                <div style={{
                    position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
                    padding: '12px 20px', borderRadius: '10px', fontWeight: 500,
                    background: toast.type === 'error' ? 'var(--danger, #e74c3c)' : 'var(--success)',
                    color: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    animation: 'fadeIn 0.3s ease'
                }}>
                    {toast.msg}
                </div>
            )}

            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 600 }}>Products Directory</h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={loadDemoData} style={{ background: 'var(--accent)', padding: '10px 16px', borderRadius: '8px', color: 'white', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Package size={18} /> Load Demo Data
                    </button>
                    <button onClick={() => setIsAdding(!isAdding)} style={{ background: 'var(--success)', padding: '10px 16px', borderRadius: '8px', color: 'white', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Plus size={18} /> Add Product
                    </button>
                </div>
            </div>

            {/* ── Add Product Form ── */}
            {isAdding && (
                <div className="glass-panel fade-in">
                    <h3 style={{ marginBottom: '1rem' }}>Create New Item</h3>
                    <form onSubmit={addProduct} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label>Product Name</label>
                            <input required value={newProductName} onChange={e => setNewProductName(e.target.value)}
                                style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label>List Price (PKR)</label>
                            <input type="number" required value={newProductPrice} onChange={e => setNewProductPrice(e.target.value)}
                                style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', width: '130px' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label>Initial Stock</label>
                            <input type="number" required value={newProductStock} onChange={e => setNewProductStock(e.target.value)}
                                style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', width: '120px' }} />
                        </div>
                        <button type="submit" disabled={loading}
                            style={{ padding: '10px 20px', background: 'var(--accent)', color: 'white', borderRadius: '6px', height: 'fit-content' }}>
                            {loading ? 'Saving…' : 'Save Entry'}
                        </button>
                        <button type="button" onClick={() => setIsAdding(false)}
                            style={{ padding: '10px 16px', background: 'transparent', color: 'var(--text-muted)', borderRadius: '6px', border: '1px solid var(--border-color)', height: 'fit-content' }}>
                            Cancel
                        </button>
                    </form>
                </div>
            )}

            {/* ── Product Table ── */}
            <div className="glass-panel">
                {/* SAFE FIX: Optional chaining (?.) use kiya hai */}
                {products?.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Package size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                        <p>No products exist in your directory.</p>
                        <p>Click "Add Product" or use the AI to restock verbally!</p>
                    </div>
                ) : (
                    <table className="saas-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Name</th>
                                <th>Price (PKR)</th>
                                <th>Stock</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* SAFE FIX: Optional chaining (?.) use kiya hai */}
                            {products?.map((p, idx) => (
                                <tr key={p._id}>
                                    <td style={{ opacity: 0.5 }}>{idx + 1}</td>
                                    <td style={{ fontWeight: '500' }}>{p?.name || 'Unknown'}</td>
                                    <td>PKR {p?.price?.toLocaleString() || 0}</td>
                                    <td style={{ fontWeight: '600' }}>{p?.stockQuantity || 0}</td>
                                    <td>
                                        <span className={`badge ${!p?.stockQuantity ? 'danger' : p.stockQuantity < 5 ? 'warning' : 'success'}`}>
                                            {!p?.stockQuantity ? 'Out of Stock' : p.stockQuantity < 5 ? 'Low Stock' : 'In Stock'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                            {/* Edit Button */}
                                            <button
                                                onClick={() => openEdit(p)}
                                                title="Edit quantity / price"
                                                style={{
                                                    padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--accent)',
                                                    color: 'var(--accent)', background: 'transparent', display: 'flex', alignItems: 'center',
                                                    gap: '5px', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'white'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent)'; }}
                                            >
                                                <Pencil size={14} /> Edit
                                            </button>

                                            {/* Delete Button */}
                                            <button
                                                onClick={() => setDeleteConfirm(p)}
                                                title="Delete product"
                                                style={{
                                                    padding: '6px 12px', borderRadius: '6px', border: '1px solid #e74c3c',
                                                    color: '#e74c3c', background: 'transparent', display: 'flex', alignItems: 'center',
                                                    gap: '5px', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = '#e74c3c'; e.currentTarget.style.color = 'white'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#e74c3c'; }}
                                            >
                                                <Trash2 size={14} /> Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── Edit Modal ── */}
            {editModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
                }}>
                    <div className="glass-panel fade-in" style={{ width: '380px', padding: '2rem', borderRadius: '16px', position: 'relative' }}>
                        <button onClick={() => setEditModal(null)}
                            style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
                            <X size={20} />
                        </button>
                        <h3 style={{ marginBottom: '0.4rem' }}>Edit Product</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{editModal.name}</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Stock Quantity</label>
                                <input
                                    type="number" min="0" value={editQty}
                                    onChange={e => setEditQty(e.target.value)}
                                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', fontSize: '1rem' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Price (PKR)</label>
                                <input
                                    type="number" min="0" value={editPrice}
                                    onChange={e => setEditPrice(e.target.value)}
                                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', fontSize: '1rem' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                            <button onClick={saveEdit} disabled={loading}
                                style={{ flex: 1, padding: '11px', borderRadius: '8px', background: 'var(--accent)', color: 'white', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <Check size={16} /> {loading ? 'Saving…' : 'Save Changes'}
                            </button>
                            <button onClick={() => setEditModal(null)}
                                style={{ padding: '11px 18px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)' }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Confirmation Modal ── */}
            {deleteConfirm && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
                }}>
                    <div className="glass-panel fade-in" style={{ width: '360px', padding: '2rem', borderRadius: '16px', textAlign: 'center' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(231,76,60,0.15)', border: '1px solid #e74c3c', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                            <Trash2 size={24} color="#e74c3c" />
                        </div>
                        <h3 style={{ marginBottom: '0.5rem' }}>Delete Product?</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            <strong style={{ color: 'var(--text-main)' }}>{deleteConfirm.name}</strong> will be permanently removed from your inventory.
                        </p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={deleteProduct} disabled={loading}
                                style={{ flex: 1, padding: '11px', borderRadius: '8px', background: '#e74c3c', color: 'white', fontWeight: 600 }}>
                                {loading ? 'Deleting…' : 'Yes, Delete'}
                            </button>
                            <button onClick={() => setDeleteConfirm(null)}
                                style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)' }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;