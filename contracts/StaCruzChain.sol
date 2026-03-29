// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title StaCruzChain
 * @dev Smart contract for managing municipal projects, milestones, and fund disbursements
 *      with strict Role-Based Access Control (RBAC).
 */
contract StaCruzChain {
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MPDC_ROLE = keccak256("MPDC_ROLE");
    bytes32 public constant BUDGET_OFFICER_ROLE = keccak256("BUDGET_OFFICER_ROLE");
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");

    mapping(bytes32 => mapping(address => bool)) public roles;

    // Modifiers
    modifier onlyRole(bytes32 role) {
        require(roles[role][msg.sender], "Unauthorized: Missing role");
        _;
    }

    // Project Structs
    struct Project {
        string id;
        string name;
        uint256 totalBudget;
        uint256 allocatedFunds;
        uint256 disbursedFunds;
        bool exists;
    }

    struct Milestone {
        string id;
        uint8 percentage;
        bool isVerified;
        string ipfsHash;
    }

    mapping(string => Project) public projects;
    // projectId => milestoneId => Milestone
    mapping(string => mapping(string => Milestone)) public projectMilestones;

    // Events
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);
    event ProjectCreated(string projectId, string name, uint256 totalBudget, address indexed createdBy);
    event FundsAllocated(string projectId, uint256 amount, string saro, address indexed allocatedBy);
    event MilestoneVerified(string projectId, string milestoneId, string ipfsHash, address indexed verifiedBy);
    event FundsDisbursed(string projectId, uint256 amount, address indexed disbursedBy);

    constructor() {
        // The deployer is automatically granted the Admin role
        roles[ADMIN_ROLE][msg.sender] = true;
        emit RoleGranted(ADMIN_ROLE, msg.sender, msg.sender);
    }

    /**
     * @dev Admin grants a specific role to an account (e.g., wallet mapping)
     */
    function grantRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE) {
        roles[role][account] = true;
        emit RoleGranted(role, account, msg.sender);
    }

    /**
     * @dev Admin revokes a specific role from an account
     */
    function revokeRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE) {
        roles[role][account] = false;
        emit RoleRevoked(role, account, msg.sender);
    }

    /**
     * @dev MPDC (Planning) initiates a new infrastructure project
     */
    function createProject(string memory _id, string memory _name, uint256 _totalBudget) external onlyRole(MPDC_ROLE) {
        require(!projects[_id].exists, "Project already exists");
        
        projects[_id] = Project({
            id: _id,
            name: _name,
            totalBudget: _totalBudget,
            allocatedFunds: 0,
            disbursedFunds: 0,
            exists: true
        });

        emit ProjectCreated(_id, _name, _totalBudget, msg.sender);
    }

    /**
     * @dev Budget Officer allocates funds (SARO) to a specific project
     */
    function allocateFunds(string memory _projectId, uint256 _amount, string memory _saro) external onlyRole(BUDGET_OFFICER_ROLE) {
        require(projects[_projectId].exists, "Project does not exist");
        require(projects[_projectId].allocatedFunds + _amount <= projects[_projectId].totalBudget, "Exceeds total budget");

        projects[_projectId].allocatedFunds += _amount;

        emit FundsAllocated(_projectId, _amount, _saro, msg.sender);
    }

    /**
     * @dev MPDC verifies a milestone by attaching an IPFS hash of the geo-tagged report
     */
    function verifyMilestone(string memory _projectId, string memory _milestoneId, uint8 _percentage, string memory _ipfsHash) external onlyRole(MPDC_ROLE) {
        require(projects[_projectId].exists, "Project does not exist");
        require(!projectMilestones[_projectId][_milestoneId].isVerified, "Milestone already verified");

        projectMilestones[_projectId][_milestoneId] = Milestone({
            id: _milestoneId,
            percentage: _percentage,
            isVerified: true,
            ipfsHash: _ipfsHash
        });

        emit MilestoneVerified(_projectId, _milestoneId, _ipfsHash, msg.sender);
    }

    /**
     * @dev Treasurer disburses funds (NCA) after verifying the milestone
     */
    function disburseFunds(string memory _projectId, uint256 _amount) external onlyRole(TREASURER_ROLE) {
        require(projects[_projectId].exists, "Project does not exist");
        require(projects[_projectId].disbursedFunds + _amount <= projects[_projectId].allocatedFunds, "Exceeds allocated funds");

        projects[_projectId].disbursedFunds += _amount;

        emit FundsDisbursed(_projectId, _amount, msg.sender);
    }
}
