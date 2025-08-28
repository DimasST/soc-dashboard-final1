import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import axios from "axios";
import bodyParser from "body-parser";
import "dotenv/config";
import qs from "qs"; // untuk format x-www-form-urlencoded
import midtransClient from "midtrans-client";

dotenv.config();

const app = express();
const PORT = 3001;
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// ==================== EMAIL HELPER ====================
async function sendEmail({ to, subject, html }) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"SOC Dashboard" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`📩 Email sent to ${to}`);
  } catch (err) {
    console.error(`❌ Failed to send email to ${to}:`, err);
    throw err;
  }
}

// ====== KONFIGURASI PRTG ======
const PRTG_HOST = process.env.PRTG_HOST; // contoh: http://127.0.0.1
const PRTG_USERNAME = process.env.PRTG_USERNAME;
const PRTG_PASSHASH = process.env.PRTG_PASSHASH;

// Midtrans Core API
let coreApi = new midtransClient.CoreApi({
  isProduction: false, // sandbox
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});


// Add device (PRTG)
// -- Add/replace this route in index.js --

app.post("/api/devices", async (req, res) => {
  const { name, host, parentId, templateId } = req.body;

  if (!name || !host || !parentId) {
    return res.status(400).json({ error: "Name, Host, dan Parent Group ID wajib diisi" });
  }

  try {
    const TEMPLATE_ID = String(templateId || process.env.PRTG_DEVICE_TEMPLATE_ID || "").trim();
    if (!TEMPLATE_ID) {
      return res.status(400).json({ error: "PRTG_DEVICE_TEMPLATE_ID belum diset dan templateId tidak dikirim" });
    }

    // 1) CLONE template device ke target group (HARUS pakai GET)
    const dupUrl = `${PRTG_HOST}/api/duplicateobject.htm`;
    const dupParams = {
      id: TEMPLATE_ID,        // device yang jadi template
      targetid: parentId,     // group tujuan
      name: name.trim(),      // nama device baru
      username: PRTG_USERNAME,
      passhash: PRTG_PASSHASH,
    };

    // tangkap redirect utk dapat new objid (PRTG kirim Location ke URL objek baru)
    let newDeviceId = null;
    try {
      const dupResp = await axios.get(dupUrl, {
        params: dupParams,
        maxRedirects: 0,
        validateStatus: (s) => s >= 200 && s < 400,
      });

      const loc = dupResp.headers?.location || dupResp.request?.res?.headers?.location;
      if (loc) {
        // contoh Location: /device.htm?id=1234&tabid=1
        const m = /id=(\d+)/.exec(loc);
        if (m) newDeviceId = m[1];
      }
    } catch (e) {
      // kalau axios otomatis follow redirect/atau header tak ada, lanjut fallback cari pakai table.json
      // NOTE: tetap lanjut ke fallback di bawah
    }

    // 1b) Fallback: cari device baru berdasar parent + name
    if (!newDeviceId) {
      const listUrl = `${PRTG_HOST}/api/table.json`;
      const listParams = {
        content: "devices",
        columns: "objid,device,host,parentid",
        // filter_* bekerja di /table.json; gunakan filter_parentid + filter_name
        filter_parentid: parentId,
        filter_name: name.trim(),
        username: PRTG_USERNAME,
        passhash: PRTG_PASSHASH,
      };
      const listResp = await axios.get(listUrl, { params: listParams });
      const devs = listResp.data?.devices || [];
      const found = devs.find((d) => String(d.device) === name.trim());
      if (found) newDeviceId = String(found.objid);
    }

    if (!newDeviceId) {
      return res.status(500).json({ error: "Gagal menentukan objid device baru setelah clone" });
    }

    // 2) SET properti host (IPv4/DNS) pada device hasil clone
    const setPropUrl = `${PRTG_HOST}/api/setobjectproperty.htm`;
    const setPropParams = {
      id: newDeviceId,
      name: "host",          // nama properti 'IPv4 Address/DNS Name'
      value: host.trim(),
      username: PRTG_USERNAME,
      passhash: PRTG_PASSHASH,
    };
    await axios.get(setPropUrl, { params: setPropParams });

    // (Opsional) kamu bisa set properti lain, mis. credentials atau tags, dengan setobjectproperty.htm yang sama

    // 3) (Opsional) Simpan ke DB lokal kamu, kalau memang diperlukan
    let deviceDb = null;
    try {
      deviceDb = await prisma.device.create({
        data: {
          name: name.trim(),
          host: host.trim(),
          prtgId: newDeviceId,
        },
      });
    } catch (e) {
      // lewati kalau tabel/device model opsional
    }

    return res.json({
      success: true,
      message: "Device created via clone + host set",
      objectId: newDeviceId,
      device: deviceDb,
    });
  } catch (error) {
    console.error("Error creating device via clone:", error?.response?.data || error.message);
    return res.status(500).json({
      error: "Failed to create device: " + (error?.response?.data || error.message),
    });
  }
});



// Get devices
app.get("/api/devices", async (req, res) => {
  try {
    const url = `${PRTG_HOST}/api/table.json`;
    const params = {
      content: "devices",
      columns: "objid,device,host,group,probe,status",
      username: PRTG_USERNAME,
      passhash: PRTG_PASSHASH,
    };
    const response = await axios.get(url, { params });
    res.json(response.data.devices || []);
  } catch (error) {
    console.error("Error fetching devices:", error.message);
    res.status(500).json({ error: "Failed to fetch devices" });
  }
});

// Update device
app.put("/api/devices/:id", async (req, res) => {
  const { id } = req.params;
  const { newName } = req.body;
  if (!newName) return res.status(400).json({ error: "New name is required" });
  try {
    const url = `${PRTG_HOST}/api/setobjectproperty.htm`;
    const params = {
      id,
      name: "name",
      value: newName.trim(),
      username: PRTG_USERNAME,
      passhash: PRTG_PASSHASH,
    };
    const response = await axios.get(url, { params });
    res.json({ success: true, result: response.data });
  } catch (error) {
    console.error("Error updating device:", error.message);
    res.status(500).json({ error: "Failed to update device" });
  }
});

// Delete device
app.delete("/api/devices/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const url = `${PRTG_HOST}/api/deleteobject.htm`;
    const params = {
      id,
      approve: 1,
      username: PRTG_USERNAME,
      passhash: PRTG_PASSHASH,
    };
    const response = await axios.get(url, { params });
    res.json({ success: true, result: response.data });
  } catch (error) {
    console.error("Error deleting device:", error.message);
    res.status(500).json({ error: "Failed to delete device" });
  }
});

// Get groups
app.get("/api/groups", async (req, res) => {
  try {
    const url = `${PRTG_HOST}/api/table.json`;
    const params = {
      content: "groups",
      columns: "objid,group,probe",
      username: PRTG_USERNAME,
      passhash: PRTG_PASSHASH,
    };
    const response = await axios.get(url, { params });
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching groups:", error.message);
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

/* ==================== LOGIN ==================== */
app.post("/login", async (req, res) => {
  const { username, password, userAgent } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: "User not found" });
    if (!user.password) {
      return res.status(401).json({ error: "User has no password set" });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ error: "Invalid credentials" });

    await prisma.userLog.create({
      data: {
        userId: user.id,
        username: user.username || "",
        action: "login",
        ip: req.ip || "",
        userAgent: userAgent || req.headers["user-agent"] || "",
      },
    });

    res.json({
      id: user.id,
      name: user.username,
      email: user.email ?? "",
      role: user.role,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ==================== LOGOUT ==================== */
app.post("/logout", async (req, res) => {
  try {
    const { userId, username, userAgent } = req.body;
    if (!userId || !username) {
      return res.status(400).json({ error: "User ID and username are required" });
    }
    await prisma.userLog.create({
      data: {
        userId,
        username,
        action: "logout",
        ip: req.ip || "",
        userAgent: userAgent || req.headers["user-agent"] || "",
      },
    });
    res.json({ success: true, message: "User logged out" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ==================== USERS ==================== */
app.get("/api/user", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        isActivated: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json(users);
  } catch (error) {
    console.error("Error getting users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/user/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

/* ==================== INVITATION & ACTIVATION ==================== */
app.post("/api/invitation", async (req, res) => {
  const { email, role } = req.body;
  if (!email || !role) return res.status(400).json({ error: "Email and role are required" });
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: "Email already invited" });

    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    await prisma.user.create({ data: { email, role, isActivated: false, activationToken: token } });

    const activationLink = `http://localhost:3000/activate`;
    await sendEmail({ to: email, subject: "You're Invited to SOC Dashboard", html: `<p>Hello,</p><p>You have been invited as <strong>${role}</strong>.</p><p>Activation page: <a href="${activationLink}">${activationLink}</a></p><p>Token: <b>${token}</b></p>` });

    res.status(200).json({ success: true, message: "Invitation sent successfully", token });
  } catch (error) {
    console.error("Invitation error:", error);
    res.status(500).json({ error: "Failed to send invitation" });
  }
});

app.post("/api/activate", async (req, res) => {
  const { token, username, password, name } = req.body;
  if (!token || !username || !password || !name) return res.status(400).json({ error: "All fields are required" });

  try {
    const user = await prisma.user.findFirst({ where: { activationToken: token, isActivated: false } });
    if (!user) return res.status(400).json({ error: "Invalid or expired token" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const updated = await prisma.user.update({ where: { id: user.id }, data: { username, name, password: hashedPassword, isActivated: true, activationToken: null } });

    // ✅ Free trial (5 menit)
    if (user.isTrial) {
      setTimeout(async () => {
        try {
          await prisma.user.update({ where: { id: user.id }, data: { isActivated: false } });
          console.log(`⏳ Trial expired for ${user.email}`);
        } catch (err) { console.error(err); }
      }, 5 * 60 * 1000);
    }

    // ✅ Subscription (30 menit atau sesuai subscriptionDurationMinutes)
    if (!user.isTrial && user.subscriptionDurationMinutes) {
      setTimeout(async () => {
        try {
          await prisma.user.update({ where: { id: user.id }, data: { isActivated: false } });
          console.log(`⏳ Subscription expired for ${user.email}`);
        } catch (err) { console.error(err); }
      }, user.subscriptionDurationMinutes * 60 * 1000);
    }

    res.json({ success: true, user: { id: updated.id } });
  } catch (error) {
    console.error("Activation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ==================== SENSOR DATA ==================== */
app.get("/api/sensors", async (req, res) => {
  try {
    const sensors = await prisma.sensors.findMany();
    res.json(sensors);
  } catch (error) {
    console.error("Error fetching sensors:", error);
    res.status(500).json({ error: "Failed to fetch sensors" });
  }
});

app.get("/api/sensor_logs", async (req, res) => {
  try {
    const logs = await prisma.sensor_logs.findMany();
    res.json(logs);
  } catch (error) {
    console.error("Error fetching sensor logs:", error);
    res.status(500).json({ error: "Failed to fetch sensor logs" });
  }
});

/* ==================== USER LOGS ==================== */
app.get("/api/user-logs", async (req, res) => {
  try {
    const logs = await prisma.userLog.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(logs);
  } catch (error) {
    console.error("Error fetching user logs:", error);
    res.status(500).json({ error: "Failed to fetch user logs" });
  }
});

/* ==================== SLA LOGS ==================== */
app.get("/api/sla-logs", async (req, res) => {
  try {
    const logs = await prisma.slaLogs.findMany();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Gagal ambil SLA Logs" });
  }
});

app.post("/api/sla-logs", async (req, res) => {
  try {
    const { name, value } = req.body;
    const newLog = await prisma.slaLogs.create({
      data: { name, value },
    });
    res.json(newLog);
  } catch (err) {
    res.status(500).json({ error: "Gagal tambah SLA Log" });
  }
});

/* =========== NEW: PAYMENT FLOW (profile → invite + invoice) =========== */

/**
 * 1) Simpan data diri pendaftar (tanpa email). Frontend akan lanjut ke step bayar dummy → input email.
 * Body: { plan, price, companyName, fullName, city, country }
 * Return: { profileId }
 */
app.post("/api/payment/profile", async (req, res) => {
  try {
    const { plan, price, companyName, fullName, city, country, email } = req.body;
    if (!plan || price == null || !companyName || !fullName || !city || !country || !email) {
      return res.status(400).json({ error: "Semua field profil wajib diisi" });
    }

    const profile = await prisma.subscriptionProfile.create({
      data: {
        plan: String(plan),
        price: parseInt(price, 10),
        companyName,
        fullName,
        city,
        country,
        email, // ✅ simpan email juga
      },
      select: { id: true },
    });

    res.json({ success: true, profileId: profile.id });
  } catch (error) {
    console.error("Payment profile error:", error);
    res.status(500).json({ error: "Failed to create payment profile" });
  }
});

/**
 * 2) Setelah bayar dummy, user masukkan email untuk undangan admin.
 * Body: { profileId, email, role }  (role biasanya "admin")
 * - Buat user (cek email unik)
 * - Set user.subscriptionDurationMinutes = 30 (sesuai requirement)
 * - Update SubscriptionProfile.userId
 * - Kirim email undangan + email invoice dummy (menggunakan data profile)
 * Return: { token }
 */
app.post("/api/payment/invite", async (req, res) => {
  try {
    const { profileId, email, role } = req.body;
    if (!profileId || !email || !role) {
      return res.status(400).json({ error: "profileId, email, dan role wajib diisi" });
    }

    const profile = await prisma.subscriptionProfile.findUnique({ where: { id: profileId } });
    if (!profile) return res.status(404).json({ error: "Payment profile tidak ditemukan" });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: "Email already registered" });

    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);

    const user = await prisma.user.create({
      data: {
        email,
        role,
        isActivated: false,
        activationToken: token,
        isTrial: false,
        subscriptionDurationMinutes: 30, // ⬅️ 30 menit aktif setelah aktivasi
      },
    });

    // Link aktivasi
    const activationLink = `http://localhost:3000/activate`;

    // Email undangan (aktivasi)
    await sendEmail({
      to: email,
      subject: "Payment Success - Activate Your SOC Dashboard Account",
      html: `
        <h2>Thank you for your payment!</h2>
        <p>Your account is almost ready. Please activate it using the token below:</p>
        <p><a href="${activationLink}">${activationLink}</a></p>
        <p><b>Activation Token:</b> ${token}</p>
        <p><i>Note:</i> Setelah aktivasi, akun akan aktif <b>30 menit</b> kemudian otomatis menjadi <b>Inactive</b>.</p>
      `,
    });

    // Email invoice dummy (mengambil data dari profile)
    const invoiceNo = `INV-${Date.now()}`;
    const issuedAt = new Date().toLocaleString();

    await sendEmail({
      to: email,
      subject: `Invoice ${invoiceNo} - SOC Dashboard`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #eee; padding: 16px;">
          <h2 style="margin:0 0 8px 0;">Invoice (Dummy)</h2>
          <p style="margin:0 0 16px 0; color:#555;">${issuedAt}</p>
          <hr/>
          <h3 style="margin:16px 0 8px 0;">Billing To</h3>
          <table style="width:100%; border-collapse: collapse;">
            <tr><td style="padding:4px 0;"><b>Company</b></td><td>${profile.companyName}</td></tr>
            <tr><td style="padding:4px 0;"><b>Full Name</b></td><td>${profile.fullName}</td></tr>
            <tr><td style="padding:4px 0;"><b>City</b></td><td>${profile.city}</td></tr>
            <tr><td style="padding:4px 0;"><b>Country</b></td><td>${profile.country}</td></tr>
          </table>
          <h3 style="margin:16px 0 8px 0;">Order</h3>
          <table style="width:100%; border-collapse: collapse;">
            <tr><td style="padding:4px 0;"><b>Plan</b></td><td>${profile.plan}</td></tr>
            <tr><td style="padding:4px 0;"><b>Price</b></td><td>$${profile.price}</td></tr>
            <tr><td style="padding:4px 0;"><b>Invoice No.</b></td><td>${invoiceNo}</td></tr>
            <tr><td style="padding:4px 0;"><b>Status</b></td><td>Paid (Dummy)</td></tr>
          </table>
          <hr/>
          <p style="color:#777;">Ini adalah invoice simulasi untuk keperluan demo.</p>
        </div>
      `,
    });

    // Link-kan profile ke user yang diundang
    await prisma.subscriptionProfile.update({
      where: { id: profileId },
      data: { userId: user.id },
    });

    res.json({ success: true, message: "Invitation + invoice sent", token });
  } catch (error) {
    console.error("Payment invite error:", error);
    res.status(500).json({ error: "Failed to process invitation" });
  }
});


/* ==================== SUBSCRIPTION PROFILE ==================== */

// Get all subscription profiles
app.get("/api/subscription-profiles", async (req, res) => {
  try {
    const profiles = await prisma.subscriptionProfile.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            role: true,
            isActivated: true,
          },
        },
      },
    });
    res.json(profiles);
  } catch (error) {
    console.error("Error fetching subscription profiles:", error);
    res.status(500).json({ error: "Failed to fetch subscription profiles" });
  }
});

// Get single subscription profile by ID
app.get("/api/subscription-profiles/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const profile = await prisma.subscriptionProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            role: true,
            isActivated: true,
          },
        },
      },
    });

    if (!profile) {
      return res.status(404).json({ error: "Subscription profile not found" });
    }

    res.json(profile);
  } catch (error) {
    console.error("Error fetching subscription profile:", error);
    res.status(500).json({ error: "Failed to fetch subscription profile" });
  }
});

/* ==================== FREE TRIAL ==================== */
app.post("/api/free-trial", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "Email already exists" });
    }
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await prisma.user.create({
      data: {
        email,
        role: "admin",
        isActivated: false,
        activationToken: token,
        isTrial: true,
      },
    });

    const activationLink = `http://localhost:3000/activate?token=${token}`;
    await sendEmail({
      to: email,
      subject: "🎯 Free Trial Invitation - 5 Minutes",
      html: `
        <h2>Selamat! Anda mendapatkan trial 5 menit.</h2>
        <p>Klik link berikut untuk mengaktifkan akun Anda:</p>
        <p><a href="${activationLink}">${activationLink}</a></p>
        <p><b>Catatan:</b> Trial akan dimulai saat Anda aktivasi akun dan berakhir otomatis 5 menit kemudian.</p>
        <p>Token Aktivasi: <b>${token}</b></p>
      `,
    });

    res.json({ success: true, message: "Trial invitation sent" });
  } catch (error) {
    console.error("Free trial error:", error);
    res.status(500).json({ error: "Failed to create trial invitation" });
  }
});
/* ==================== Api Midtrans ==================== */
app.post("/api/payment/create-order", async (req, res) => {
  try {
    const { subscriptionProfileId, packageName, price } = req.body;
    const orderId = "ORDER-" + Date.now();

    if (!subscriptionProfileId || !packageName || !price) {
      return res.status(400).json({ error: "subscriptionProfileId, packageName, dan price wajib diisi" });
    }

    let parameter = {
      payment_type: "qris",
      transaction_details: { order_id: orderId, gross_amount: price },
    };

    const response = await coreApi.charge(parameter);

    await prisma.payment.create({
      data: {
        profileId: subscriptionProfileId, // ⬅️ pastikan sesuai nama field di schema
        orderId,
        package: packageName,
        price,
        status: "pending",
      },
    });

    res.json({ orderId, qrisUrl: response.actions[0].url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal create order" });
  }
});


// index.js
// index.js
// ✅ Callback Midtrans
app.post("/api/payment/callback", async (req, res) => {
  try {
    const { order_id, transaction_status } = req.body;

    const payment = await prisma.payment.findUnique({
      where: { orderId: order_id },
      include: { profile: { include: { user: true } } },
    });

    if (!payment) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (transaction_status === "settlement") {
      // ✅ update status payment
      await prisma.payment.update({
        where: { orderId: order_id },
        data: { status: "paid" },
      });

      const profile = payment.profile;
      let user = profile.user;

      // 🔑 Generate token baru untuk aktivasi internal
      const token =
        Math.random().toString(36).slice(2) + Date.now().toString(36);

      if (!user) {
        // cek apakah email sudah ada di tabel user
        user = await prisma.user.findUnique({
          where: { email: profile.email },
        });

        if (user) {
          // update token saja
          await prisma.user.update({
            where: { id: user.id },
            data: { activationToken: token, isActivated: false },
          });
        } else {
          // create user baru
          user = await prisma.user.create({
            data: {
              email: profile.email,
              name: profile.fullName,
              role: "admin",
              isActivated: false,
              activationToken: token,
              subscriptionDurationMinutes: 30,
            },
          });
        }

        // link profile ke user
        await prisma.subscriptionProfile.update({
          where: { id: profile.id },
          data: { userId: user.id },
        });
      } else {
        // update token untuk user yg udah ada
        await prisma.user.update({
          where: { id: user.id },
          data: { activationToken: token, isActivated: false },
        });
      }

      // ✅ kirim email invoice (tanpa token)
      await sendEmail({
        to: profile.email,
        subject: "Invoice Pembayaran SOC Dashboard",
        html: `
          <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333">
            <h2 style="color:#0d6efd">Pembayaran Berhasil 🎉</h2>
            <p>Terima kasih sudah melakukan pembayaran. Berikut detail invoice Anda:</p>

            <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ccc;"><b>Invoice ID</b></td>
                <td style="padding: 8px; border: 1px solid #ccc;">${order_id}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ccc;"><b>Company</b></td>
                <td style="padding: 8px; border: 1px solid #ccc;">${profile.companyName}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ccc;"><b>Full Name</b></td>
                <td style="padding: 8px; border: 1px solid #ccc;">${profile.fullName}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ccc;"><b>Email</b></td>
                <td style="padding: 8px; border: 1px solid #ccc;">${profile.email}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ccc;"><b>Plan</b></td>
                <td style="padding: 8px; border: 1px solid #ccc;">${profile.plan}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ccc;"><b>Harga</b></td>
                <td style="padding: 8px; border: 1px solid #ccc;">Rp${profile.price}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ccc;"><b>Status</b></td>
                <td style="padding: 8px; border: 1px solid #ccc; color:green;"><b>LUNAS</b></td>
              </tr>
            </table>

            <p>Silakan login ke aplikasi SOC Dashboard untuk melanjutkan penggunaan layanan Anda.</p>
            <p style="margin-top:30px; font-size:12px; color:#666;">
              Email ini dikirim secara otomatis, mohon tidak membalas ke alamat email ini.
            </p>
          </div>
        `,
      });

      console.log(`✅ User updated + invoice sent to ${profile.email}`);

      return res.json({
        success: true,
        message: "Payment settled, invoice email sent",
        activationToken: token, // ini tetap dikirim ke FE via API
        userId: user.id,
      });
    }

    // kalau masih pending / expire
    res.json({ success: false, transaction_status });
  } catch (err) {
    console.error("Callback error:", err);
    res.status(500).json({ error: "Callback processing failed" });
  }
});



// api/payment/status/:orderId
app.get("/api/payment/status/:orderId", async (req, res) => {
  const { orderId } = req.params;
  try {
    const payment = await prisma.payment.findUnique({
      where: { orderId },
      include: { profile: { include: { user: true } } },
    });

    if (!payment) return res.status(404).json({ success: false, error: "Order not found" });

    res.json({
      success: true,
      status: payment.status, // "pending" | "paid"
      activationToken: payment.profile?.user?.activationToken || null,
    });
  } catch (err) {
    console.error("Status check error:", err);
    res.status(500).json({ success: false, error: "Failed to check status" });
  }
});



/* ==================== START SERVER ==================== */
app.listen(PORT, () => {
  console.log(`✅ Server backend berjalan di http://localhost:${PORT}`);
});
