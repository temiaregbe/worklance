import { ethers } from "ethers";

export function getEthereumProvider() {
  if (typeof window === "undefined" || !window.ethereum) {
    return null;
  }

  if (Array.isArray(window.ethereum.providers)) {
    return (
      window.ethereum.providers.find((provider) => provider.isMetaMask) ||
      window.ethereum.providers[0]
    );
  }

  return window.ethereum;
}

export async function connectWallet() {
  const ethereum = getEthereumProvider();

  if (!ethereum) {
    throw new Error("Install MetaMask to connect your wallet.");
  }

  if (ethereum.request) {
    await ethereum.request({
      method: "eth_requestAccounts"
    });
  }

  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();

  return {
    provider,
    signer,
    address: await signer.getAddress(),
    network: await provider.getNetwork()
  };
}

export async function disconnectWalletSession() {
  const ethereum = getEthereumProvider();

  if (!ethereum?.request) {
    return;
  }

  try {
    await ethereum.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }]
    });
  } catch {
    // MetaMask may not allow revoking in all environments; the app still clears
    // its own local session state on disconnect.
  }
}
