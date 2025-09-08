'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Pencil, Trash2 } from 'lucide-react';

type Sensor = {
  id: string;
  prtgId: string;
  name: string;
  type: string;
  deviceId: string;
  userId: string;
  status: string;
  device?: { id: string; name: string }; // relasi device
};

type Device = {
  id: string;
  name: string;
  prtgId: string;
};

type SensorTemplate = {
  id: string;
  name: string;
};

export default function SensorPage() {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [templates, setTemplates] = useState<SensorTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('');
  const [newDeviceId, setNewDeviceId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [addingSensor, setAddingSensor] = useState(false);

  const statusMap: Record<
    string,
    { label: string; icon: JSX.Element | null; color: string }
  > = {
    Up: { label: 'Up', icon: <CheckCircle size={18} />, color: 'text-green-400' },
    Warning: { label: 'Warning', icon: <AlertTriangle size={18} />, color: 'text-yellow-400' },
    Down: { label: 'Down', icon: <XCircle size={18} />, color: 'text-red-500' },
  };

  // ambil userId dari localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      setUserId(user.id);
    } else {
      window.location.href = '/login';
    }
  }, []);

  const fetchSensors = async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`http://localhost:3001/api/sensors/user/${userId}`);
      if (!res.ok) throw new Error('Failed to fetch sensors');
      const data = await res.json();
      setSensors(data);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`http://localhost:3001/api/devices/user/${userId}`);
      if (!res.ok) throw new Error('Failed to fetch devices');
      const data = await res.json();
      setDevices(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`http://localhost:3001/api/sensor-templates`);
      if (!res.ok) throw new Error('Failed to fetch sensor templates');
      const data = await res.json();
      setTemplates(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchSensors();
      fetchDevices();
      fetchTemplates();
    }
  }, [userId]);

  // Tambah sensor
  const handleAddSensor = async () => {
    if (!userId) {
      alert('User belum login');
      return;
    }
    if (!newName.trim() || !newType || !newDeviceId) {
      alert('Semua field harus diisi');
      return;
    }
    setAddingSensor(true);
    try {
      const res = await fetch('http://localhost:3001/api/sensors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          type: newType,
          deviceId: newDeviceId,
          userId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add sensor');

      alert('✅ Sensor berhasil ditambahkan');
      setShowForm(false);
      setNewName('');
      setNewType('');
      setNewDeviceId('');
      await fetchSensors();
    } catch (e: any) {
      alert('Error adding sensor: ' + e.message);
    } finally {
      setAddingSensor(false);
    }
  };

  // Update sensor
  const handleUpdateSensor = async (id: string) => {
    if (!editName.trim()) {
      alert('Nama sensor tidak boleh kosong');
      return;
    }
    try {
      const res = await fetch(`http://localhost:3001/api/sensors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update sensor');

      alert('✅ Sensor berhasil diupdate');
      setEditingId(null);
      await fetchSensors();
    } catch (e: any) {
      alert('Error updating sensor: ' + e.message);
    }
  };

  // Hapus sensor
  const handleDeleteSensor = async (id: string) => {
    if (!confirm('Yakin mau hapus sensor ini?')) return;
    try {
      const res = await fetch(`http://localhost:3001/api/sensors/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete sensor');

      alert('✅ Sensor berhasil dihapus');
      await fetchSensors();
    } catch (e: any) {
      alert('Error deleting sensor: ' + e.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans p-6">
      <div className="bg-[#1e293b] rounded-xl p-6 w-full max-w-6xl mx-auto shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Sensor Management</h2>
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-5 rounded-lg transition duration-200 shadow"
            onClick={() => setShowForm(true)}
          >
            + Add Sensor
          </button>
        </div>

        {loading && <p>Loading sensors...</p>}
        {error && <p className="text-red-500 mb-4">{error}</p>}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#334155] text-gray-300 text-sm">
                <th className="py-3 px-4 text-left">Status</th>
                <th className="py-3 px-4 text-left">Name</th>
                <th className="py-3 px-4 text-left">Type</th>
                <th className="py-3 px-4 text-left">Device</th>
                <th className="py-3 px-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sensors.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">
                    No sensors found
                  </td>
                </tr>
              )}
              {sensors.map(({ id, name, type, status, deviceId }) => {
                const st = statusMap[status] || { label: status, icon: null, color: 'text-gray-400' };
                const device = devices.find((d) => d.id === deviceId);
                return (
                  <tr
                    key={id}
                    className="border-b border-gray-700 hover:bg-[#334155] transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className={`flex items-center gap-2 ${st.color}`}>
                        {st.icon}
                        {st.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {editingId === id ? (
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
                    <td className="py-3 px-4 text-gray-300">{type}</td>
                    <td className="py-3 px-4 text-gray-200 font-medium">
                      {device ? device.name : 'Unknown'}
                    </td>
                    <td className="py-3 px-4 flex gap-2">
                      {editingId === id ? (
                        <>
                          <button
                            className="px-3 py-1 bg-green-600 rounded hover:bg-green-700 text-white text-sm"
                            onClick={() => handleUpdateSensor(id)}
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
                            onClick={() => {
                              setEditingId(id);
                              setEditName(name);
                            }}
                          >
                            <Pencil size={14} /> Edit
                          </button>
                          <button
                            className="px-3 py-1 bg-red-600 rounded hover:bg-red-700 text-white text-sm flex items-center gap-1"
                            onClick={() => handleDeleteSensor(id)}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form tambah sensor */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-[#1e293b] p-6 rounded-xl w-96 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Add Sensor</h3>
            <input
              type="text"
              placeholder="Sensor Name"
              className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={addingSensor}
            />
            <select
              className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              disabled={addingSensor}
            >
              <option value="">-- Pilih Sensor Template --</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm"
              value={newDeviceId}
              onChange={(e) => setNewDeviceId(e.target.value)}
              disabled={addingSensor}
            >
              <option value="">-- Pilih Device --</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 rounded text-white text-sm"
                onClick={() => setShowForm(false)}
                disabled={addingSensor}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
                onClick={handleAddSensor}
                disabled={addingSensor}
              >
                {addingSensor ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
