# On-Chain DAO Governance Protocol with Cryptographic Timelock

A highly secure, modular, and audit-ready **On-Chain DAO Governance & Timelock Vault** smart contract engine engineered using **Solidity v0.8.13+** and the **Hardhat** development environment. This protocol models the exact decentralized architecture used by premier DeFi primitives (such as Uniswap and Compound). It couples a fluid **ERC-20 Governance voting weight snapshot engine** with an asynchronous administrative **Timelock Executive Vault**, enforcing automated, non-custodial software execution workflows.

## 🚀 Key Features & Mechanism Design

- **Dynamic Multi-Parameter Proposal Payloads:** Proposers dynamically pass unique target payload parameters (`_targetRecipient` and `_requestedAmount`) at submission. Winning consensus routes custom allocations exactly as defined, offering fluid treasury flexibility.
- **Asynchronous Timelock Cooling-Off Window:** A secure administrative queue (`timelockQueue`) halts passed resolutions for a minimum safety delay window (`minDelay`). This allows minority holders to safely exit (rage-quit) the pool before major structural shifts take effect, mitigating malicious governance takeover attempts.
- **Anti-Spam Proposal Thresholding:** Enforces an updatable proposal entry stake (`proposalThreshold`) to block Sybil vectors. Addresses must actively hold sufficient voting weight before pushing code blocks to the consensus room.
- **Gas-Optimized State Tracking:** Leverages an explicit internal Finite State Machine (`enum ProposalStatus`) to cache live statuses. This replaces multiple expensive state variables with a unified state lookup, drastically reducing on-chain gas costs.

---

## 🛡️ Smart Contract Security Controls

### 1. Robust Double-Voting Isolation

Employs an optimized on-chain nested storage tracking register (`mapping(uint256 => mapping(address => bool)) public hasVoted`). Addresses flag their voting state _prior_ to parsing weights, permanently blocking duplicate balloting exploits within a single proposal ID window.

### 2. Strict Checks-Effects-Interactions (CEI) Compliance

Inside `executeProposal`, the status transitions (`Executed`) and condition flags (`proposal.executed = true;`) are permanently written to blockchain storage **before** triggering the low-level external ERC-20 `transfer` call. This architecture isolates code execution paths and natively prevents recursive reentrancy loop hazards.

---

## 📂 Project Architecture

```text
dao-governance-protocol/
├── contracts/
│   ├── DAOGovernance.sol        # Core Governance, Voting Engine & Timelock Vault
│   └── MockUSDT.sol             # Mock ERC-20 Governance Token for Test Assertions
├── test/
│   └── DAOGovernance.test.js    # Automated JavaScript Unit Test Suite (Mocha/Chai)
├── scripts/
│   └── deploy.js                # Network Deployment Automation Script
├── hardhat.config.js            # Hardhat Compiler Configuration
└── README.md                    # System Documentation
```

---

## ⚙️ Mathematical Model & Finite State Machine

### 1. The DAO Lifecyle State Transitions

Each submitted proposal advances sequentially through an ironclad execution timeline:

```text
[propose] ──➡️ Active (Voting Window) ──➡️ [Passed?] ──➡️ Successed (Queued in Timelock) ──➡️ [minDelay Met?] ──➡️ Executed
```

### 2. Consensus Math Evaluation

A proposal can only escape the live voting matrix if the total weight of affirmative ballots strictly outpaces dissenting sentiment upon passing the block duration:
$$\text{Consensus Target} = \text{Votes}_{\text{For}} > \text{Votes}_{\text{Against}} \quad \text{WHERE} \quad \text{Block.timestamp} > \text{Deadline}$$

---

## 💻 Local Installation & Testing Guide

### Prerequisites

Ensure you have **Node.js (v18.x or higher)** and **npm** installed on your workstation.

### 1. Clone & Initialize Environment

Clone the repository and install the standard dependencies, including OpenZeppelin contracts and testing libraries:

```bash
git clone <your-repository-url>
cd dao-governance-protocol
npm install
```

### 2. Compile Smart Contracts

Compile the Solidity code blocks to build localized artifact binaries and standard JSON ABIs:

```bash
npx hardhat compile
```

### 3. Run Automated Unit Tests (11 Security Checkpoints)

Execute the comprehensive local unit test suite evaluating entry thresholds, double-voting blockers, and time-traveling timelock validations:

```bash
npx hardhat test
```

### 4. Review Testing Coverage

Generate localized coverage matrix reports to verify that all functional statements, error strings, and state transitions are fully evaluated:

```bash
npx hardhat coverage
```

---

## 📄 License

This project is licensed under the **MIT License**.
