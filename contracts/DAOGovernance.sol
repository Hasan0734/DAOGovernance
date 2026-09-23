// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DAOGovernance {
    IERC20 public immutable governanceToken;
    uint public immutable minDelay;
    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public proposalThreshold = 100 * 10 ** 18;

    address public owner;

    enum ProposalStatus {
        Pending,
        Active,
        Defeated,
        Successed,
        Executed
    }

    struct Proposal {
        uint id;
        address proposer;
        string description;
        address targetRecipient;
        uint256 requestedAmount;
        uint deadline;
        uint votesFor;
        uint votesAgainst;
        bool executed;
        bool canceled;
        ProposalStatus status;
    }

    uint public proposalCount;

    mapping(uint => Proposal) public proposals;
    mapping(uint => uint) public timelockQueue;
    mapping(uint => mapping(address => bool)) public hasVoted;

    event CreatedProposal(address indexed proposer, uint indexed projectId);
    event VoteCasted(
        uint indexed proposalId,
        address indexed votter,
        bool support,
        uint weight
    );
    event ProposalQueued(uint256 indexed proposalId, uint256 executionTime);
    event ProposalExecuted(
        uint256 indexed proposalId,
        address indexed proposer,
        address targetRecipient,
        uint256 amount
    );

    modifier onlyOwner() {
        require(owner == msg.sender, "Not the owner");
        _;
    }

    constructor(address _governanceToken, uint _minDelay) {
        governanceToken = IERC20(_governanceToken);
        minDelay = _minDelay;
        owner = msg.sender;
    }

    function propose(
        string memory _description,
        address _targetRecipient,
        uint _requestedAmount
    ) external {
        require(_targetRecipient != address(0), "Invalid recipient address");
        require(_requestedAmount > 0, "Requested amount must be > 0");
        require(
            governanceToken.balanceOf(msg.sender) >= proposalThreshold,
            "Require 100 tokens"
        );
        proposalCount++;

        proposals[proposalCount] = Proposal({
            id: proposalCount,
            proposer: msg.sender,
            description: _description,
            targetRecipient: _targetRecipient,
            requestedAmount: _requestedAmount,
            deadline: block.timestamp + VOTING_PERIOD,
            votesFor: 0,
            votesAgainst: 0,
            executed: false,
            canceled: false,
            status: ProposalStatus.Active
        });

        emit CreatedProposal(msg.sender, proposalCount);
    }

    function castVote(uint _proposalId, bool _support) external {
        require(
            block.timestamp <= proposals[_proposalId].deadline,
            "Vote deadline is passed."
        );
        require(!proposals[_proposalId].executed, "Propsal is excuted");
        require(!proposals[_proposalId].canceled, "Proposal canceled");
        require(!hasVoted[_proposalId][msg.sender], "Already voted");

        uint votingPower = governanceToken.balanceOf(msg.sender);
        require(votingPower > 0, "You have not power to vote");

        hasVoted[_proposalId][msg.sender] = true;

        if (_support) {
            proposals[_proposalId].votesFor += votingPower;
        } else {
            proposals[_proposalId].votesAgainst += votingPower;
        }
        emit VoteCasted(_proposalId, msg.sender, _support, votingPower);
    }

    function queueProposal(uint _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        require(block.timestamp > proposal.deadline, "Still casting vote");
        require(
            proposal.status == ProposalStatus.Active,
            "Already lock the fund"
        );
        require(
            proposal.votesFor > proposal.votesAgainst,
            "Proposal is not passed."
        );

        proposal.status = ProposalStatus.Successed;
        uint executionTime = block.timestamp + minDelay;
        timelockQueue[_proposalId] = executionTime;
        emit ProposalQueued(_proposalId, executionTime);
    }

    function executeProposal(uint _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];

        require(
            block.timestamp >= timelockQueue[_proposalId],
            "Timelock delay not met"
        );
        require(
            proposal.status == ProposalStatus.Successed,
            "Proposal not queued or succeeded"
        );
        require(!proposal.executed, "Already excuted!");

        proposal.status = ProposalStatus.Executed;
        proposal.executed = true;
        require(
            governanceToken.transfer(
                proposal.targetRecipient,
                proposal.requestedAmount
            ),
            "Token transfer failed"
        );
        emit ProposalExecuted(
            _proposalId,
            proposal.proposer,
            proposal.targetRecipient,
            proposal.requestedAmount
        );
    }

    function setProposalThreshold(uint256 _newThreshold) external onlyOwner {
        proposalThreshold = _newThreshold;
    }
}
