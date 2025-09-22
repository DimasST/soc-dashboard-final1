'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

type Device = {
  id: string;       // UUID device dari DB
  prtgId?: string;  // PRTG ID (objid)
  name: string;
  host?: string;
  parentId?: string;
  status?: number; // 0=Up, 1=Warning, 2=Down (PRTG status)
};

export default function DevicePage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  const statusMap: Record<
    number,
    { label: string; icon: JSX.Element; color: string }
  > = {
    0: {
      label: 'Up',
      icon: <CheckCircle size={18} className="text-green-400" />,
      color: 'text-green-400',
    },
    1: {
      label: 'Warning',
      icon: <AlertTriangle size={18} className="text-yellow-400" />,
      color: 'text-yellow-400',
    },
    2: {
      label: 'Down',
      icon: <XCircle size={18} className="text-red-500" />,
      color: 'text-red-500',
    },
  };

  const fetchDevices = async (uid: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`http://localhost:3001/api/devices/${uid}`);
      if (!res.ok) throw new Error('Failed to fetch devices');
      const data: Device[] = await res.json();
      setDevices(data);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Ambil user dari localStorage (hasil login)
    const storedUser  = localStorage.getItem('user');
    if (storedUser ) {
      const user = JSON.parse(storedUser );
      if (user?.id) {
        setUserId(user.id);
        fetchDevices(user.id);
      } else {
        setError('User  ID not found, please login');
      }
    } else {
      setError('User  not logged in');
      // Optional: redirect ke login page
      // window.location.href = '/login';
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans p-6">
      <div className="bg-[#1e293b] rounded-xl p-6 w-full shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Device List</h2>
        </div>

        {loading && <p>Loading devices...</p>}
        {error && <p className="text-red-500 mb-4">{error}</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="py-2 px-4">Status</th>
                <th className="py-2 px-4">Device Name</th>
                <th className="py-2 px-4">Host</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(({ id, prtgId, name, host, status }) => {
                const st = statusMap[status ?? 0] || {
                  label: 'Unknown',
                  icon: null,
                  color: 'text-gray-400',
                };
                return (
                  <tr
                    key={id}
                    className="border-b border-gray-700 hover:bg-[#334155]"
                  >
                    <td className={`py-3 px-4 flex items-center gap-2 ${st.color}`}>
                      {st.icon}
                      <span>{st.label}</span>
                    </td>
                    <td className="py-3 px-4">{name}</td>
                    <td className="py-3 px-4 text-gray-300">{host ?? '-'}</td>
                  </tr>
                );
              })}
              {devices.length === 0 && !loading && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-gray-400">
                    No devices found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
