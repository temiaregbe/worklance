const CURRENT_USER_KEY = "worklance_current_user";
const USERS_KEY = "worklance_users";
const JOBS_KEY = "worklance_jobs";
const TRANSACTIONS_KEY = "worklance_transactions";
const MESSAGES_KEY = "worklance_messages";
const FILES_KEY = "worklance_files";
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readSessionJson(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeSessionJson(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

function isNetworkFailure(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("database is not connected") ||
    message.includes("status 500") ||
    message.includes("status 503")
  );
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function withFallback(remoteAction, localAction) {
  try {
    return await remoteAction();
  } catch (error) {
    if (!isNetworkFailure(error)) {
      throw error;
    }
    return localAction();
  }
}

function getUsersLocal() {
  return readJson(USERS_KEY, []);
}

function saveUsersLocal(users) {
  writeJson(USERS_KEY, users);
}

function getJobsLocal() {
  return readJson(JOBS_KEY, []);
}

function saveJobsLocal(jobs) {
  writeJson(JOBS_KEY, jobs);
}

function getTransactionsLocal() {
  return readJson(TRANSACTIONS_KEY, []);
}

function saveTransactionsLocal(rows) {
  writeJson(TRANSACTIONS_KEY, rows);
}

function getMessagesLocal() {
  return readJson(MESSAGES_KEY, []);
}

function saveMessagesLocal(rows) {
  writeJson(MESSAGES_KEY, rows);
}

function getFilesLocal() {
  return readJson(FILES_KEY, []);
}

function saveFilesLocal(rows) {
  writeJson(FILES_KEY, rows);
}

function now() {
  return new Date().toISOString();
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function createProfileId() {
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getCurrentUser() {
  return readSessionJson(CURRENT_USER_KEY, null);
}

export function logoutUser() {
  sessionStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
}

export async function registerUser(profile) {
  const user = await withFallback(
    () =>
      request("/users", {
        method: "POST",
        body: JSON.stringify(profile)
      }),
    () => {
      const users = getUsersLocal();
      const nextUser = {
        ...profile,
        profileId: profile.profileId || createProfileId(),
        walletLower: String(profile.wallet || "").toLowerCase(),
        nameLower: normalizeName(profile.name),
        usernameLower: normalizeUsername(profile.username),
        createdAt: now(),
        updatedAt: now()
      };
      const nextUsers = users.filter(
        (item) =>
          !(
            item.walletLower === nextUser.walletLower &&
            (item.usernameLower || normalizeUsername(item.username)) === nextUser.usernameLower
          )
      );
      nextUsers.push(nextUser);
      saveUsersLocal(nextUsers);
      return nextUser;
    }
  );

  writeSessionJson(CURRENT_USER_KEY, user);
  return user;
}

export async function syncLocalUsersToBackend() {
  const users = getUsersLocal();

  if (users.length === 0) {
    return { synced: 0, users: [] };
  }

  return request("/admin/sync-users", {
    method: "POST",
    body: JSON.stringify({ users })
  });
}

export async function loginUser(wallet, username) {
  const user = await withFallback(
    () => request(`/users/${wallet}?username=${encodeURIComponent(String(username || ""))}`),
    () => {
      const walletLower = String(wallet || "").toLowerCase();
      const usernameLower = normalizeUsername(username);
      const userRecord = getUsersLocal().find(
        (item) =>
          item.walletLower === walletLower &&
          (
            !usernameLower ||
            (item.usernameLower || normalizeUsername(item.username)) === usernameLower
          )
      );
      if (!userRecord) {
        throw new Error("No profile found for this wallet and username.");
      }
      return userRecord;
    }
  );

  writeSessionJson(CURRENT_USER_KEY, user);
  return user;
}

export async function saveProfile(identifier, updates) {
  const user = await withFallback(
    () =>
      request(`/users/${identifier}`, {
        method: "PATCH",
        body: JSON.stringify(updates)
      }),
    () => {
      const users = getUsersLocal();
      const profileId = String(identifier || "");
      const walletLower = String(identifier || "").toLowerCase();
      const index = users.findIndex(
        (item) => item.profileId === profileId || item.walletLower === walletLower
      );

      if (index === -1) {
        throw new Error("Profile not found.");
      }

      const nextUser = {
        ...users[index],
        ...updates,
        wallet: users[index].wallet,
        profileId: users[index].profileId,
        walletLower: users[index].walletLower,
        nameLower: normalizeName(updates.name ?? users[index].name),
        usernameLower: normalizeUsername(updates.username ?? users[index].username),
        updatedAt: now()
      };

      users[index] = nextUser;
      saveUsersLocal(users);
      return nextUser;
    }
  );

  writeSessionJson(CURRENT_USER_KEY, user);
  return user;
}

export async function listJobs() {
  return withFallback(() => request("/jobs"), () => getJobsLocal().sort(sortNewest));
}

export async function getJobRecord(jobId) {
  return withFallback(
    () => request(`/jobs/${jobId}`),
    () => {
      const job = getJobsLocal().find((item) => item.jobId === String(jobId));
      if (!job) {
        throw new Error("Job not found.");
      }
      return job;
    }
  );
}

export async function createListing(job) {
  return withFallback(
    () =>
      request("/jobs", {
        method: "POST",
        body: JSON.stringify(job)
      }),
    () => {
      const jobs = getJobsLocal();
      const nextJob = {
        proposals: [],
        selectedFreelancer: null,
        smartContract: null,
        files: [],
        createdAt: now(),
        updatedAt: now(),
        ...job,
        jobId: String(job.jobId)
      };
      const nextJobs = jobs.filter((item) => item.jobId !== nextJob.jobId);
      nextJobs.unshift(nextJob);
      saveJobsLocal(nextJobs);
      return nextJob;
    }
  );
}

export async function updateListing(jobId, updater) {
  return withFallback(
    async () => {
      const currentJob = await request(`/jobs/${jobId}`);
      const nextJob = typeof updater === "function" ? updater(currentJob) : updater;
      return request(`/jobs/${jobId}`, {
        method: "PATCH",
        body: JSON.stringify(nextJob)
      });
    },
    () => {
      const jobs = getJobsLocal();
      const index = jobs.findIndex((item) => item.jobId === String(jobId));
      if (index === -1) {
        throw new Error("Job not found.");
      }

      const currentJob = jobs[index];
      const nextJob = typeof updater === "function" ? updater(currentJob) : updater;
      jobs[index] = {
        ...currentJob,
        ...nextJob,
        jobId: String(jobId),
        updatedAt: now()
      };
      saveJobsLocal(jobs);
      return jobs[index];
    }
  );
}

export async function submitProposal(jobId, proposal) {
  return withFallback(
    () =>
      request(`/jobs/${jobId}/proposals`, {
        method: "POST",
        body: JSON.stringify(proposal)
      }),
    () => {
      const jobs = getJobsLocal();
      const index = jobs.findIndex((item) => item.jobId === String(jobId));
      if (index === -1) {
        throw new Error("Job not found.");
      }

      const nextProposal = {
        id: `${jobId}-${Date.now()}`,
        createdAt: now(),
        ...proposal
      };

      jobs[index] = {
        ...jobs[index],
        proposals: [...(jobs[index].proposals || []), nextProposal],
        updatedAt: now()
      };
      saveJobsLocal(jobs);
      return jobs[index];
    }
  );
}

export async function selectFreelancerProposal(jobId, proposalId) {
  return withFallback(
    () =>
      request(`/jobs/${jobId}/select-proposal`, {
        method: "POST",
        body: JSON.stringify({ proposalId })
      }),
    () => {
      const jobs = getJobsLocal();
      const index = jobs.findIndex((item) => item.jobId === String(jobId));
      if (index === -1) {
        throw new Error("Job not found.");
      }

      const proposal = (jobs[index].proposals || []).find((item) => item.id === proposalId);
      if (!proposal) {
        throw new Error("Proposal not found.");
      }

      const agreedAmountValue =
        proposal.negotiationStatus === "accepted" && proposal.counterAmountValue
          ? proposal.counterAmountValue
          : proposal.bidAmountValue || proposal.bidAmount || jobs[index].paymentAmountValue;
      const agreedCurrency =
        proposal.negotiationStatus === "accepted" && proposal.counterCurrency
          ? proposal.counterCurrency
          : proposal.bidCurrency || jobs[index].paymentCurrency || "ETH";
      const agreedAmountEth =
        proposal.negotiationStatus === "accepted" && proposal.counterAmountEth
          ? proposal.counterAmountEth
          : proposal.bidAmountEth || jobs[index].paymentAmountEth;

      jobs[index] = {
        ...jobs[index],
        selectedFreelancer: proposal.freelancerWallet,
        selectedFreelancerName: proposal.freelancerName,
        selectedFreelancerUsername: proposal.freelancerUsername || "",
        selectedFreelancerProfileId: proposal.freelancerProfileId || "",
        selectedProposalId: proposalId,
        paymentAmountValue: agreedAmountValue,
        paymentCurrency: agreedCurrency,
        paymentAmountEth: agreedAmountEth,
        agreedProposalAmountEth: agreedAmountEth,
        agreedProposalAmountValue: agreedAmountValue,
        agreedProposalCurrency: agreedCurrency,
        status: "Freelancer Selected",
        updatedAt: now()
      };
      saveJobsLocal(jobs);
      return jobs[index];
    }
  );
}

export async function updateProposal(jobId, proposalId, updates) {
  return withFallback(
    () =>
      request(`/jobs/${jobId}/proposals/${proposalId}`, {
        method: "PATCH",
        body: JSON.stringify(updates)
      }),
    () => {
      const jobs = getJobsLocal();
      const index = jobs.findIndex((item) => item.jobId === String(jobId));
      if (index === -1) {
        throw new Error("Job not found.");
      }

      const proposals = jobs[index].proposals || [];
      const proposalIndex = proposals.findIndex((item) => item.id === proposalId);
      if (proposalIndex === -1) {
        throw new Error("Proposal not found.");
      }

      const nextProposals = [...proposals];
      nextProposals[proposalIndex] = {
        ...nextProposals[proposalIndex],
        ...updates,
        updatedAt: now()
      };

      jobs[index] = {
        ...jobs[index],
        proposals: nextProposals,
        updatedAt: now()
      };
      saveJobsLocal(jobs);
      return jobs[index];
    }
  );
}

export async function attachSmartContract(jobId, smartContract) {
  return withFallback(
    () =>
      request(`/jobs/${jobId}/smart-contract`, {
        method: "POST",
        body: JSON.stringify({ smartContract })
      }),
    () => updateListing(jobId, (job) => ({ ...job, smartContract, status: "Smart Contract Created" }))
  );
}

export async function saveFileRecord(record) {
  return withFallback(
    () =>
      request(`/jobs/${record.jobId}/files`, {
        method: "POST",
        body: JSON.stringify(record)
      }),
    () => {
      const fileRecord = {
        id: `file-${Date.now()}`,
        createdAt: now(),
        ...record
      };

      const files = getFilesLocal();
      files.unshift(fileRecord);
      saveFilesLocal(files);

      const jobs = getJobsLocal();
      const index = jobs.findIndex((item) => item.jobId === String(record.jobId));
      if (index !== -1) {
        jobs[index] = {
          ...jobs[index],
          files: [...(jobs[index].files || []), fileRecord],
          updatedAt: now()
        };
        saveJobsLocal(jobs);
      }

      return fileRecord;
    }
  );
}

export async function listTransactions() {
  return withFallback(() => request("/transactions"), () => getTransactionsLocal().sort(sortNewest));
}

export async function addTransactionRecord(record) {
  return withFallback(
    () =>
      request("/transactions", {
        method: "POST",
        body: JSON.stringify(record)
      }),
    () => {
      const nextRecord = {
        id: `tx-${Date.now()}`,
        createdAt: now(),
        ...record
      };
      const rows = getTransactionsLocal();
      rows.unshift(nextRecord);
      saveTransactionsLocal(rows);
      return nextRecord;
    }
  );
}

export async function listMessages() {
  return withFallback(() => request("/messages"), () => getMessagesLocal().sort(sortOldest));
}

export async function sendMessage(jobId, message) {
  return withFallback(
    () =>
      request(`/jobs/${jobId}/messages`, {
        method: "POST",
        body: JSON.stringify(message)
      }),
    () => {
      const nextMessage = {
        id: `msg-${Date.now()}`,
        jobId: String(jobId),
        createdAt: now(),
        ...message
      };
      const rows = getMessagesLocal();
      rows.push(nextMessage);
      saveMessagesLocal(rows);
      return nextMessage;
    }
  );
}

export async function sendPaymentConfirmationEmail(jobId) {
  return withFallback(
    () =>
      request(`/jobs/${jobId}/payment-confirmation-email`, {
        method: "POST"
      }),
    () => ({
      id: `email-${Date.now()}`,
      jobId: String(jobId),
      status: "logged",
      createdAt: now(),
      note: "Backend email server is unavailable. No live email was sent."
    })
  );
}

export async function sendClientReceiptEmail(jobId) {
  return withFallback(
    () =>
      request(`/jobs/${jobId}/client-receipt-email`, {
        method: "POST"
      }),
    () => ({
      id: `receipt-${Date.now()}`,
      jobId: String(jobId),
      status: "logged",
      createdAt: now(),
      note: "Backend receipt email server is unavailable. No live email was sent."
    })
  );
}

export async function getBackendHealth() {
  return request("/health");
}

export function listFileRecordsByOwner(ownerWallet) {
  const walletLower = String(ownerWallet || "").toLowerCase();
  return getFilesLocal()
    .filter((item) => String(item.ownerWallet || "").toLowerCase() === walletLower)
    .sort(sortNewest);
}

function sortNewest(a, b) {
  return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
}

function sortOldest(a, b) {
  return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
}
