"use client";

import React, { useEffect, useMemo, useState } from "react";

interface SensorLog {
  value: string | number;
  createdAt: string;
  message?: string;
}

interface Sensor {
  id: string;
  name: string;
  type: string;
  status: string;
  lastValue: string | number | null;
  message?: string | null;
  prtgId?: string;
  logs: SensorLog[];
}

interface Device {
  id: string;
  name: string;
  prtgId?: string;
  host?: string;
  parentId?: string;
  status?: number;
  sensors: Sensor[];
}

interface User {
  id: string;
  plan?: string;
}

function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="relative bg-gradient-to-br from-[#1c2530] via-[#1a2332] to-[#162028] p-6 rounded-3xl shadow-2xl border border-white/10 hover:border-white/20 transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] group overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <div className="relative z-10">
        <div className="text-sm text-gray-400 font-medium uppercase tracking-wider">
          {title}
        </div>
        <div className="mt-3 text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
          {value}
        </div>
        {hint && (
          <div className="mt-2 text-xs text-gray-500 leading-relaxed">{hint}</div>
        )}
      </div>
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full blur-xl"></div>
    </div>
  );
}

function MiniBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300 group">
      <div className="w-32 text-sm text-gray-300 truncate font-medium group-hover:text-white transition-colors">
        {label}
      </div>
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

function DeviceTable({ deviceMap }: { deviceMap: Record<string, Sensor[]> }) {
  const rows = Object.entries(deviceMap).map(([device, sensors]) => ({
    device,
    sensors,
  }));

  function getLastCheck(sensors: Sensor[]) {
    const timestamps = sensors
      .map((s) => (s.logs[0] ? new Date(s.logs[0].createdAt).getTime() : 0))
      .filter((t) => t > 0);
    if (timestamps.length === 0) return null;
    const max = Math.max(...timestamps);
    return new Date(max).toLocaleString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function statusClass(status: string) {
    const s = status.toLowerCase();
    if (s === "up" || s === "ok" || s === "online" || s === "0") {
      return "text-green-400 bg-green-500/20";
    } else if (s === "warning" || s === "1") {
      return "text-yellow-400 bg-yellow-500/20";
    } else if (s === "down" || s === "critical" || s === "2") {
      return "text-red-400 bg-red-500/20";
    }
    return "text-gray-400 bg-gray-700/20";
  }

  return (
    <div className="bg-gradient-to-br from-[#1B263B] via-[#1a2538] to-[#162235] p-6 rounded-3xl shadow-2xl border border-white/10">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
          Device List
        </h3>
        <div className="text-sm text-gray-400 bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm">
          Total devices:{" "}
          <span className="font-semibold text-blue-400">{rows.length}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rows.map((r) => (
          <div
            key={r.device}
            className="relative bg-gradient-to-br from-[#0f172a] via-[#0d1520] to-[#0a1218] p-5 rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-300 hover:shadow-xl group overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-bold text-lg text-white group-hover:text-blue-300 transition-colors">
                    {r.device}
                  </div>
                  <div className="text-sm text-gray-400 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Sensors:{" "}
                    <span className="font-semibold text-green-400">
                      {r.sensors.length}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Last check</div>
                  <div className="text-sm text-gray-300 font-mono bg-black/30 px-2 py-1 rounded">
                    {getLastCheck(r.sensors) ?? "-"}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {r.sensors.slice(0, 10).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="truncate pr-2 text-gray-300">
                      {s.name}{" "}
                      <span className="ml-2 text-xs text-gray-500">({s.type})</span>
                    </div>
                    <div
                      className={`ml-2 text-xs font-bold px-2 py-1 rounded ${statusClass(
                        s.status
                      )}`}
                    >
                      {s.lastValue ?? "-"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full blur-2xl"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertsPanel({ alerts }: { alerts: Sensor[] }) {
  if (!alerts.length) {
    return (
      <div className="bg-gradient-to-br from-[#1B263B] to-[#0F1419] p-6 rounded-3xl text-center border border-green-500/20 shadow-2xl">
        <div className="text-green-400 text-2xl mb-2">✅</div>
        <div className="text-sm text-gray-400 font-medium">No active critical alerts</div>
        <div className="mt-2 text-xs text-green-500">All systems operational</div>
      </div>
    );
  }
  return (
    <div className="bg-gradient-to-br from-[#1B263B] via-[#2B1B1B] to-[#1B0F0F] p-6 rounded-3xl shadow-2xl border border-red-500/30">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-red-500 text-2xl animate-pulse">🚨</div>
        <h3 className="text-xl font-bold text-red-400">Critical Alerts</h3>
        <div className="ml-auto bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-semibold">
          {alerts.length}
        </div>
      </div>
      <div className="space-y-3 max-h-80 overflow-auto custom-scrollbar">
        {alerts.map((a) => (
          <div
            key={a.id}
            className="bg-gradient-to-r from-[#2b1a1a] to-[#3a1f1f] p-4 rounded-xl flex items-start gap-4 border border-red-500/20 hover:border-red-500/40 transition-all duration-300 hover:shadow-lg"
          >
            <div className="w-1 h-12 bg-gradient-to-b from-red-500 to-red-700 rounded-full shadow-lg"></div>
            <div className="flex-1">
              <div className="font-bold text-white">
                {a.name} (Device: {a.prtgId ?? "unknown"})
              </div>
              <div className="text-sm text-gray-300 mt-1">
                Status: <span className="text-red-400 font-semibold">{a.status}</span> • Value:{" "}
                <span className="text-yellow-400 font-mono">{a.lastValue ?? "-"}</span>
              </div>
              <div className="text-xs text-gray-500 mt-2 font-mono bg-black/30 inline-block px-2 py-1 rounded">
                {a.logs[0]
                  ? new Date(a.logs[0].createdAt).toLocaleString("id-ID", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "-"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTimestamp(ts?: string | null) {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

export default function DashboardPage() {
  const [user, setUser ] = useState<User | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser  = localStorage.getItem("user");
    if (storedUser ) {
      setUser (JSON.parse(storedUser ));
    } else {
      window.location.href = "/login";
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchDevices = async () => {
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:3001/api/devices/${user.id}`);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Gagal mengambil devices");
        }
        const data: Device[] = await res.json();
        setDevices(data);
      } catch (error) {
        console.error("Fetch devices error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
  }, [user]);

  const deviceMap = useMemo(() => {
    const map: Record<string, Sensor[]> = {};
    devices.forEach((device) => {
      map[device.name] = device.sensors || [];
    });
    return map;
  }, [devices]);

  const totalSensors = useMemo(() => {
    return devices.reduce((acc, d) => acc + (d.sensors?.length || 0), 0);
  }, [devices]);

  const allSensors = useMemo(() => {
    return devices.flatMap((d) => d.sensors || []);
  }, [devices]);

  const warningCount = useMemo(() => {
    return allSensors.filter(
      (s) => s.status.toLowerCase() === "warning" || s.status === "1"
    ).length;
  }, [allSensors]);

  const criticalCount = useMemo(() => {
    return allSensors.filter(
      (s) =>
        s.status.toLowerCase() === "down" ||
        s.status.toLowerCase() === "critical" ||
        s.status === "2"
    ).length;
  }, [allSensors]);

  const alerts = useMemo(() => {
    return allSensors.filter(
      (s) =>
        s.status.toLowerCase() === "down" ||
        s.status.toLowerCase() === "critical" ||
        s.status === "2"
    );
  }, [allSensors]);

  const maxSensorsPerDevice = useMemo(() => {
    if (devices.length === 0) return 0;
    return Math.max(...devices.map((d) => d.sensors.length));
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
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-pink-500/5 rounded-full blur-2xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-2">
            Dashboard - Plan: {user?.plan ?? "N/A"}
          </h1>
          <p className="text-gray-400">Real-time monitoring and alerts</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full mb-8">
          <StatCard
            title="Total Devices"
            value={devices.length}
            hint="Unique monitored devices"
          />
          <StatCard
            title="Total Sensors"
            value={totalSensors}
            hint="Unique sensors across devices"
          />
          <StatCard title="Warning" value={warningCount} hint="Sensors with warning state" />
          <StatCard title="Critical" value={criticalCount} hint="Sensors in critical/down state" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-stretch">
          <div className="lg:col-span-7 flex flex-col">
            <div className="bg-gradient-to-br from-[#1B263B] via-[#1a2538] to-[#162235] p-6 rounded-3xl flex-1 shadow-2xl border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  Sensor Distribution
                </h3>
                <div className="text-sm text-gray-400 bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm">
                  Max sensors:{" "}
                  <span className="font-semibold text-blue-400">{maxSensorsPerDevice}</span>
                </div>
              </div>
              <div className="space-y-3">
                {devices.map((device) => (
                  <MiniBar
                    key={device.id}
                    label={device.name}
                    value={device.sensors.length}
                    max={maxSensorsPerDevice}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right: Alerts + Quick Stats */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            <AlertsPanel alerts={alerts} />

            <div className="bg-gradient-to-br from-[#1B263B] to-[#0F1419] p-6 rounded-3xl shadow-2xl border border-white/10">
              <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Quick Stats
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                  <span className="text-sm text-gray-400">Latest update:</span>
                  <span className="text-sm text-white font-mono">
                    {allSensors.length > 0
                      ? formatTimestamp(
                          allSensors
                            .map((s) => (s.logs[0] ? s.logs[0].createdAt : null))
                            .filter(Boolean)
                            .sort()
                            .reverse()[0] || null
                        )
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                  <span className="text-sm text-gray-400">API Records:</span>
                  <span className="text-sm font-semibold text-blue-400">{allSensors.length}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                  <span className="text-sm text-gray-400">Devices monitored:</span>
                  <span className="text-sm font-semibold text-green-400">{devices.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Device list full width */}
        <div className="mt-8">
          <DeviceTable deviceMap={deviceMap} />
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </div>
  );
}
