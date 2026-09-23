import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/types";
import { expect } from "chai";
import { network } from "hardhat";
import type { MockUSDT } from "../types/ethers-contracts/index.js";
import type { DAOGovernance } from "../types/ethers-contracts/index.js";

const { ethers } = await network.create();

describe("DAOGovernance", function () {
  let daoGovernance: DAOGovernance;
  let govToken: MockUSDT;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let recipient: HardhatEthersSigner;
  const MIN_DELAY = 2 * 24 * 60 * 60;

  beforeEach(async function () {
    [owner, user1, user2, recipient] = await ethers.getSigners();

    const MockTokenFactory = await ethers.getContractFactory("MockUSDT")
    govToken = await MockTokenFactory.deploy();
    await govToken.waitForDeployment();

    const govTokenAddress = await govToken.getAddress();

    const DAOGovernanceFactory = await ethers.getContractFactory("DAOGovernance");
    daoGovernance = await DAOGovernanceFactory.deploy(govTokenAddress, MIN_DELAY);
    await daoGovernance.waitForDeployment();

    const daoAddress = await daoGovernance.getAddress();

    const vaultFund = ethers.parseEther('5000');
    await govToken.transfer(daoAddress, vaultFund);


    await govToken.transfer(user1, ethers.parseEther("500"))
    await govToken.transfer(user2, ethers.parseEther("50"))

  })

  describe("Proposal & Threshold Layer", function () {
    it("1. Should fail if a user below the threshold tries to submit a proposal", async function () {

      const requestedAmt = ethers.parseEther("100");

      await expect(daoGovernance.connect(user2)
        .propose("Spam proposal", recipient.address, requestedAmt))
        .to.be.revertedWith("Require 100 tokens");
    })

    it("2. Should reject zero-address recipients and empty requested allocations", async function () {
      const requestedAmt = ethers.parseEther("100");

      await expect(daoGovernance.connect(user1)
        .propose("Bad address", ethers.ZeroAddress, requestedAmt))
        .to.be.revertedWith("Invalid recipient address");

      await expect(daoGovernance.connect(user1)
        .propose("Bad amount", recipient.address, 0))
        .to.be.revertedWith("Requested amount must be > 0");
    })
    it("3. Should successfully log a valid proposal with active status structures", async function () {
      const requestedAmt = ethers.parseEther("250");

      await expect(daoGovernance.connect(user1)
        .propose("Valid Server Upgrade Grant", recipient.address, requestedAmt))
        .to.emit(daoGovernance, "CreatedProposal")
        .withArgs(user1.address, 1);

      const proposal = await daoGovernance.proposals(1);
      expect(proposal.id).to.be.equal(1);
      expect(proposal.proposer).to.be.equal(user1.address);
      expect(proposal.targetRecipient).to.be.equal(recipient.address);
      expect(proposal.requestedAmount).to.be.equal(requestedAmt);
      expect(proposal.status).to.be.equal(1);

    })

    it("4. Should restrict proposalThreshold parameter adjustments to the contract owner", async function () {
      const newThreshold = ethers.parseEther("200");

      await expect(daoGovernance.connect(user1)
        .setProposalThreshold(newThreshold)).to.be.revertedWith("Not the owner")

    })
  })

  describe("Voting & Double-Voting Protection Layer", function () {
    beforeEach(async function () {
      const requestedAmt = ethers.parseEther("200");

      await daoGovernance.connect(user1).propose("Core Infrastructure Update", recipient.address, requestedAmt);

    })

    it("5. Should reject voting attempts from addresses holding 0 governance weight", async function () {
      await expect(
        daoGovernance.connect(recipient).castVote(1, true))
        .to.be.revertedWith("You have not power to vote");
    })

    it("6. Should prevent double-voting exploits on the same proposal ID", async function () {
      expect(daoGovernance.connect(user1).castVote(1, true))

      await expect(daoGovernance.connect(user1).castVote(1, true))
        .to.be.revertedWith("Already voted");

    })

    it("7. Should block voting actions once the active chronological deadline expires", async function () {
      await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(daoGovernance.connect(user1).castVote(1, true))
        .to.be.revertedWith("Vote deadline is passed.");
    })

  })


  describe("Timelock & Execution Layer", function () {
    let requestedAmt: bigint;
    beforeEach(async function () {
      requestedAmt = ethers.parseEther("300");
      await daoGovernance.connect(user1).propose("Developer Payout Proposal", recipient.address, requestedAmt);
    })

    it("8. Should reject lock queueing while active voting timelines are still running", async function () {
      await expect(daoGovernance.connect(user1).queueProposal(1))
        .to.be.revertedWith("Still casting vote");
    })

    it("9. Should drop defeated proposals and refuse to lock them inside the time queue", async function () {
      await daoGovernance.connect(user2).castVote(1, false);

      await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);
      await expect(daoGovernance.connect(user1).queueProposal(1)).to.be.revertedWith("Proposal is not passed.");
    })

    it("10. Should block execution calls prior to the expiration of the timelock decay delay", async function () {
      await daoGovernance.connect(user1).castVote(1, true);

      await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);
      await daoGovernance.connect(user1).queueProposal(1);

      await ethers.provider.send("evm_increaseTime", [1 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await expect(daoGovernance.connect(user1).executeProposal(1))
        .to.be.revertedWith("Timelock delay not met");
    });

    it("11. Should successfully unlock timelock and process exact dynamic payload distributions", async function () {
      await daoGovernance.connect(user1).castVote(1, true);

      await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);
      await daoGovernance.connect(user1).queueProposal(1);

      await ethers.provider.send("evm_increaseTime", [MIN_DELAY + 1]);
      await ethers.provider.send("evm_mine", []);

      const recipientInitialBalance = await govToken.balanceOf(recipient.address);
      await expect(daoGovernance.connect(user1).executeProposal(1))
        .to.emit(daoGovernance, "ProposalExecuted")
        .withArgs(1, user1.address, recipient.address, requestedAmt)


      const proposal = await daoGovernance.proposals(1);

      expect(proposal.executed).to.be.true;
      expect(proposal.status).to.be.equal(4);

      const recipientFinalBalance = await govToken.balanceOf(recipient.address);
      expect(recipientFinalBalance).to.equal(recipientInitialBalance + requestedAmt)

    })
  })

});

