import express from "express";
import cors from "cors";
import multer from "multer";
import { MongoClient } from "mongodb";
import fs from "node:fs";

loadEnvFile(".env.server");
loadEnvFile(".env");

const app = express();
const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "worklance";
const ipfsApiUrl = process.env.IPFS_API_URL || "http://127.0.0.1:5001/api/v0/add";
const ipfsGatewayBase = process.env.IPFS_GATEWAY_BASE || "https://ipfs.io/ipfs";
const smtpHost = process.env.SMTP_HOST || "";
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER || "";
const smtpPass = process.env.SMTP_PASS || "";
const smtpFrom = process.env.SMTP_FROM || smtpUser || "";

if (!mongoUri) {
  throw new Error("Missing MONGODB_URI in environment.");
}

const upload = multer({ storage: multer.memoryStorage() });
const mongoClient = new MongoClient(mongoUri);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

let db;
let mailTransporterPromise;

function loadEnvFile(fileName) {
  if (!fs.existsSync(fileName)) {
    return;
  }

  const rows = fs.readFileSync(fileName, "utf8").split(/\r?\n/);
  for (const row of rows) {
    const trimmed = row.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").trim();
    }
  }
}

function collection(name) {
  if (!db) {
    throw new Error("Database is not connected.");
  }
  return db.collection(name);
}

function now() {
  return new Date().toISOString();
}

app.get("/api/health", async (_req, res) => {
  const status = {
    api: "ok",
    mongodb: "unknown",
    database: dbName,
    email: smtpHost && smtpUser && smtpPass && smtpFrom ? "configured" : "not-configured",
    checkedAt: now()
  };

  try {
    await db.command({ ping: 1 });
    status.mongodb = "connected";
  } catch (error) {
    status.mongodb = "disconnected";
    status.message = error.message;
  }

  res.json(status);
});

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

async function getMailTransporter() {
  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    return null;
  }

  if (!mailTransporterPromise) {
    mailTransporterPromise = import("nodemailer")
      .then(({ default: nodemailer }) =>
        nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass
          }
        })
      )
      .catch(() => null);
  }

  return mailTransporterPromise;
}

async function sendPaymentConfirmationEmail(job) {
  const freelancerWallet = String(job.selectedFreelancer || job.freelancerWallet || "").toLowerCase();
  const freelancerProfileId = String(job.selectedFreelancerProfileId || "");

  const freelancer = await collection("users").findOne({
    $or: [
      ...(freelancerProfileId ? [{ profileId: freelancerProfileId }] : []),
      ...(freelancerWallet ? [{ walletLower: freelancerWallet }] : [])
    ]
  });

  const subject = `WorkLance payment confirmation for job #${job.jobId}`;
  const text = [
    `Hello ${freelancer.name || freelancer.username || "Freelancer"},`,
    "",
    "Your payment has been released on WorkLance.",
    "",
    `Project: ${job.title || `Job #${job.jobId}`}`,
    `Job ID: ${job.jobId}`,
    `Payment: ${job.paymentAmountEth || "0"} ETH`,
    `Client: ${job.clientName || "Client"}`,
    `Status: ${job.status || "Completed"}`,
    "",
    "Project details:",
    job.description || "No project description provided.",
    "",
    "Thank you for using WorkLance."
  ].join("\n");

  const emailRecord = {
    id: `email-${Date.now()}`,
    jobId: String(job.jobId),
    type: "payment-confirmation",
    to: freelancer?.email || "",
    subject,
    status: "logged",
    note: freelancer?.email
      ? "SMTP is not configured. Payment confirmation was stored but not sent."
      : "Freelancer email was not found. Payment confirmation was stored but not sent.",
    createdAt: now()
  };

  const transporter = await getMailTransporter();

  if (transporter && freelancer?.email) {
    await transporter.sendMail({
      from: smtpFrom,
      to: freelancer.email,
      subject,
      text
    });
    emailRecord.status = "sent";
    emailRecord.sentAt = now();
  }

  await collection("emails").insertOne(emailRecord);
  return emailRecord;
}

async function sendClientReceiptEmail(job) {
  const clientWallet = String(job.clientWallet || "").toLowerCase();
  const clientProfileId = String(job.clientProfileId || "");

  const client = await collection("users").findOne({
    $or: [
      ...(clientProfileId ? [{ profileId: clientProfileId }] : []),
      ...(clientWallet ? [{ walletLower: clientWallet }] : [])
    ]
  });

  const receipt = {
    id: `receipt-${Date.now()}`,
    jobId: String(job.jobId),
    type: "client-completion-receipt",
    to: client?.email || "",
    amountEth: String(job.paymentAmountEth || "0"),
    clientName: client?.name || client?.username || job.clientName || "Client",
    freelancerName: job.selectedFreelancerName || job.selectedFreelancerUsername || "Freelancer",
    title: job.title || `Job #${job.jobId}`,
    status: "logged",
    note: client?.email
      ? "SMTP is not configured. Receipt was stored but not sent."
      : "Client email was not found. Receipt was stored but not sent.",
    createdAt: now()
  };

  const subject = `WorkLance receipt for completed job #${job.jobId}`;
  const text = [
    `Hello ${receipt.clientName},`,
    "",
    "Your WorkLance receipt has been generated for a completed project.",
    "",
    `Project: ${receipt.title}`,
    `Job ID: ${job.jobId}`,
    `Freelancer: ${receipt.freelancerName}`,
    `Amount paid: ${receipt.amountEth} ETH`,
    `Completed on: ${receipt.createdAt}`,
    "",
    "Project details:",
    job.description || "No project description provided.",
    "",
    "Thank you for using WorkLance."
  ].join("\n");

  const transporter = await getMailTransporter();

  if (transporter && client?.email) {
    await transporter.sendMail({
      from: smtpFrom,
      to: client.email,
      subject,
      text
    });
    receipt.status = "sent";
    receipt.sentAt = now();
  }

  await collection("receipts").insertOne(receipt);
  return receipt;
}

async function uploadToIpfs(file) {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([file.buffer], { type: file.mimetype || "application/octet-stream" }),
    file.originalname
  );

  const response = await fetch(ipfsApiUrl, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`IPFS upload failed: ${body}`);
  }

  const payload = await response.json();
  return {
    cid: payload.Hash,
    gatewayUrl: `${ipfsGatewayBase}/${payload.Hash}`
  };
}

async function uploadWithFallback(file) {
  try {
    return await uploadToIpfs(file);
  } catch {
    return {
      cid: "",
      gatewayUrl: "",
      dataUrl: `data:${file.mimetype || "application/octet-stream"};base64,${file.buffer.toString("base64")}`
    };
  }
}

app.get("/api/users/:wallet", async (req, res) => {
  const wallet = req.params.wallet.toLowerCase();
  const username = normalizeUsername(req.query.username);
  const user = await collection("users").findOne({
    walletLower: wallet,
    ...(username ? { usernameLower: username } : {})
  });

  if (!user) {
    return res.status(404).json({ message: "No profile found for this wallet." });
  }

  res.json(user);
});

app.get("/api/admin/users", async (_req, res) => {
  const rows = await collection("users")
    .find({})
    .project({ _id: 0 })
    .sort({ createdAt: -1 })
    .toArray();
  res.json(rows);
});

app.post("/api/admin/sync-users", async (req, res) => {
  const users = Array.isArray(req.body?.users) ? req.body.users : [];
  const results = [];

  for (const user of users) {
    const payload = {
      ...user,
      profileId: user.profileId || `profile-${Date.now()}-${results.length}`,
      walletLower: String(user.wallet || "").toLowerCase(),
      usernameLower: normalizeUsername(user.username),
      updatedAt: now(),
      createdAt: user.createdAt || now()
    };

    if (!payload.walletLower || !payload.usernameLower) {
      continue;
    }

    await collection("users").updateOne(
      {
        walletLower: payload.walletLower,
        usernameLower: payload.usernameLower
      },
      { $set: payload },
      { upsert: true }
    );

    results.push(payload);
  }

  res.json({ synced: results.length, users: results });
});

app.get("/api/admin/receipts", async (_req, res) => {
  const rows = await collection("receipts")
    .find({})
    .project({ _id: 0 })
    .sort({ createdAt: -1 })
    .toArray();
  res.json(rows);
});

app.get("/api/admin/emails", async (_req, res) => {
  const rows = await collection("emails")
    .find({})
    .project({ _id: 0 })
    .sort({ createdAt: -1 })
    .toArray();
  res.json(rows);
});

app.post("/api/users", async (req, res) => {
  const payload = {
    ...req.body,
    profileId: req.body.profileId || `profile-${Date.now()}`,
    walletLower: String(req.body.wallet || "").toLowerCase(),
    usernameLower: normalizeUsername(req.body.username),
    updatedAt: now(),
    createdAt: req.body.createdAt || now()
  };

  await collection("users").updateOne(
    {
      walletLower: payload.walletLower,
      usernameLower: payload.usernameLower
    },
    { $set: payload },
    { upsert: true }
  );

  res.json(payload);
});

app.patch("/api/users/:wallet", async (req, res) => {
  const identifier = String(req.params.wallet || "");
  const walletLower = identifier.toLowerCase();
  const existing = await collection("users").findOne({
    $or: [{ walletLower }, { profileId: identifier }]
  });

  if (!existing) {
    return res.status(404).json({ message: "Profile not found for this wallet." });
  }

  const nextUser = {
    ...existing,
    ...req.body,
    wallet: existing.wallet,
    walletLower: existing.walletLower,
    usernameLower: normalizeUsername(req.body.username || existing.username),
    updatedAt: now()
  };

  await collection("users").updateOne({ _id: existing._id }, { $set: nextUser });
  res.json(nextUser);
});

app.get("/api/jobs", async (_req, res) => {
  const jobs = await collection("jobs").find({}).sort({ createdAt: -1 }).toArray();
  res.json(jobs);
});

app.get("/api/jobs/:jobId", async (req, res) => {
  const job = await collection("jobs").findOne({ jobId: String(req.params.jobId) });
  if (!job) {
    return res.status(404).json({ message: "Job not found." });
  }
  res.json(job);
});

app.post("/api/jobs", async (req, res) => {
  const payload = {
    proposals: [],
    selectedFreelancer: null,
    smartContract: null,
    files: [],
    createdAt: now(),
    updatedAt: now(),
    ...req.body,
    jobId: String(req.body.jobId)
  };

  await collection("jobs").updateOne(
    { jobId: payload.jobId },
    { $set: payload },
    { upsert: true }
  );

  res.json(payload);
});

app.patch("/api/jobs/:jobId", async (req, res) => {
  const current = await collection("jobs").findOne({ jobId: String(req.params.jobId) });
  if (!current) {
    return res.status(404).json({ message: "Job not found." });
  }

  const nextJob = {
    ...current,
    ...req.body,
    jobId: String(req.params.jobId),
    updatedAt: now()
  };

  await collection("jobs").updateOne({ jobId: nextJob.jobId }, { $set: nextJob });
  res.json(nextJob);
});

app.post("/api/jobs/:jobId/proposals", async (req, res) => {
  const jobId = String(req.params.jobId);
  const current = await collection("jobs").findOne({ jobId });
  if (!current) {
    return res.status(404).json({ message: "Job not found." });
  }

  const proposal = {
    id: `${jobId}-${Date.now()}`,
    createdAt: now(),
    ...req.body
  };

  const nextJob = {
    ...current,
    proposals: [...(current.proposals || []), proposal],
    updatedAt: now()
  };

  await collection("jobs").updateOne({ jobId }, { $set: nextJob });
  res.json(nextJob);
});

app.patch("/api/jobs/:jobId/proposals/:proposalId", async (req, res) => {
  const jobId = String(req.params.jobId);
  const proposalId = String(req.params.proposalId);
  const current = await collection("jobs").findOne({ jobId });
  if (!current) {
    return res.status(404).json({ message: "Job not found." });
  }

  const proposals = current.proposals || [];
  const proposalIndex = proposals.findIndex((item) => item.id === proposalId);
  if (proposalIndex === -1) {
    return res.status(404).json({ message: "Proposal not found." });
  }

  const nextProposals = [...proposals];
  nextProposals[proposalIndex] = {
    ...nextProposals[proposalIndex],
    ...req.body,
    updatedAt: now()
  };

  const nextJob = {
    ...current,
    proposals: nextProposals,
    updatedAt: now()
  };

  await collection("jobs").updateOne({ jobId }, { $set: nextJob });
  res.json(nextJob);
});

app.post("/api/jobs/:jobId/select-proposal", async (req, res) => {
  const jobId = String(req.params.jobId);
  const current = await collection("jobs").findOne({ jobId });
  if (!current) {
    return res.status(404).json({ message: "Job not found." });
  }

  const proposal = (current.proposals || []).find((item) => item.id === req.body.proposalId);
  if (!proposal) {
    return res.status(404).json({ message: "Proposal not found." });
  }

  const agreedAmountValue =
    proposal.negotiationStatus === "accepted" && proposal.counterAmountValue
      ? proposal.counterAmountValue
      : proposal.bidAmountValue || proposal.bidAmount || current.paymentAmountValue;
  const agreedCurrency =
    proposal.negotiationStatus === "accepted" && proposal.counterCurrency
      ? proposal.counterCurrency
      : proposal.bidCurrency || current.paymentCurrency || "ETH";
  const agreedAmountEth =
    proposal.negotiationStatus === "accepted" && proposal.counterAmountEth
      ? proposal.counterAmountEth
      : proposal.bidAmountEth || current.paymentAmountEth;

  const nextJob = {
    ...current,
    selectedFreelancer: proposal.freelancerWallet,
    selectedFreelancerName: proposal.freelancerName || "",
    selectedFreelancerUsername: proposal.freelancerUsername || "",
    selectedFreelancerProfileId: proposal.freelancerProfileId || "",
    selectedProposalId: req.body.proposalId,
    paymentAmountValue: agreedAmountValue,
    paymentCurrency: agreedCurrency,
    paymentAmountEth: agreedAmountEth,
    agreedProposalAmountEth: agreedAmountEth,
    agreedProposalAmountValue: agreedAmountValue,
    agreedProposalCurrency: agreedCurrency,
    status: "Freelancer Selected",
    updatedAt: now()
  };

  await collection("jobs").updateOne({ jobId }, { $set: nextJob });
  res.json(nextJob);
});

app.post("/api/jobs/:jobId/smart-contract", async (req, res) => {
  const jobId = String(req.params.jobId);
  const current = await collection("jobs").findOne({ jobId });
  if (!current) {
    return res.status(404).json({ message: "Job not found." });
  }

  const nextJob = {
    ...current,
    smartContract: req.body.smartContract,
    status: "Smart Contract Created",
    updatedAt: now()
  };

  await collection("jobs").updateOne({ jobId }, { $set: nextJob });
  res.json(nextJob);
});

app.post("/api/jobs/:jobId/files", async (req, res) => {
  const jobId = String(req.params.jobId);
  const current = await collection("jobs").findOne({ jobId });
  if (!current) {
    return res.status(404).json({ message: "Job not found." });
  }

  const fileRecord = {
    id: `file-${Date.now()}`,
    createdAt: now(),
    ...req.body,
    jobId
  };

  await collection("files").insertOne(fileRecord);

  const nextJob = {
    ...current,
    files: [...(current.files || []), fileRecord],
    updatedAt: now()
  };

  await collection("jobs").updateOne({ jobId }, { $set: nextJob });
  res.json(fileRecord);
});

app.get("/api/transactions", async (_req, res) => {
  const rows = await collection("transactions").find({}).sort({ createdAt: -1 }).toArray();
  res.json(rows);
});

app.post("/api/transactions", async (req, res) => {
  const row = {
    id: `tx-${Date.now()}`,
    createdAt: now(),
    ...req.body
  };
  await collection("transactions").insertOne(row);
  res.json(row);
});

app.get("/api/messages", async (_req, res) => {
  const rows = await collection("messages").find({}).sort({ createdAt: 1 }).toArray();
  res.json(rows);
});

app.post("/api/jobs/:jobId/messages", async (req, res) => {
  const row = {
    id: `msg-${Date.now()}`,
    jobId: String(req.params.jobId),
    createdAt: now(),
    ...req.body
  };
  await collection("messages").insertOne(row);
  res.json(row);
});

app.post("/api/jobs/:jobId/payment-confirmation-email", async (req, res) => {
  const jobId = String(req.params.jobId);
  const job = await collection("jobs").findOne({ jobId });

  if (!job) {
    return res.status(404).json({ message: "Job not found." });
  }

  try {
    const result = await sendPaymentConfirmationEmail(job);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message || "Could not send payment confirmation email." });
  }
});

app.post("/api/jobs/:jobId/client-receipt-email", async (req, res) => {
  const jobId = String(req.params.jobId);
  const job = await collection("jobs").findOne({ jobId });

  if (!job) {
    return res.status(404).json({ message: "Job not found." });
  }

  try {
    const result = await sendClientReceiptEmail(job);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message || "Could not generate or send the client receipt." });
  }
});

app.post("/api/uploads/profile-cv", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const { cid, gatewayUrl, dataUrl } = await uploadWithFallback(req.file);
  const record = {
    id: `upload-${Date.now()}`,
    ownerWallet: String(req.body.ownerWallet || "").toLowerCase(),
    category: "profile-cv",
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    cid,
    gatewayUrl,
    dataUrl,
    createdAt: now()
  };

  await collection("uploads").insertOne(record);
  res.json(record);
});

app.post("/api/uploads/job-file", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const { cid, gatewayUrl, dataUrl } = await uploadWithFallback(req.file);
  const record = {
    id: `upload-${Date.now()}`,
    ownerWallet: String(req.body.ownerWallet || "").toLowerCase(),
    category: "project-file",
    jobId: String(req.body.jobId || ""),
    label: req.body.label || req.file.originalname,
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    cid,
    gatewayUrl,
    dataUrl,
    createdAt: now()
  };

  await collection("uploads").insertOne(record);
  res.json(record);
});

app.get("/api/uploads/owner/:wallet", async (req, res) => {
  const rows = await collection("uploads")
    .find({ ownerWallet: req.params.wallet.toLowerCase() })
    .sort({ createdAt: -1 })
    .toArray();
  res.json(rows);
});

async function start() {
  try {
    await mongoClient.connect();
    db = mongoClient.db(dbName);
    console.log(`MongoDB connected to database "${dbName}".`);
  } catch (error) {
    console.error("MongoDB connection failed. API will run without database persistence.");
    console.error(error.message);
  }

  app.listen(port, () => {
    console.log(`WorkLance API listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
