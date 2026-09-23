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

      await expect(daoGovernance.connect(user2).propose("Spam proposal", recipient.address, requestedAmt))
        .to.be.revertedWith("Require 100 tokens");
    })

    it("2. Should reject zero-address recipients and empty requested allocations", async function () {
      const requestedAmt = ethers.parseEther("100");
      await expect(daoGovernance.connect(user1).propose("Bad address", ethers.ZeroAddress, requestedAmt))
        .to.be.revertedWith("Invalid recipient address");
    })
  })

});

