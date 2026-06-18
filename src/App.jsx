import { useEffect, useState } from "react";
import { BrowserProvider, formatEther, parseEther } from "ethers";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  approveJobWork,
  contractAddress,
  fundJob,
  getContract,
  getReadContract,
  jobStates
} from "./contract";
import {
  connectWallet as connectMetaMaskWallet,
  disconnectWalletSession,
  getEthereumProvider
} from "./utils/wallet";
import { ClientDashboardPage } from "./pages/ClientDashboardPage";
import { FreelancerDashboardPage } from "./pages/FreelancerDashboardPage";
import { LandingPage } from "./pages/LandingPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AccessPage } from "./pages/AccessPage";
import {
  addTransactionRecord,
  attachSmartContract as attachSmartContractRecord,
  createListing as createListingRecord,
  getCurrentUser,
  listJobs,
  listMessages,
  listTransactions,
  loginUser,
  logoutUser,
  registerUser,
  sendClientReceiptEmail as sendClientReceiptEmailRecord,
  sendPaymentConfirmationEmail as sendPaymentConfirmationEmailRecord,
  saveFileRecord as saveFileRecordLocal,
  saveProfile,
  sendMessage as sendMessageRecord,
  selectFreelancerProposal,
  submitProposal as submitProposalRecord,
  syncLocalUsersToBackend,
  updateListing,
  updateProposal as updateProposalRecord
} from "./utils/platformStore";
import { uploadJobFile, uploadProfileCv } from "./utils/storageApi";
import { normalizeEthAmount } from "./utils/currency";

const DISCONNECTED_WALLET_KEY = "worklance_wallet_disconnected";
const EXPECTED_CHAIN_ID = 11155111n;
const EXPECTED_NETWORK_NAME = "Sepolia";
const EXPECTED_CHAIN_HEX = "0xaa36a7";
const PLATFORM_REFRESH_INTERVAL_MS = 2500;

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [account, setAccount] = useState("");
  const [networkName, setNetworkName] = useState("");
  const [status, setStatus] = useState("Connect your wallet to begin.");
  const [provider, setProvider] = useState(null);
  const [signerContract, setSignerContract] = useState(null);
  const [readContract, setReadContract] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [jobs, setJobs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const ethereum = getEthereumProvider();

    if (!ethereum) {
      setStatus("Install MetaMask or another EVM wallet to use this dApp.");
      return;
    }

    const ethProvider = new BrowserProvider(ethereum);
    setProvider(ethProvider);
    void getReadContract()
      .then((contract) => setReadContract(contract))
      .catch((error) => setStatus(getErrorMessage(error)));

    function handleAccountsChanged(accounts) {
      if (!accounts || accounts.length === 0) {
        setAccount("");
        setSignerContract(null);
        setNetworkName("");
        logoutUser();
        setCurrentUser(null);
        localStorage.removeItem("user");
        setStatus("Wallet disconnected. Connect your wallet to continue.");
        return;
      }

      const nextAddress = String(accounts[0] || "");
      setAccount(nextAddress);
      localStorage.setItem("user", nextAddress);
      setStatus("MetaMask wallet changed. Use the connected wallet for this session.");
    }

    function handleChainChanged() {
      window.location.reload();
    }
    ethereum.on?.("accountsChanged", handleAccountsChanged);
    ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      if (!ethereum?.removeListener) {
        return;
      }

      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  async function connectWallet() {
    try {
      localStorage.removeItem(DISCONNECTED_WALLET_KEY);
      let { provider: walletProvider, address, network } = await connectMetaMaskWallet();
      if (network.chainId !== EXPECTED_CHAIN_ID) {
        setStatus(`Switching MetaMask to ${EXPECTED_NETWORK_NAME}...`);
        await ensureSepoliaNetwork();
        const nextConnection = await connectMetaMaskWallet();
        walletProvider = nextConnection.provider;
        address = nextConnection.address;
        network = nextConnection.network;
      }
      const contract = await getContract();

      console.log("Connected:", address);

      setProvider(walletProvider);
      setSignerContract(contract);
      setReadContract(await getReadContract());
      setAccount(address);
      setNetworkName(network.name);
      localStorage.setItem("user", address);
      setStatus("Wallet connected. Choose your client or freelancer workspace.");
      return { address, networkName: network.name, connected: true };
    } catch (error) {
      setStatus(getErrorMessage(error));
      return null;
    }
  }

  useEffect(() => {
    void refreshPlatformData();
  }, []);

  useEffect(() => {
    const refreshTimer = window.setInterval(() => {
      void refreshPlatformData({ silent: true });
    }, PLATFORM_REFRESH_INTERVAL_MS);

    function handleWindowFocus() {
      void refreshPlatformData({ silent: true });
    }

    function handleVisibilityChange() {
      if (!document.hidden) {
        void refreshPlatformData({ silent: true });
      }
    }

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    setIsSettingsOpen(false);
  }, [location.pathname]);

  async function refreshPlatformData(options = {}) {
    const { silent = false } = options;

    try {
      setCurrentUser(getCurrentUser());
      if (!silent) {
        await syncLocalUsersToBackend().catch(() => null);
      }
      const [nextJobs, nextMessages, nextTransactions] = await Promise.all([
        listJobs(),
        listMessages(),
        listTransactions()
      ]);
      setJobs(nextJobs);
      setMessages(nextMessages);
      setTransactions(nextTransactions);
    } catch (error) {
      if (!silent) {
        setStatus(getErrorMessage(error));
      }
    }
  }

  async function ensureSepoliaNetwork() {
    const ethereum = getEthereumProvider();

    if (!ethereum?.request) {
      throw new Error("Install MetaMask to connect your wallet.");
    }

    const currentChainId = await ethereum.request({ method: "eth_chainId" });
    if (String(currentChainId).toLowerCase() === EXPECTED_CHAIN_HEX) {
      return;
    }

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: EXPECTED_CHAIN_HEX }]
      });
    } catch (error) {
      if (error?.code === 4902) {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: EXPECTED_CHAIN_HEX,
              chainName: "Sepolia",
              nativeCurrency: {
                name: "Sepolia Ether",
                symbol: "SepoliaETH",
                decimals: 18
              },
              rpcUrls: ["https://rpc.sepolia.org"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"]
            }
          ]
        });
        return;
      }

      throw new Error(`Switch MetaMask to ${EXPECTED_NETWORK_NAME} before continuing.`);
    }
  }

  async function ensureSignerContract() {
    if (signerContract) {
      return signerContract;
    }

    const ethereum = getEthereumProvider();

    if (!ethereum) {
      throw new Error("Install MetaMask to connect your wallet.");
    }

    const accounts = await ethereum.request({ method: "eth_accounts" });
    if (!accounts || accounts.length === 0) {
      throw new Error("Connect MetaMask on Sepolia before continuing.");
    }

    await ensureSepoliaNetwork();

    const nextProvider = new BrowserProvider(ethereum);
    const network = await nextProvider.getNetwork();
    if (network.chainId !== EXPECTED_CHAIN_ID) {
      throw new Error(`Switch MetaMask to ${EXPECTED_NETWORK_NAME} before continuing.`);
    }

    const contract = await getContract();
    setProvider(nextProvider);
    setSignerContract(contract);
    setAccount(String(accounts[0] || ""));
    setNetworkName(network.name);
    return contract;
  }

  async function handleRegisterProfile(profile) {
    try {
      let activeWallet = account;

      if (!activeWallet) {
        setStatus("Connect the MetaMask wallet you want to use before registering.");
        return false;
      }

      let cvUploadFields = currentUser
        ? {
            cvUploadId: currentUser.cvUploadId || "",
            cvFileName: currentUser.cvFileName || "",
            cvMimeType: currentUser.cvMimeType || "",
            cvDataUrl: currentUser.cvDataUrl || ""
          }
        : {};

      if (profile.cvFile instanceof File) {
        const cvRecord = await uploadProfileCv(activeWallet, profile.cvFile);

        cvUploadFields = {
          cvUploadId: cvRecord.id,
          cvFileName: cvRecord.fileName,
          cvMimeType: cvRecord.mimeType,
          cvCid: cvRecord.cid,
          cvGatewayUrl: cvRecord.gatewayUrl,
          cvDataUrl: cvRecord.dataUrl || ""
        };
      }

      const { cvFile, ...profileFields } = profile;
      const nextUser = await (currentUser
        ? saveProfile(currentUser.profileId || activeWallet, { ...profileFields, ...cvUploadFields })
        : registerUser({ wallet: activeWallet, ...profileFields, ...cvUploadFields }));

      await addTransactionRecord({
        type: currentUser ? "Profile Updated" : "User Registered",
        description: `${nextUser.name} updated account profile`,
        actor: activeWallet
      });
      await refreshPlatformData();
      setStatus("Profile saved successfully.");
      navigate(nextUser.role === "freelancer" ? "/freelancer" : "/client");
      return true;
    } catch (error) {
      setStatus(getErrorMessage(error));
      return false;
    }
  }

  async function handleLoginProfile(credentials) {
    try {
      const wallet = credentials?.wallet?.trim() || account;
      const username = credentials?.username?.trim();

      if (!wallet) {
        setStatus("Enter the wallet address used during registration.");
        return false;
      }

      if (!account) {
        setStatus("Connect the correct MetaMask wallet before signing in.");
        return false;
      }

      if (account.toLowerCase() !== wallet.toLowerCase()) {
        setStatus("The wallet entered does not match the currently connected MetaMask wallet.");
        return false;
      }

      const user = await loginUser(wallet, username);

      await addTransactionRecord({
        type: "User Login",
        description: `${user.name} authenticated with wallet`,
        actor: wallet
      });
      await refreshPlatformData();
      setAccount(wallet);
      setStatus(`Logged in as ${user.name}.`);
      navigate(user.role === "freelancer" ? "/freelancer" : "/client");
      return true;
    } catch (error) {
      setStatus(getErrorMessage(error));
      return false;
    }
  }

  function handleLogout() {
    logoutUser();
    setCurrentUser(null);
    setIsSettingsOpen(false);
    setStatus("Signed out. Sign in again to access a workspace.");
  }

  async function disconnectWallet() {
    await disconnectWalletSession();
    localStorage.setItem(DISCONNECTED_WALLET_KEY, "true");
    localStorage.removeItem("user");
    logoutUser();
    setAccount("");
    setNetworkName("");
    setProvider(null);
    setSignerContract(null);
    setReadContract(null);
    setCurrentUser(null);
    setIsSettingsOpen(false);
    setStatus("Wallet disconnected for this demo. Click Connect Wallet to start again.");
  }

  async function runTransaction(action, pendingMessage, successMessage) {
    try {
      await ensureSepoliaNetwork();
      const activeContract = await ensureSignerContract();
      const activeProvider = new BrowserProvider(getEthereumProvider());
      const network = await activeProvider.getNetwork();
      if (network.chainId !== EXPECTED_CHAIN_ID) {
        setStatus(`Switch MetaMask to ${EXPECTED_NETWORK_NAME} before continuing. Detected: ${network.name} (${network.chainId.toString()}).`);
        return false;
      }
      setIsBusy(true);
      setStatus(pendingMessage);
      const tx = await action(activeContract);
      await tx.wait();
      setStatus(successMessage);
      return true;
    } catch (error) {
      setStatus(getErrorMessage(error));
      return false;
    } finally {
      setIsBusy(false);
    }
  }

  function isContractConfigured() {
    return (
      Boolean(contractAddress) &&
      contractAddress !== "0xYourDeployedContractAddress"
    );
  }

  function buildLocalJobDetails(jobId) {
    const localJob = jobs.find((item) => String(item.jobId) === String(jobId));
    if (!localJob) {
      throw new Error("No job record found for this ID.");
    }

    let state = 0;
    if (localJob.status === "Escrow Funded") {
      state = 2;
    } else if (localJob.status === "Freelancer Assigned") {
      state = 2;
    } else if (localJob.status === "Work Submitted") {
      state = 3;
    } else if (localJob.status === "Completed") {
      state = 4;
    } else if (localJob.status === "Cancelled") {
      state = 5;
    } else if (localJob.status === "Smart Contract Created") {
      state = 1;
    }

    return {
      jobId: String(localJob.jobId),
      description: localJob.description || "",
      paymentAmount: parseEther(String(localJob.paymentAmountEth || "0")),
      paymentEth: String(localJob.paymentAmountEth || "0"),
      client: localJob.clientWallet || account || "",
      freelancer:
        localJob.selectedFreelancer ||
        localJob.freelancerWallet ||
        "",
      workSubmission: localJob.submission || "",
      deliveryLinks: localJob.deliveryLinks || [],
      files: localJob.files || [],
      title: localJob.title || "",
      localStatus: localJob.status || "",
      state,
      exists: true
    };
  }

  function resolveJobPaymentEth(job) {
    if (!job) {
      return "0";
    }

    if (job.agreedProposalAmountEth) {
      return String(job.agreedProposalAmountEth);
    }

    const selectedProposal = (job.proposals || []).find(
      (proposal) => proposal.id === job.selectedProposalId
    );

    if (selectedProposal?.negotiationStatus === "accepted" && selectedProposal.counterAmountEth) {
      return String(selectedProposal.counterAmountEth);
    }

    if (selectedProposal?.bidAmountEth) {
      return String(selectedProposal.bidAmountEth);
    }

    return String(job.paymentAmountEth || "0");
  }

  async function fetchJob(jobId) {
    if (!isContractConfigured()) {
      return buildLocalJobDetails(jobId);
    }

    try {
      const contractReader = readContract || await getReadContract();
      if (!readContract) {
        setReadContract(contractReader);
      }
      const job = await contractReader.getJob(BigInt(jobId));
      const localJob = jobs.find((item) => String(item.jobId) === String(jobId));
      return {
        jobId: job.jobId.toString(),
        description: job.description,
        paymentAmount: job.paymentAmount,
        paymentEth: formatEther(job.paymentAmount),
        client: job.client,
        freelancer: job.freelancer,
        workSubmission: job.workSubmission,
        deliveryLinks: localJob?.deliveryLinks || [],
        files: localJob?.files || [],
        title: localJob?.title || "",
        localStatus: localJob?.status || "",
        state: Number(job.state),
        exists: job.exists
      };
    } catch (error) {
      throw error;
    }
  }

  async function createJob({ jobId, description, paymentAmount }) {
    const success = await runTransaction(
      (contract) => contract.createJob(BigInt(jobId), description, parseEther(paymentAmount)),
      "Creating job on-chain...",
      `Job #${jobId} created successfully.`
    );
    if (success) {
      try {
        await updateListing(String(jobId), (job) => ({
          ...job,
          onChainJobId: String(jobId),
          onChainVerified: true,
          status: "On-Chain Job Created"
        }));
      } catch {
        // Allow contract-first creation flows to succeed before the local/API
        // listing record exists; the caller can create the listing afterward.
      }
      await addTransactionRecord({
        type: "Smart Contract Creation",
        description: `On-chain escrow contract prepared for job #${jobId}`,
        actor: account,
        jobId
      });
      await refreshPlatformData();
    }
    return success;
  }

  async function assignFreelancer({ jobId, freelancer }) {
    if (!jobId || !freelancer) {
      const message = "Select a freelancer first so the job ID and wallet address are filled.";
      setStatus(message);
      return { success: false, message };
    }

    try {
      await ensureSignerContract();
    } catch (error) {
      const message = getErrorMessage(error);
      setStatus(message);
      return { success: false, message };
    }

    try {
      const contractReader = await getReadContract();
      const onChainJob = await contractReader.getJob(BigInt(jobId));
      const onChainClient = String(onChainJob.client || "").toLowerCase();
      const activeAccount = String(account || "").toLowerCase();
      const assignedFreelancer = String(onChainJob.freelancer || "");
      const onChainState = Number(onChainJob.state);

      if (!onChainJob.exists) {
        const message = "This job was not found on the deployed contract. Publish a fresh job before assigning a freelancer.";
        setStatus(message);
        return { success: false, message };
      }

      if (onChainClient && activeAccount && onChainClient !== activeAccount) {
        const message = "Only the client wallet that created this on-chain job can assign the freelancer.";
        setStatus(message);
        return { success: false, message };
      }

      if (assignedFreelancer && assignedFreelancer !== "0x0000000000000000000000000000000000000000") {
        const message = "A freelancer has already been assigned to this job on-chain.";
        setStatus(message);
        return { success: false, message };
      }

      if (![0, 1].includes(onChainState)) {
        const stateLabel = jobStates[onChainState] || `State ${onChainState}`;
        const message = `This job cannot be assigned right now because it is already in ${stateLabel}.`;
        setStatus(message);
        return { success: false, message };
      }
    } catch (error) {
      const message =
        getErrorMessage(error) ||
        "This job could not be verified on the deployed contract. Publish a fresh job and try again.";
      setStatus(message);
      return { success: false, message };
    }

    const success = await runTransaction(
      (contract) => contract.assignFreelancer(BigInt(jobId), freelancer),
      `Assigning freelancer to job #${jobId}...`,
      `Freelancer assigned to job #${jobId}.`
    );
    if (success) {
      await updateListing(String(jobId), (job) => ({
        ...job,
        selectedFreelancer: freelancer,
        status: "Freelancer Assigned"
      }));
      await addTransactionRecord({
        type: "Freelancer Selection",
        description: `Freelancer ${freelancer} assigned to job #${jobId}`,
        actor: account,
        jobId
      });
      await refreshPlatformData();
      return { success: true, message: `Freelancer assigned to job #${jobId}.` };
    }
    return {
      success: false,
      message: "Assignment failed. Make sure this is a fresh on-chain job, you are using the client wallet, and MetaMask is on Sepolia."
    };
  }

  async function depositPayment(jobId, paymentAmount) {
    try {
      setIsBusy(true);
      setStatus(`Funding escrow for job #${jobId}...`);
      let paymentEth = typeof paymentAmount === "string" ? paymentAmount : formatEther(paymentAmount);

      try {
        const contractReader = await getReadContract();
        const onChainJob = await contractReader.getJob(BigInt(jobId));
        if (onChainJob?.exists) {
          paymentEth = formatEther(onChainJob.paymentAmount);
        }
      } catch {
        const localJob = jobs.find(
          (job) =>
            String(job.jobId) === String(jobId) ||
            String(job.onChainJobId || "") === String(jobId)
        );
        paymentEth = resolveJobPaymentEth(localJob) || paymentEth;
      }

      if (!Number.isFinite(Number(paymentEth)) || Number(paymentEth) <= 0) {
        throw new Error("Escrow amount is missing. Select an accepted proposal and assign the freelancer before funding.");
      }

      await fundJob(BigInt(jobId), paymentEth);
      await updateListing(String(jobId), (job) => ({
        ...job,
        paymentAmountEth: paymentEth,
        status: "Escrow Funded"
      }));
      setStatus(`Escrow funded for job #${jobId}.`);
      await addTransactionRecord({
        type: "Escrow Funded",
        description: `Funds locked in escrow for job #${jobId}`,
        actor: account,
        jobId
      });
      await refreshPlatformData();
      return true;
    } catch (error) {
      setStatus(getErrorMessage(error));
      return false;
    } finally {
      setIsBusy(false);
    }
  }

  async function submitWork({ jobId, submission, links = "", files = [] }) {
    try {
      await ensureSepoliaNetwork();
      const accounts = await getEthereumProvider()?.request?.({ method: "eth_accounts" });
      const contractReader = await getReadContract();
      const onChainJob = await contractReader.getJob(BigInt(jobId));
      const activeAccount = String(accounts?.[0] || account || "").toLowerCase();
      const assignedFreelancer = String(onChainJob.freelancer || "").toLowerCase();
      const onChainState = Number(onChainJob.state);

      if (!onChainJob.exists) {
        throw new Error("This job was not found on the deployed contract.");
      }

      if (!assignedFreelancer || assignedFreelancer === "0x0000000000000000000000000000000000000000") {
        throw new Error("No freelancer has been assigned to this job on-chain yet.");
      }

      if (assignedFreelancer !== activeAccount) {
        throw new Error("Only the freelancer assigned on-chain can submit work for this job.");
      }

      if (onChainState !== 2) {
        const stateLabel = jobStates[onChainState] || `State ${onChainState}`;
        throw new Error(`This job is currently in ${stateLabel}. Work can only be submitted when the job is In Progress.`);
      }
    } catch (error) {
      setStatus(getErrorMessage(error));
      return false;
    }

    const cleanedLinks = String(links || "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

    const finalSubmission = [submission.trim(), ...cleanedLinks].filter(Boolean).join("\n");

    for (const file of files) {
      const uploadRecord = await uploadJobFile({
        ownerWallet: account,
        jobId,
        label: "Work Delivery File",
        file
      });

      await saveFileRecordLocal({
        jobId: String(jobId),
        label: "Work Delivery File",
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        ownerWallet: account,
        uploadId: uploadRecord.id,
        cid: uploadRecord.cid,
        gatewayUrl: uploadRecord.gatewayUrl
      });
    }

    const success = await runTransaction(
      (contract) => contract.submitWork(BigInt(jobId), finalSubmission),
      `Submitting work for job #${jobId}...`,
      `Work submitted for job #${jobId}.`
    );
    if (success) {
      await updateListing(String(jobId), (job) => ({
        ...job,
        deliveryLinks: cleanedLinks,
        status: "Work Submitted"
      }));
      await addTransactionRecord({
        type: "Work Submission",
        description: `Work submitted for job #${jobId}`,
        actor: account,
        jobId
      });
      await refreshPlatformData();
    }
    if (success) {
      return true;
    }
    return false;
  }

  async function approveWork(jobId) {
    try {
      setIsBusy(true);
      setStatus(`Approving job #${jobId} and releasing payment...`);
      await approveJobWork(BigInt(jobId));
      await updateListing(String(jobId), (job) => ({
        ...job,
        status: "Completed"
      }));
      setStatus(`Job #${jobId} approved and paid out.`);
      await addTransactionRecord({
        type: "Automated Payment Release",
        description: `Client approved job #${jobId} and payment was released`,
        actor: account,
        jobId
      });
      try {
        await sendPaymentConfirmationEmailRecord(jobId);
      } catch {
        // Keep the payment release successful even if the email service is unavailable.
      }
      try {
        const receiptResult = await sendClientReceiptEmailRecord(jobId);
        await addTransactionRecord({
          type: "Client Receipt",
          description:
            receiptResult?.status === "sent"
              ? `Receipt emailed to client on job #${jobId}`
              : `Receipt generated for client on job #${jobId}, but live email is not configured`,
          actor: account,
          jobId
        });
        if (receiptResult?.status !== "sent") {
          setStatus(`Job #${jobId} approved and paid out. Receipt was generated, but email is not configured on the server.`);
        }
      } catch (error) {
        setStatus(`Job #${jobId} approved and paid out. Receipt could not be sent: ${getErrorMessage(error)}`);
      }
      await refreshPlatformData();
      return true;
    } catch (error) {
      setStatus(getErrorMessage(error));
      return false;
    } finally {
      setIsBusy(false);
    }
  }

  async function rejectWork(jobId) {
    const success = await runTransaction(
      (contract) => contract.rejectWork(BigInt(jobId)),
      `Rejecting submission for job #${jobId}...`,
      `Submission rejected for job #${jobId}.`
    );
    if (success) {
      await updateListing(String(jobId), (job) => ({
        ...job,
        status: "In Progress"
      }));
      await addTransactionRecord({
        type: "Work Review",
        description: `Submission rejected for job #${jobId}`,
        actor: account,
        jobId
      });
      await refreshPlatformData();
    }
    return success;
  }

  async function cancelJob(jobId) {
    const success = await runTransaction(
      (contract) => contract.cancelJob(BigInt(jobId)),
      `Cancelling job #${jobId}...`,
      `Job #${jobId} cancelled successfully.`
    );
    if (success) {
      await updateListing(String(jobId), (job) => ({
        ...job,
        status: "Cancelled"
      }));
      await addTransactionRecord({
        type: "Job Cancelled",
        description: `Job #${jobId} was cancelled`,
        actor: account,
        jobId
      });
      await refreshPlatformData();
    }
    return success;
  }

  async function createListing(job) {
    const record = await createListingRecord({
      ...job,
      clientProfileId: currentUser?.profileId || "",
      clientName: currentUser?.name || job.clientName,
      clientUsername: currentUser?.username || job.clientUsername || ""
    });
    await addTransactionRecord({
      type: "Job Posting",
      description: `Listing published for job #${job.jobId}`,
      actor: account,
      jobId: job.jobId
    });
    await refreshPlatformData();
    return record;
  }

  async function editListing(jobId, updates) {
    const record = await updateListing(String(jobId), (job) => ({
      ...job,
      ...updates
    }));
    await addTransactionRecord({
      type: "Job Listing Updated",
      description: `Listing updated for job #${jobId}`,
      actor: account,
      jobId
    });
    await refreshPlatformData();
    return record;
  }

  async function submitProposal(jobId, proposal) {
    const portfolioUpload =
      proposal.portfolioFile instanceof File
        ? await uploadJobFile({
            ownerWallet: account,
            jobId,
            label: "Proposal Portfolio",
            file: proposal.portfolioFile
          })
        : null;

    const cvUpload =
      proposal.cvFile instanceof File
        ? await uploadJobFile({
            ownerWallet: account,
            jobId,
            label: "Proposal CV",
            file: proposal.cvFile
          })
        : null;

    const { portfolioFile, cvFile, ...proposalFields } = proposal;

    const record = await submitProposalRecord(jobId, {
      ...proposalFields,
      bidAmountValue: proposalFields.bidAmount,
      bidCurrency: proposalFields.bidCurrency || "ETH",
      bidAmountEth: normalizeEthAmount(proposalFields.bidAmount, proposalFields.bidCurrency || "ETH"),
      freelancerProfileId: currentUser?.profileId || "",
      freelancerName: currentUser?.name || proposalFields.freelancerName,
      freelancerUsername: currentUser?.username || proposalFields.freelancerUsername || "",
      portfolioUrl: proposalFields.portfolioMode === "url" ? proposalFields.portfolioUrl : "",
      portfolioFileName: portfolioUpload?.fileName || "",
      portfolioUploadId: portfolioUpload?.id || "",
      portfolioCid: portfolioUpload?.cid || "",
      portfolioGatewayUrl: portfolioUpload?.gatewayUrl || "",
      portfolioDataUrl: portfolioUpload?.dataUrl || "",
      cvFileName: cvUpload?.fileName || "",
      cvUploadId: cvUpload?.id || "",
      cvCid: cvUpload?.cid || "",
      cvGatewayUrl: cvUpload?.gatewayUrl || "",
      cvDataUrl: cvUpload?.dataUrl || "",
      profileCvFileName: currentUser?.cvFileName || "",
      profileCvGatewayUrl: currentUser?.cvGatewayUrl || "",
      profileCvDataUrl: currentUser?.cvDataUrl || "",
      profileCvUploadId: currentUser?.cvUploadId || ""
    });
    await addTransactionRecord({
      type: "Proposal Submission",
      description: `Proposal submitted for job #${jobId}`,
      actor: account,
      jobId
    });
    await refreshPlatformData();
    return record;
  }

  async function selectProposal(jobId, proposalId) {
    const record = await selectFreelancerProposal(jobId, proposalId);
    await addTransactionRecord({
      type: "Freelancer Selection",
      description: `Client selected a freelancer for job #${jobId}`,
      actor: account,
      jobId
    });
    await refreshPlatformData();
    return record;
  }

  async function updateProposalOffer(jobId, proposalId, updates) {
    const record = await updateProposalRecord(jobId, proposalId, updates);
    await addTransactionRecord({
      type: "Counter Offer",
      description: `Client updated the proposed amount for job #${jobId}`,
      actor: account,
      jobId
    });
    await refreshPlatformData();
    return record;
  }

  async function respondToCounterOffer(jobId, proposalId, response) {
    const currentJob = jobs.find((job) => String(job.jobId) === String(jobId));
    const proposal = (currentJob?.proposals || []).find((item) => item.id === proposalId);
    const accepted = response === "accepted";
    const updates = {
      negotiationStatus: accepted ? "accepted" : "declined",
      counterRespondedAt: new Date().toISOString()
    };

    if (accepted && proposal) {
      updates.bidAmount = proposal.counterAmountValue || proposal.bidAmount;
      updates.bidAmountValue = proposal.counterAmountValue || proposal.bidAmountValue;
      updates.bidCurrency = proposal.counterCurrency || proposal.bidCurrency;
      updates.bidAmountEth = proposal.counterAmountEth || proposal.bidAmountEth;
    }

    const record = await updateProposalRecord(jobId, proposalId, updates);
    await addTransactionRecord({
      type: accepted ? "Counter Offer Accepted" : "Counter Offer Declined",
      description: `Freelancer ${accepted ? "accepted" : "declined"} the counter offer for job #${jobId}`,
      actor: account,
      jobId
    });
    await refreshPlatformData();
    return record;
  }

  async function attachSmartContract(jobId, smartContract) {
    const record = await attachSmartContractRecord(jobId, smartContract);
    await addTransactionRecord({
      type: "Smart Contract Creation",
      description: `Project agreement generated for job #${jobId}`,
      actor: account,
      jobId
    });
    await refreshPlatformData();
    return record;
  }

  async function saveFileRecord(record) {
    const uploadRecord = await uploadJobFile({
      ownerWallet: account,
      jobId: record.jobId,
      label: record.label,
      file: record.file
    });

    const result = await saveFileRecordLocal({
      ...record,
      uploadId: uploadRecord.id,
      cid: uploadRecord.cid,
      gatewayUrl: uploadRecord.gatewayUrl
    });
    await addTransactionRecord({
      type: "File Upload",
      description: `${record.label || record.fileName} uploaded for job #${record.jobId}`,
      actor: account,
      jobId: record.jobId
    });
    await refreshPlatformData();
    return result;
  }

  async function sendChatMessage(jobId, message) {
    const result = await sendMessageRecord(jobId, message);
    await addTransactionRecord({
      type: "Chat Message",
      description: `New message sent for job #${jobId}`,
      actor: account,
      jobId
    });
    await refreshPlatformData();
    return result;
  }

  async function sendPaymentConfirmation(jobId) {
    try {
      const job = jobs.find((item) => String(item.jobId) === String(jobId));
      const result = await sendPaymentConfirmationEmailRecord(jobId);
      downloadReceiptFile({
        job,
        type: "Freelancer Payment Confirmation",
        recipient: currentUser?.name || job?.selectedFreelancerName || "Freelancer"
      });
      await addTransactionRecord({
        type: "Payment Confirmation",
        description:
          result.status === "sent"
            ? `Payment confirmation emailed for job #${jobId}`
            : `Payment confirmation generated for job #${jobId}, but live email is not configured`,
        actor: account,
        jobId
      });
      setStatus(
        result.status === "sent"
          ? `Payment confirmation email sent for job #${jobId}.`
          : `Payment confirmation recorded for job #${jobId}, but live email is not configured on the server yet.`
      );
      await refreshPlatformData();
      return result;
    } catch (error) {
      setStatus(getErrorMessage(error));
      const job = jobs.find((item) => String(item.jobId) === String(jobId));
      if (job) {
        downloadReceiptFile({
          job,
          type: "Freelancer Payment Confirmation",
          recipient: currentUser?.name || job.selectedFreelancerName || "Freelancer"
        });
        setStatus(`Receipt downloaded for job #${jobId}. Backend email/database is unavailable.`);
      }
      return null;
    }
  }

  async function sendClientReceipt(jobId) {
    try {
      const job = jobs.find((item) => String(item.jobId) === String(jobId));
      const result = await sendClientReceiptEmailRecord(jobId);
      downloadReceiptFile({
        job,
        type: "Client Payment Receipt",
        recipient: job?.clientName || currentUser?.name || "Client"
      });
      await addTransactionRecord({
        type: "Client Receipt",
        description:
          result.status === "sent"
            ? `Receipt emailed to client for job #${jobId}`
            : `Receipt generated for client on job #${jobId}, but live email is not configured`,
        actor: account,
        jobId
      });
      setStatus(
        result.status === "sent"
          ? `Client receipt sent for job #${jobId}.`
          : `Client receipt generated for job #${jobId}, but live email is not configured on the server yet.`
      );
      await refreshPlatformData();
      return result;
    } catch (error) {
      setStatus(getErrorMessage(error));
      const job = jobs.find((item) => String(item.jobId) === String(jobId));
      if (job) {
        downloadReceiptFile({
          job,
          type: "Client Payment Receipt",
          recipient: job.clientName || currentUser?.name || "Client"
        });
        setStatus(`Receipt downloaded for job #${jobId}. Backend email/database is unavailable.`);
      }
      return null;
    }
  }

  const appContext = {
    account,
    contractAddress,
    currentUser,
    jobs,
    messages,
    transactions,
    isBusy,
    networkName,
    status,
    connectWallet,
    disconnectWallet,
    onLogout: handleLogout,
    createListing,
    editListing,
    submitProposal,
    selectProposal,
    updateProposalOffer,
    respondToCounterOffer,
    attachSmartContract,
    saveFileRecord,
    sendChatMessage,
    fetchJob,
    onSaveProfile: handleRegisterProfile,
    sendPaymentConfirmation,
    sendClientReceipt,
    createJob,
    assignFreelancer,
    depositPayment,
    submitWork,
    approveWork,
    rejectWork,
    cancelJob
  };

  const canAccessApp = Boolean(account && currentUser);
  const isLandingPage = location.pathname === "/";
  const isWorkspacePage =
    location.pathname === "/client" || location.pathname === "/freelancer";
  const browseJobsHref = canAccessApp ? "/freelancer" : "/signin";

  return (
    <div
      className={
        isLandingPage
          ? "app-shell landing-mode"
          : isWorkspacePage
            ? "app-shell workspace-mode"
            : "app-shell"
      }
    >
      <div className="backdrop backdrop-left" />
      <div className="backdrop backdrop-right" />

      {!isWorkspacePage ? (
      <header className="topbar">
        <Link className="brand-lockup brand-lockup-simple" to="/">
          <span className="brand-mark brand-mark-simple">W</span>
          <span className="brand-title">WorkLance</span>
        </Link>

        <nav className="topbar-nav" aria-label="Primary">
          <NavLink to="/" className={({ isActive }) => (isActive ? "topbar-nav-link active" : "topbar-nav-link")}>
            Home
          </NavLink>
          <a className="topbar-nav-link" href="/#about">
            About
          </a>
          <Link className="topbar-nav-link" to={browseJobsHref}>
            Browse Jobs
          </Link>
        </nav>

        <div className="topbar-actions topbar-actions-clean">
          <Link className="primary-button topbar-cta compact-cta" to="/signup">
            Get Started
          </Link>
          <Link className="topbar-signin topbar-nowrap" to="/signin">
            Sign In
          </Link>
          <button
            className="settings-toggle"
            type="button"
            aria-label="Open account panel"
            aria-expanded={isSettingsOpen}
            onClick={() => setIsSettingsOpen((current) => !current)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>
      ) : null}

      {isSettingsOpen ? (
        <>
          <button
            aria-label="Close account panel"
            className="settings-panel-backdrop"
            type="button"
            onClick={() => setIsSettingsOpen(false)}
          />
          <aside className="settings-panel">
            <div className="settings-panel-head">
              <div>
                <p className="section-kicker">Account Panel</p>
                <h3>{currentUser?.name || "WorkLance Access"}</h3>
              </div>
              <button
                className="ghost-button settings-panel-close"
                type="button"
                onClick={() => setIsSettingsOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="settings-panel-body">
              <div className="settings-info-card">
                <span>Network</span>
                <strong>{networkName || "Not connected"}</strong>
              </div>
              <div className="settings-info-card">
                <span>Wallet</span>
                <strong>{account || "Connect your wallet to continue"}</strong>
              </div>

              <div className="settings-action-group">
                {!account ? (
                  <button className="primary-button" onClick={connectWallet} disabled={isBusy}>
                    Connect Wallet
                  </button>
                ) : (
                  <button className="ghost-button" type="button" onClick={disconnectWallet}>
                    Disconnect Wallet
                  </button>
                )}

                {currentUser ? (
                  <>
                    <Link className="ghost-button" to="/profile" onClick={() => setIsSettingsOpen(false)}>
                      Profile
                    </Link>
                    <button className="ghost-button" type="button" onClick={handleLogout}>
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link className="ghost-button" to="/signin" onClick={() => setIsSettingsOpen(false)}>
                      Sign In
                    </Link>
                    <Link className="ghost-button" to="/signup" onClick={() => setIsSettingsOpen(false)}>
                      Create Account
                    </Link>
                  </>
                )}
              </div>

            </div>
          </aside>
        </>
      ) : null}

      <Routes>
        <Route
          path="/"
          element={
            <LandingPage
              {...appContext}
              canAccessApp={canAccessApp}
            />
          }
        />
        <Route
          path="/signin"
          element={
            <AccessPage
              account={account}
              currentUser={currentUser}
              onRegister={handleRegisterProfile}
              onLogin={handleLoginProfile}
              onConnectWallet={connectWallet}
              isBusy={isBusy}
              status={status}
              mode="signin"
            />
          }
        />
        <Route
          path="/signup"
          element={
            <AccessPage
              account={account}
              currentUser={currentUser}
              onRegister={handleRegisterProfile}
              onLogin={handleLoginProfile}
              onConnectWallet={connectWallet}
              isBusy={isBusy}
              status={status}
              mode="signup"
            />
          }
        />
        <Route path="/access" element={<Navigate to="/signin" replace />} />
        <Route
          path="/client"
          element={
            <ProtectedWorkspaceRoute canAccessApp={canAccessApp} currentUser={currentUser} requiredRole="client">
              <ClientDashboardPage {...appContext} jobStates={jobStates} onOpenSettings={() => setIsSettingsOpen(true)} />
            </ProtectedWorkspaceRoute>
          }
        />
        <Route
          path="/freelancer"
          element={
            <ProtectedWorkspaceRoute canAccessApp={canAccessApp} currentUser={currentUser} requiredRole="freelancer">
              <FreelancerDashboardPage {...appContext} jobStates={jobStates} onOpenSettings={() => setIsSettingsOpen(true)} />
            </ProtectedWorkspaceRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedWorkspaceRoute canAccessApp={canAccessApp}>
              <ProfilePage account={account} currentUser={currentUser} />
            </ProtectedWorkspaceRoute>
          }
        />
        <Route path="/create" element={<Navigate to={canAccessApp ? "/client" : "/"} replace />} />
        <Route path="/manage" element={<Navigate to={canAccessApp ? "/client" : "/"} replace />} />
        <Route path="/search" element={<Navigate to={canAccessApp ? "/freelancer" : "/"} replace />} />
        <Route path="/submit" element={<Navigate to={canAccessApp ? "/freelancer" : "/"} replace />} />
      </Routes>
    </div>
  );
}

function ProtectedWorkspaceRoute({ canAccessApp, currentUser, requiredRole, children }) {
  if (!canAccessApp) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole && currentUser?.role !== requiredRole) {
    return <Navigate to={currentUser?.role === "freelancer" ? "/freelancer" : "/client"} replace />;
  }

  return children;
}

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function downloadReceiptFile({ job, type, recipient }) {
  if (!job) {
    return;
  }

  const issuedAt = new Date().toLocaleString();
  const receiptText = [
    "WorkLance Receipt",
    "=================",
    "",
    `Receipt Type: ${type}`,
    `Issued To: ${recipient || "User"}`,
    `Issued At: ${issuedAt}`,
    "",
    `Job Title: ${job.title || `Job #${job.jobId}`}`,
    `Job ID: ${job.jobId}`,
    `Status: ${job.status || "Completed"}`,
    `Amount: ${job.paymentAmountValue || job.agreedProposalAmountValue || job.paymentAmountEth || "0"} ${job.paymentCurrency || job.agreedProposalCurrency || "ETH"}`,
    `ETH Value: ${job.paymentAmountEth || job.agreedProposalAmountEth || "0"} ETH`,
    "",
    `Client: ${job.clientName || job.clientUsername || "Client"}`,
    `Client Wallet: ${job.clientWallet || "Not recorded"}`,
    `Freelancer: ${job.selectedFreelancerName || job.selectedFreelancerUsername || "Freelancer"}`,
    `Freelancer Wallet: ${job.selectedFreelancer || "Not recorded"}`,
    "",
    "Project Description:",
    job.description || "No description recorded.",
    "",
    "This receipt was generated by WorkLance for a completed marketplace transaction."
  ].join("\n");

  const blob = new Blob([receiptText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `WorkLance-Receipt-Job-${job.jobId}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getErrorMessage(error) {
  if (error?.info?.error?.message) {
    return error.info.error.message;
  }

  if (error?.shortMessage) {
    return error.shortMessage;
  }

  return error?.message || "Something went wrong while interacting with the contract.";
}

export default App;
