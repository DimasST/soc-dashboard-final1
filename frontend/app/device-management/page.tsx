'use client';

import { useEffect, useState } from 'react';
import AddDeviceForm from './components/AddDevice';
import { CheckCircle, AlertTriangle, XCircle, Pencil } from 'lucide-react';

type Device = {
  prtgId: string; // objid dari PRTG → unique identifier
  id: string;     // cuid dari DB
  name: string;
  host: string;
  status: number; // 0=Up, 1=Warning, 2=Down
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, '') || 'http://localhost:3001';

export default function DevicePage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  const statusMap: Record<number, { label: string; icon: JSX.Element | null }> = {
    0: { label: 'Up',      icon: <CheckCircle size={20} className="text-green-400" /> },
    1: { label: 'Warning', icon: <AlertTriangle size={20} className="text-yellow-400" /> },
    2: { label: 'Down',    icon: <XCircle size={20} className="text-red-500" /> },
  };

  // Ambil userId dari localStorage
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        setUserId(user.id);
      } else {
        window.location.href = '/login';
      }
    } catch {
      window.location.href = '/login';
    }
  }, []);

  // Fetch devices milik user
  const fetchDevices = async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/devices/user/${userId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to fetch devices');

      const normalized: Device[] = (data || []).map((d: any) => ({
        prtgId: String(d.objid ?? ''), // pakai objid hasil mapping BE
        id: String(d.id ?? ''),
        name: String(d.name ?? ''),
        host: String(d.host ?? ''),
        status: Number(d.status ?? 0),
      }));
      setDevices(normalized);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Tambah device
  const handleAddDevice = async (deviceName: string, host: string, parentId: string) => {
    if (!userId) {
      alert('User belum login');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: deviceName, host, parentId, userId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to add device');

      alert(`✅ Device berhasil ditambahkan (PRTG ID: ${data.objectId})`);
      setShowForm(false);
      await fetchDevices();
    } catch (e: any) {
      alert('Error adding device: ' + (e.message || 'Unknown error'));
    }
  };

  // Hapus device (pakai prtgId)
  const handleDeleteDevice = async (prtgId: string) => {
    if (!prtgId) {
      alert('PRTG ID tidak ditemukan pada device ini.');
      return;
    }
    if (!confirm(`Apakah kamu yakin ingin menghapus device PRTG #${prtgId}?`)) return;

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/devices/${encodeURIComponent(prtgId)}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || data?.message || 'Failed to delete device');
      }

      setDevices((prev) => prev.filter((d) => d.prtgId !== prtgId));
      alert('✅ Device berhasil dihapus dari PRTG & Database');
    } catch (e: any) {
      alert('Error deleting device: ' + (e.message || 'Unknown error'));
    } finally {
      setLoading(false);
      await fetchDevices();
    }
  };

  // Edit nama
  const handleEditDevice = (dbId: string, currentName: string) => {
    setEditingId(dbId);
    setEditName(currentName);
  };

  const handleUpdateDevice = async (dbId: string) => {
    if (!editName.trim()) {
      alert('Nama device tidak boleh kosong');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/devices/${encodeURIComponent(dbId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to update device');

      alert('✅ Nama device berhasil diperbarui');
      setEditingId(null);
      await fetchDevices();
    } catch (e: any) {
      alert('Error updating device: ' + (e.message || 'Unknown error'));
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans p-6 relative">
      <div className="bg-[#1e293b] rounded-xl p-6 w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Device Management</h2>
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 px-4 rounded-md transition duration-200"
            onClick={() => setShowForm(true)}
          >
            Add Device
          </button>
        </div>

        {loading && <p>Loading devices...</p>}
        {error && <p className="text-red-500 mb-4">{error}</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="py-2 px-4">Status</th>
                <th className="py-2 px-4">Device Name</th>
                <th className="py-2 px-4">PRTG ID</th>
                <th className="py-2 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(({ id: dbId, name, status, prtgId }) => {
                const st = statusMap[status as 0 | 1 | 2] || { label: 'Unknown', icon: null };
                return (
                  <tr key={prtgId || dbId} className="border-b border-gray-700 hover:bg-[#334155]">
                    <td className="py-3 px-4 flex items-center gap-2">
                      {st.icon}
                      <span>{st.label}</span>
                    </td>
                    <td className="py-3 px-4">
                      {editingId === dbId ? (
                        <input
                          type="text"
                          className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm w-full"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      ) : (
                        name
                      )}
                    </td>
                    <td className="py-3 px-4">{prtgId || '-'}</td>
                    <td className="py-3 px-4 flex gap-2">
                      {editingId === dbId ? (
                        <>
                          <button
                            className="px-3 py-1 bg-green-600 rounded hover:bg-green-700 text-white text-sm"
                            onClick={() => handleUpdateDevice(dbId)}
                          >
                            Save
                          </button>
                          <button
                            className="px-3 py-1 bg-gray-500 rounded hover:bg-gray-600 text-white text-sm"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="px-3 py-1 bg-yellow-600 rounded hover:bg-yellow-700 text-white text-sm flex items-center gap-1"
                            onClick={() => handleEditDevice(dbId, name)}
                          >
                            <Pencil size={14} /> Edit
                          </button>
                          <button
                            className="px-3 py-1 bg-red-600 rounded hover:bg-red-700 text-white text-sm"
                            onClick={() => handleDeleteDevice(prtgId)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {devices.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-400">
                    No devices found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <AddDeviceForm onSubmit={handleAddDevice} onCancel={() => setShowForm(false)} />
        </div>
      )}
    </div>
  );
}
