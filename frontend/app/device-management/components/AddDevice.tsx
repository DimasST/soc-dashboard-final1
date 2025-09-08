'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function AddDeviceForm({ onCancel }) {
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [parentId, setParentId] = useState(''); 
  const [groups, setGroups] = useState<{ objid: string; group: string }[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Ambil userId dari localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      setUserId(user.id);
    }
  }, []);

  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await axios.get('http://localhost:3001/api/groups');
        const data = res.data;

        let groupList: { objid: string; group: string }[] = [];

        if (Array.isArray(data.groups)) {
          groupList = data.groups.map((g: any) => ({
            objid: String(g.objid),
            group: g.group || g.name || 'Unnamed Group',
          }));
        } else if (data?.tree?.nodes) {
          groupList = data.tree.nodes.map((g: any) => ({
            objid: String(g.objid),
            group: g.group || g.name || 'Unnamed Group',
          }));
        }

        setGroups(groupList);
        if (groupList.length > 0) {
          setParentId(groupList[0].objid);
        }
      } catch (err) {
        console.error('Error fetching groups:', err);
      }
    }
    fetchGroups();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !host.trim() || !parentId.trim()) {
      alert('⚠️ Name, Host, dan Parent Group wajib diisi!');
      return;
    }
    if (!userId) {
      alert('⚠️ User belum login!');
      return;
    }

    try {
      const res = await axios.post('http://localhost:3001/api/devices', {
        name: name.trim(),
        host: host.trim(),
        parentId: parentId.trim(),
        userId,
        // ⚡ tidak kirim templateId → backend pakai env PRTG_DEVICE_TEMPLATE_ID
      });

      if (res.data.success) {
        alert('✅ Device berhasil ditambahkan!');
        setName('');
        setHost('');
        setParentId(groups.length > 0 ? groups[0].objid : '');
        onCancel(); // tutup modal / form setelah sukses
      } else {
        alert('❌ Gagal menambahkan device: ' + (res.data.error || 'Unknown error'));
      }
    } catch (err: any) {
      console.error('Error add device:', err);
      alert('❌ Error add device: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="bg-[#1e293b] p-6 rounded-lg w-96">
      <h3 className="text-lg font-semibold mb-4">Add Device</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Device Name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white"
        />
        <input
          type="text"
          placeholder="Host (IP/DNS)"
          value={host}
          onChange={e => setHost(e.target.value)}
          className="px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white"
        />
        <select
          value={parentId}
          onChange={e => setParentId(e.target.value)}
          className="px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white"
        >
          <option value="">-- Pilih Group --</option>
          {groups.map(g => (
            <option key={g.objid} value={g.objid}>
              {g.group} (ID: {g.objid})
            </option>
          ))}
        </select>
        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-500 hover:bg-gray-600 px-4 py-1 rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 px-4 py-1 rounded"
          >
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
