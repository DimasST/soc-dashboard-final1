'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

type Sensor = {
  id: string;
  name: string;
  deviceName: string;
  lastValue: number | null;
  status: number; // 0=Up,1=Warning,2=Down
  lastLog: {
    createdAt: string;
    value: number;
  } | null;
};

type SensorLog = {
  createdAt: string;
  value: number;
};

export default function SensorPage() {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [stats, setStats] = useState({ up: 0, warning: 0, down: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSensorLogs, setSelectedSensorLogs] = useState<SensorLog[]>([]);
  const [selectedSensorName, setSelectedSensorName] = useState<string | null>(null);

  // Mapping status angka ke label dan warna
  const statusMap = {
    0: { label: 'Up', color: 'bg-green-500' },
    1: { label: 'Warning', color: 'bg-yellow-500' },
    2: { label: 'Down', color: 'bg-red-500' },
  };

  useEffect(() => {
    async function fetchSensors(userId: string) {
      try {
        setLoading(true);
        const res = await axios.get(`http://localhost:3001/api/sensors/status/${userId}`);
        const data: Sensor[] = res.data;

        // Hitung statistik berdasarkan status
        const up = data.filter(s => s.status === 0).length;
        const warning = data.filter(s => s.status === 1).length;
        const down = data.filter(s => s.status === 2).length;

        setSensors(data);
        setStats({ up, warning, down });
        setError(null);
      } catch (err) {
        console.error('Gagal fetch data sensor:', err);
        setError('Gagal mengambil data sensor');
      } finally {
        setLoading(false);
      }
    }

    // Ambil user dari localStorage
    const storedUser  = localStorage.getItem('user');
    if (storedUser ) {
      const user = JSON.parse(storedUser );
      if (user?.id) {
        fetchSensors(user.id);
      } else {
        setError('User  ID tidak ditemukan, silakan login ulang');
        setLoading(false);
      }
    } else {
      setError('User  belum login');
      setLoading(false);
    }
  }, []);

  // Fetch data log sensor untuk grafik saat sensor dipilih
  async function fetchSensorLogs(sensorId: string, sensorName: string) {
    try {
      const res = await axios.get(`http://localhost:3001/api/sensors/${sensorId}/logs`);
      // Asumsikan response array { createdAt, value }
      const logs: SensorLog[] = res.data.map((log: any) => ({
        createdAt: log.createdAt,
        value: log.value,
      }));
      setSelectedSensorLogs(logs);
      setSelectedSensorName(sensorName);
    } catch (err) {
      console.error('Gagal fetch log sensor:', err);
      setSelectedSensorLogs([]);
      setSelectedSensorName(null);
    }
  }

  // Format tanggal untuk grafik
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white">
        <p>Loading data sensor...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans p-6">
      <main className="space-y-6">
        {/* Statistik Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#1e293b] p-6 rounded-xl shadow-lg text-center">
            <h3 className="text-lg font-semibold">Up</h3>
            <p className="text-3xl font-bold text-green-400">{stats.up}</p>
          </div>
          <div className="bg-[#1e293b] p-6 rounded-xl shadow-lg text-center">
            <h3 className="text-lg font-semibold">Warning</h3>
            <p className="text-3xl font-bold text-yellow-400">{stats.warning}</p>
          </div>
          <div className="bg-[#1e293b] p-6 rounded-xl shadow-lg text-center">
            <h3 className="text-lg font-semibold">Down</h3>
            <p className="text-3xl font-bold text-red-400">{stats.down}</p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-600 text-white p-4 rounded">{error}</div>
        )}

        {/* Tabel Sensor */}
        <div className="bg-[#1e293b] rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Daftar Sensor (Milik Anda)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="py-2 px-4">Device</th>
                  <th className="py-2 px-4">Sensor</th>
                  <th className="py-2 px-4">Last Value</th>
                  <th className="py-2 px-4">Status</th>
                  <th className="py-2 px-4">Last Update</th>
                  <th className="py-2 px-4">Grafik</th>
                </tr>
              </thead>
              <tbody>
                {sensors.length === 0 && !error && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-gray-400">
                      Tidak ada sensor ditemukan
                    </td>
                  </tr>
                )}
                {sensors.map(sensor => {
                  const statusInfo = statusMap[sensor.status] || { label: 'Unknown', color: 'bg-gray-500' };
                  return (
                    <tr
                      key={sensor.id}
                      className="border-b border-gray-700 hover:bg-[#334155]"
                    >
                      <td className="py-3 px-4">{sensor.deviceName}</td>
                      <td className="py-3 px-4">{sensor.name}</td>
                      <td className="py-3 px-4">{sensor.lastValue ?? '-'}</td>
                      <td className={`py-3 px-4 flex items-center`}>
                        <span
                          className={`h-3 w-3 rounded-full ${statusInfo.color} mr-2`}
                        ></span>
                        {statusInfo.label}
                      </td>
                      <td className="py-3 px-4">
                        {sensor.lastLog?.createdAt
                          ? new Date(sensor.lastLog.createdAt).toLocaleString('id-ID')
                          : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => fetchSensorLogs(sensor.id, sensor.name)}
                          className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
                        >
                          Lihat Grafik
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Grafik Sensor */}
        {selectedSensorName && selectedSensorLogs.length > 0 && (
          <div className="bg-[#1e293b] rounded-xl p-6 shadow-lg mt-6">
            <h3 className="text-xl font-semibold mb-4">Grafik Sensor: {selectedSensorName}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={selectedSensorLogs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis
                  dataKey="createdAt"
                  tickFormatter={formatDate}
                  stroke="#ccc"
                  minTickGap={20}
                />
                <YAxis stroke="#ccc" />
                <Tooltip
                  labelFormatter={(label) => new Date(label).toLocaleString('id-ID')}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#4ade80"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </main>
    </div>
  );
}
