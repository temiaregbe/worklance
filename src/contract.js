import { ethers } from "ethers";
import abi from "./abi.json";
import { connectWallet, getEthereumProvider } from "./utils/wallet";

export const contractAddress =
  import.meta.env.VITE_CONTRACT_ADDRESS || "0xYourDeployedContractAddress";

function ensureContractAddressConfigured() {
  if (
    !contractAddress ||
    contractAddress === "0xYourDeployedContractAddress"
  ) {
    throw new Error("Set VITE_CONTRACT_ADDRESS in .env to your deployed smart contract address.");
  }
}

export async function getContract() {
  ensureContractAddressConfigured();
  const { signer } = await connectWallet();
  return new ethers.Contract(contractAddress, abi, signer);
}

export async function getReadContract() {
  ensureContractAddressConfigured();
  const ethereum = getEthereumProvider();

  if (!ethereum) {
    throw new Error("Install MetaMask to connect your wallet.");
  }

  const provider = new ethers.BrowserProvider(ethereum);
  return new ethers.Contract(contractAddress, abi, provider);
}

export async function fundJob(jobId, amount = "0.01") {
  const contract = await getContract();
  const tx = await contract.depositPayment(jobId, {
    value: ethers.parseEther(amount)
  });

  await tx.wait();
  window.alert("Funds locked in escrow");
}

export async function approveJobWork(jobId) {
  const contract = await getContract();
  const tx = await contract.approveWork(jobId);

  await tx.wait();
  window.alert("Payment released automatically");
}

export const jobStates = [
  "Created",
  "Funded",
  "In Progress",
  "Submitted",
  "Completed",
  "Cancelled"
];
