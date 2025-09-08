"use client";

import React, { useEffect, useMemo, useState } from "react";

// Helper UI components (StatCard, MiniBar, DeviceTable, AlertsPanel) sama seperti yang kamu punya
// Saya sertakan minimal agar fokus ke fetch data user-specific

function StatCard({ title, value, hint }) {
  return (
    <div className="relative bg-gradient-to-br from-[#1c2530] via-[#1a2332] to-[#162028] p-6 rounded-3xl shadow-2xl border border-white/10 hover:border-white/20 transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] group overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <div className="relative z-10">
        <div className="text-sm text-gray-400 font-medium uppercase tracking-wider">{title}</div>
        <div className="mt-3 text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
          {value}
        </div>
        {hint && <div className="mt-2 text-xs text-gray-500 leading-relaxed">{hint}</div>}
      </div>
    </div>
  );
}

function MiniBar({ label, value, max }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300 group">
      <div className="w-32 text-sm text-gray-300 truncate font-medium group-hover:text-white transition-colors">{label}</div>
      <div className="flex-1 h-4 bg-gradient-to-r from-gray-800 to-gray-700 rounded-full overflow-hidden shadow-inner">
        <div
          className="h-full bg-gradient-to-r from-[#2b6cb0] via-[#4299e1] to-[#5d7bb6] rounded-full shadow-lg transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-12 text-right text-sm font-semibold text-blue-400">{value}</div>
    </div>
  );
}

function DeviceTable({ deviceMap }) {
  const rows = Object.entries(deviceMap).map(([device, sensors]) => ({ device, sensors }));
  return (
    <div className="bg-gradient-to-br from-[#1B263B] via-[#1a2538] to-[#162235] p-6 rounded-3xl shadow-2xl border border-white/10">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Device List</h3>
        <div className="text-sm text-gray-400 bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm">
          Total devices: <span className="font-semibold text-blue-400">{rows.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rows.map((r) => (
          <div key={r.device} className="relative bg-gradient-to-br from-[#0f172a] via-[#0d1520] to-[#0a1218] p-5 rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-300 hover:shadow-xl group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-bold text-lg text-white group-hover:text-blue-300 transition-colors">{r.device}</div>
                  <div className="text-sm text-gray-400 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Sensors: <span className="font-semibold text-green-400">{r.sensors.length}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                {r.sensors.slice(0, 10).map((s, i) => (
                  <div key={s.id || i} className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                    <div className="truncate pr-2 text-gray-300">{s.name}</div>
                    <div className="ml-2 text-xs font-bold text-blue-400 bg-blue-500/20 px-2 py-1 rounded">{s.lastValue ?? '-'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Ambil user dari localStorage (hasil login)
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      // Jika tidak ada user, redirect ke login
      window.location.href = "/login";
    }
  }, []);

  // Fetch device + sensor milik user setelah user tersedia
  useEffect(() => {
    if (!user) return;

    const fetchDevices = async () => {
      setLoading(true);
      try {
        // Ambil device milik user
        const res = await fetch(`http://localhost:3001/api/devices/user/${user.id}`);
        if (!res.ok) throw new Error("Gagal mengambil device");
        const devicesData = await res.json();

        // Untuk setiap device, ambil sensor-nya (atau sudah include di API)
        // Jika API sudah include sensor, langsung set
        // Jika belum, fetch sensor per device (opsional)

        // Asumsikan API devices sudah include sensors
        setDevices(devicesData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
  }, [user]);

  // Buat map device -> sensors untuk DeviceTable
  const deviceMap = useMemo(() => {
    const map = {};
    devices.forEach((device) => {
      map[device.name] = device.sensors || [];
    });
    return map;
  }, [devices]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D1725] text-white">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#0a1120] to-[#050a15] text-white p-6 relative overflow-hidden">
      <h1 className="text-4xl font-bold mb-6">Dashboard - Plan: {user?.plan}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Devices" value={devices.length} />
        <StatCard title="Total Sensors" value={devices.reduce((acc, d) => acc + (d.sensors?.length || 0), 0)} />
      </div>

      <DeviceTable deviceMap={deviceMap} />
    </div>
  );
}
