"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import jsPDF from "jspdf";

type Step = 1 | 2 | 3;

export default function PembayaranBaru() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const plan = searchParams.get("plan") || "User";
  const price = parseInt(searchParams.get("price") || "0", 10);

  const API_BASE = "http://localhost:3001";

  // steps
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);

  // form state
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [email, setEmail] = useState("");

  // backend refs
  const [profileId, setProfileId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [qrisUrl, setQrisUrl] = useState<string | null>(null);
  const [activationToken, setActivationToken] = useState<string | null>(null);

  const isEmailValid = (v: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const pollingRef = useRef<NodeJS.Timer | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ✅ fungsi polling status ke backend
  const startPollingStatus = (id: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/payment/status/${id}`);
        const data = await res.json();

        console.log("Polling status:", data);

        if (data.success && data.status === "paid") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setActivationToken(data.activationToken);
          setStep(3); // 🚀 langsung ke step 3
        }
      } catch (err) {
        console.error("Error polling status:", err);
      }
    }, 3000); // cek tiap 3 detik
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid(email)) {
      alert("Format email admin tidak valid.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/payment/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          price,
          companyName,
          fullName,
          city,
          country,
          email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan profil");

      setProfileId(data.profileId);

      const resOrder = await fetch(`${API_BASE}/api/payment/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionProfileId: data.profileId,
          packageName: plan,
          price,
        }),
      });
      const order = await resOrder.json();
      if (!resOrder.ok) throw new Error(order.error || "Gagal membuat order");

      setOrderId(order.orderId);
      setQrisUrl(order.qrisUrl);
      setStep(2);

      // 🚀 mulai polling status pembayaran
      startPollingStatus(order.orderId);
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
      else alert("Terjadi kesalahan tak terduga");
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Invoice Pembayaran", 20, 20);
    doc.setFontSize(12);
    doc.text(`Company: ${companyName}`, 20, 40);
    doc.text(`Full Name: ${fullName}`, 20, 50);
    doc.text(`City: ${city}`, 20, 60);
    doc.text(`Country: ${country}`, 20, 70);
    doc.text(`Email: ${email}`, 20, 80);
    doc.text(`Plan: ${plan}`, 20, 90);
    doc.text(`Price: Rp${price}`, 20, 100);
    doc.save(`Invoice-${orderId || "payment"}.pdf`);
  };

  return (
    <section className="bg-[#0D1B2A] text-white min-h-screen flex">
      <div className="w-full max-w-2xl mx-auto px-6 py-10 pb-24">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Pembayaran - {plan}</h1>
          <p className="text-gray-300">
            Total: <span className="font-semibold text-white">Rp{price}</span>
          </p>
        </header>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-8">
          {[{ n: 1, label: "Data Akun & Admin" }, { n: 2, label: "Pembayaran" }, { n: 3, label: "Selesai" }].map((s, i) => {
            const isActive = step === (s.n as Step);
            return (
              <div key={s.n} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${
                    step > (s.n as Step)
                      ? "bg-green-600"
                      : isActive
                      ? "bg-blue-600"
                      : "bg-[#132132]"
                  }`}
                  title={s.label}
                >
                  {step > (s.n as Step) ? "✓" : s.n}
                </div>
                <span className={`ml-2 mr-4 text-sm ${isActive ? "text-white font-medium" : "text-gray-300"}`}>
                  {s.label}
                </span>
                {i !== 2 && <div className="w-8 h-[2px] bg-[#334155]" />}
              </div>
            );
          })}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <form onSubmit={handleSaveProfile} className="space-y-4 bg-[#0C1A2A] p-5 rounded-xl border border-[#1C2C3A] shadow">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Company Name</label>
                <input className="p-3 rounded w-full bg-[#091320] border border-gray-700 outline-none" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Full Name</label>
                <input className="p-3 rounded w-full bg-[#091320] border border-gray-700 outline-none" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm mb-1">City</label>
                <input className="p-3 rounded w-full bg-[#091320] border border-gray-700 outline-none" value={city} onChange={(e) => setCity(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm mb-1">Country</label>
                <input className="p-3 rounded w-full bg-[#091320] border border-gray-700 outline-none" value={country} onChange={(e) => setCountry(e.target.value)} required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Email Admin</label>
                <input type="email" className="p-3 rounded w-full bg-[#091320] border border-gray-700 outline-none" value={email} onChange={(e) => setEmail(e.target.value)} required />
                {!email || isEmailValid(email) ? null : (
                  <p className="text-xs text-red-400 mt-1">Format email tidak valid.</p>
                )}
              </div>
            </div>
            <button type="submit" disabled={loading || !email || !isEmailValid(email)} className="w-full px-5 py-3 bg-blue-600 rounded hover:bg-blue-500 font-medium disabled:opacity-60">
              {loading ? "Menyimpan..." : "Lanjut ke Pembayaran →"}
            </button>
          </form>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="bg-[#0C1A2A] p-5 rounded-xl border border-[#1C2C3A] shadow text-center">
            <h3 className="font-semibold mb-4">Scan QRIS untuk membayar</h3>
            {qrisUrl ? (
              <img src={qrisUrl} alt="QRIS" className="mx-auto border p-2 w-64 h-64 object-contain" />
            ) : (
              <p className="text-gray-400">Menyiapkan QRIS...</p>
            )}
            <p className="mt-3 text-sm text-gray-400">Order ID: {orderId}</p>
            <p className="mt-2 text-xs text-gray-400">Sistem akan otomatis mendeteksi pembayaran dan lanjut ke langkah berikutnya.</p>
          </div>
        )}

        {/* STEP 3 */}
{step === 3 && (
  <div className="bg-[#0C1A2A] p-6 rounded-xl border border-[#1C2C3A] shadow text-center space-y-6">
    <h3 className="font-semibold text-xl mb-4">🎉 Pembayaran Berhasil</h3>

    <div className="flex items-center justify-center gap-3">
      <button
        onClick={() => router.push("/activate")}
        className="px-5 py-3 bg-blue-600 hover:bg-blue-500 rounded font-medium"
      >
        Lanjut ke Aktivasi
      </button>
      <button
        onClick={() => router.push("/")}
        className="px-5 py-3 bg-transparent border border-gray-600 rounded font-medium hover:bg-[#0F2135]"
      >
        Kembali ke Beranda
      </button>
    </div>

    {activationToken && (
      <div className="mt-6 bg-[#132132] p-4 rounded">
        <h4 className="font-semibold text-sm mb-2">🔑 Token Aktivasi Anda</h4>
        <p className="break-all text-green-400 font-mono">{activationToken}</p>
      </div>
    )}
  </div>
)}

      </div>
    </section>
  );
}
