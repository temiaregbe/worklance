# Freelance Marketplace Frontend

This is a React.js frontend for the `FreelanceMarketplace.sol` smart contract with a small backend API for MongoDB and IPFS-backed records.

## Stack

- React
- Vite
- Ethers.js
- Express
- MongoDB
- IPFS HTTP API

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file from `.env.example` and set your deployed contract address plus frontend API URL:

```bash
VITE_CONTRACT_ADDRESS=0xYourDeployedContractAddress
VITE_API_BASE_URL=http://localhost:4000/api
```

3. Create a backend environment file from `.env.server.example`:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=worklance
IPFS_API_URL=http://127.0.0.1:5001/api/v0/add
IPFS_GATEWAY_BASE=https://ipfs.io/ipfs
PORT=4000
```

4. Start the backend API:

```bash
npm run server
```

5. Start the frontend:

```bash
npm run dev
```

## Features

- Connect an Ethereum wallet
- Create a job
- Assign a freelancer
- Deposit escrow funds
- Submit work
- Approve or reject work
- Cancel a job
- Fetch job details from the blockchain
- Store profiles, jobs, proposals, messages, and transactions in MongoDB
- Store uploaded CVs and job files in IPFS through the backend API

## Notes

- The frontend expects the contract to already be deployed.
- The connected wallet must use the correct network for the deployed contract.
- MongoDB and an IPFS API endpoint must be running before the backend can start.
