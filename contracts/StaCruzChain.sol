// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BayanLedger
 * @dev Smart contract for managing municipal projects, milestones, and fund disbursements
 *      with strict Role-Based Access Control (RBAC) and transparency references.
 */
contract BayanLedger {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MPDC_ROLE = keccak256("MPDC_ROLE");
    bytes32 public constant BUDGET_OFFICER_ROLE = keccak256("BUDGET_OFFICER_ROLE");
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");


    mapping(bytes32 => mapping(address => bool)) public roles;

    modifier onlyRole(bytes32 role) {
        require(roles[role][msg.sender], "Unauthorized: Missing role");
        _;
    }

    struct Project {
        string id;
        string name;
        uint256 totalBudget;
        uint256 allocatedFunds;
        uint256 disbursedFunds;
        string metadataHash;
        string latestSaroRef;
        string latestDisbursementRef;
        uint256 createdAt;
        address createdBy;
        string status;
        string rejectionReason;
        string treasurySealHash;
        uint256 activatedAt;
        bool exists;
    }

    struct Milestone {
        string id;
        uint8 percentage;
        bool isVerified;
        bool isPaid;
        string ipfsHash;
        string evidenceHash;
        string reportHash;
        uint8 photoCount;
        uint8 reportCount;
        uint256 verifiedAt;
        address verifiedBy;
    }

    struct DisbursementRequest {
        string id;
        string projectId;
        string milestoneId;
        address contractor;
        uint256 amount;
        string metadataHash;
        string supportingHash;
        string digitalSealHash;
        uint256 createdAt;
        uint256 budgetSignedAt;
        uint256 treasurerSignedAt;
        address initiatedBy;
        address budgetSignedBy;
        address treasurerSignedBy;
        bool budgetSigned;
        bool executed;
        bool exists;
    }

    mapping(string => Project) public projects;
    mapping(string => mapping(string => Milestone)) public projectMilestones;
    mapping(string => DisbursementRequest) public disbursementRequests;

    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);
    event ProjectCreated(string projectId, string name, uint256 totalBudget, address indexed createdBy);
    event ProjectMetadataRecorded(string indexed projectId, string metadataHash, address indexed recordedBy);
    event FundsAllocated(string projectId, uint256 amount, string saro, address indexed allocatedBy);
    event ProjectRejected(string indexed projectId, string status, string reason, address indexed rejectedBy);
    event ProjectActivated(string indexed projectId, string status, string treasurySealHash, address indexed treasurer);
    event DigitalSealOfTruth(string indexed projectId, uint256 amount, address indexed treasurer);
    event MilestoneVerified(string projectId, string milestoneId, string ipfsHash, address indexed verifiedBy);
    event MilestoneEvidenceRecorded(
        string indexed projectId,
        string indexed milestoneId,
        string evidenceHash,
        string reportHash,
        uint8 photoCount,
        uint8 reportCount,
        address recordedBy
    );
    event FundsDisbursed(string projectId, uint256 amount, address indexed disbursedBy);
    event DisbursementReferenceRecorded(string indexed projectId, string referenceHash, address indexed recordedBy);
    event PendingTransactionCreated(
        string indexed requestId,
        string indexed projectId,
        string indexed milestoneId,
        uint256 amount,
        address contractor,
        string metadataHash,
        address initiatedBy
    );
    event TransactionPartiallySigned(
        string indexed requestId,
        string indexed projectId,
        address indexed budgetOfficer,
        uint8 signatureCount,
        string supportingHash
    );
    event DisbursementDigitalSealOfTruth(
        string indexed requestId,
        string indexed projectId,
        string indexed milestoneId,
        address contractor,
        uint256 amount,
        string digitalSealHash,
        address treasurer
    );

    constructor() {
        roles[ADMIN_ROLE][msg.sender] = true;
        emit RoleGranted(ADMIN_ROLE, msg.sender, msg.sender);
    }

    function grantRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE) {
        roles[role][account] = true;
        emit RoleGranted(role, account, msg.sender);
    }

    function revokeRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE) {
        roles[role][account] = false;
        emit RoleRevoked(role, account, msg.sender);
    }

    function createProject(string memory _id, string memory _name, uint256 _totalBudget) external onlyRole(MPDC_ROLE) {
        _createProject(_id, _name, _totalBudget, "");
    }

    function createProjectWithMetadata(
        string memory _id,
        string memory _name,
        uint256 _totalBudget,
        string memory _metadataHash
    ) external onlyRole(MPDC_ROLE) {
        _createProject(_id, _name, _totalBudget, _metadataHash);
    }

    function _createProject(
        string memory _id,
        string memory _name,
        uint256 _totalBudget,
        string memory _metadataHash
    ) internal {
        require(!projects[_id].exists, "Project already exists");

        projects[_id] = Project({
            id: _id,
            name: _name,
            totalBudget: _totalBudget,
            allocatedFunds: 0,
            disbursedFunds: 0,
            metadataHash: _metadataHash,
            latestSaroRef: "",
            latestDisbursementRef: "",
            createdAt: block.timestamp,
            createdBy: msg.sender,
            status: "MPDC Approved",
            rejectionReason: "",
            treasurySealHash: "",
            activatedAt: 0,
            exists: true
        });

        emit ProjectCreated(_id, _name, _totalBudget, msg.sender);
        if (bytes(_metadataHash).length > 0) {
            emit ProjectMetadataRecorded(_id, _metadataHash, msg.sender);
        }
    }

    function allocateFunds(string memory _projectId, uint256 _amount, string memory _saro) external onlyRole(BUDGET_OFFICER_ROLE) {
        require(projects[_projectId].exists, "Project does not exist");
        require(_amount > 0, "Amount must be greater than zero");
        require(_isStatus(projects[_projectId].status, "MPDC Approved"), "Project is not awaiting Budget Officer action");
        require(projects[_projectId].allocatedFunds + _amount <= projects[_projectId].totalBudget, "Exceeds total budget");

        projects[_projectId].allocatedFunds += _amount;
        projects[_projectId].latestSaroRef = _saro;
        projects[_projectId].status = "SARO Approved - Pending Treasurer";
        projects[_projectId].rejectionReason = "";

        emit FundsAllocated(_projectId, _amount, _saro, msg.sender);
    }

    function rejectProjectByBudgetOfficer(
        string memory _projectId,
        string memory _reason
    ) external onlyRole(BUDGET_OFFICER_ROLE) {
        require(projects[_projectId].exists, "Project does not exist");
        require(_isStatus(projects[_projectId].status, "MPDC Approved"), "Project is not awaiting Budget Officer action");
        require(bytes(_reason).length > 0, "Rejection reason required");

        projects[_projectId].status = "Rejected - Budget Officer";
        projects[_projectId].rejectionReason = _reason;

        emit ProjectRejected(_projectId, projects[_projectId].status, _reason, msg.sender);
    }

    function approveProjectActivation(
        string memory _projectId,
        string memory _treasurySealHash
    ) external onlyRole(TREASURER_ROLE) {
        require(projects[_projectId].exists, "Project does not exist");
        require(_isStatus(projects[_projectId].status, "SARO Approved - Pending Treasurer"), "Project is not awaiting Treasurer approval");
        require(projects[_projectId].allocatedFunds > 0, "Allocated funds required");

        projects[_projectId].status = "ACTIVE";
        projects[_projectId].rejectionReason = "";
        projects[_projectId].treasurySealHash = _treasurySealHash;
        projects[_projectId].activatedAt = block.timestamp;

        emit ProjectActivated(_projectId, projects[_projectId].status, _treasurySealHash, msg.sender);
        emit DigitalSealOfTruth(_projectId, projects[_projectId].allocatedFunds, msg.sender);
    }

    function rejectProjectByTreasurer(
        string memory _projectId,
        string memory _reason
    ) external onlyRole(TREASURER_ROLE) {
        require(projects[_projectId].exists, "Project does not exist");
        require(_isStatus(projects[_projectId].status, "SARO Approved - Pending Treasurer"), "Project is not awaiting Treasurer approval");
        require(bytes(_reason).length > 0, "Rejection reason required");

        projects[_projectId].status = "Rejected - Treasurer";
        projects[_projectId].rejectionReason = _reason;

        emit ProjectRejected(_projectId, projects[_projectId].status, _reason, msg.sender);
    }







    function verifyMilestone(
        string memory _projectId,
        string memory _milestoneId,
        uint8 _percentage,
        string memory _ipfsHash
    ) external onlyRole(MPDC_ROLE) {
        _verifyMilestone(_projectId, _milestoneId, _percentage, _ipfsHash, "", "", 0, 0);
    }

    function verifyMilestoneWithEvidence(
        string memory _projectId,
        string memory _milestoneId,
        uint8 _percentage,
        string memory _ipfsHash,
        string memory _evidenceHash,
        string memory _reportHash,
        uint8 _photoCount,
        uint8 _reportCount
    ) external onlyRole(MPDC_ROLE) {
        require(_photoCount >= 1, "At least one photo required");
        require(_reportCount >= 1, "At least one report required");
        _verifyMilestone(_projectId, _milestoneId, _percentage, _ipfsHash, _evidenceHash, _reportHash, _photoCount, _reportCount);
    }

    function _verifyMilestone(
        string memory _projectId,
        string memory _milestoneId,
        uint8 _percentage,
        string memory _ipfsHash,
        string memory _evidenceHash,
        string memory _reportHash,
        uint8 _photoCount,
        uint8 _reportCount
    ) internal {
        require(projects[_projectId].exists, "Project does not exist");
        require(_isOperationalProject(projects[_projectId].status), "Project is not ACTIVE");
        require(!projectMilestones[_projectId][_milestoneId].isVerified, "Milestone already verified");

        projectMilestones[_projectId][_milestoneId] = Milestone({
            id: _milestoneId,
            percentage: _percentage,
            isVerified: true,
            isPaid: false,
            ipfsHash: _ipfsHash,
            evidenceHash: _evidenceHash,
            reportHash: _reportHash,
            photoCount: _photoCount,
            reportCount: _reportCount,
            verifiedAt: block.timestamp,
            verifiedBy: msg.sender
        });

        if (_isStatus(projects[_projectId].status, "ACTIVE")) {
            projects[_projectId].status = "In Progress";
        }

        emit MilestoneVerified(_projectId, _milestoneId, _ipfsHash, msg.sender);
        if (bytes(_evidenceHash).length > 0 || bytes(_reportHash).length > 0) {
            emit MilestoneEvidenceRecorded(_projectId, _milestoneId, _evidenceHash, _reportHash, _photoCount, _reportCount, msg.sender);
        }
    }

    function disburseFunds(string memory _projectId, uint256 _amount) external onlyRole(TREASURER_ROLE) {
        _disburseFunds(_projectId, _amount, "");
    }

    function disburseFundsWithReference(
        string memory _projectId,
        uint256 _amount,
        string memory _referenceHash
    ) external onlyRole(TREASURER_ROLE) {
        _disburseFunds(_projectId, _amount, _referenceHash);
    }

    function _disburseFunds(
        string memory _projectId,
        uint256 _amount,
        string memory _referenceHash
    ) internal {
        require(projects[_projectId].exists, "Project does not exist");
        require(_isOperationalProject(projects[_projectId].status), "Project is not ACTIVE");
        require(projects[_projectId].disbursedFunds + _amount <= projects[_projectId].allocatedFunds, "Exceeds allocated funds");

        projects[_projectId].disbursedFunds += _amount;
        if (bytes(_referenceHash).length > 0) {
            projects[_projectId].latestDisbursementRef = _referenceHash;
            emit DisbursementReferenceRecorded(_projectId, _referenceHash, msg.sender);
        }

        if (projects[_projectId].disbursedFunds >= projects[_projectId].allocatedFunds) {
            projects[_projectId].status = "Completed";
        } else if (!_isStatus(projects[_projectId].status, "Completed")) {
            projects[_projectId].status = "In Progress";
        }

        emit FundsDisbursed(_projectId, _amount, msg.sender);
    }

    function markMilestonePaid(string memory _projectId, string memory _milestoneId) external onlyRole(TREASURER_ROLE) {
        require(projects[_projectId].exists, "Project does not exist");
        require(_isOperationalProject(projects[_projectId].status), "Project is not ACTIVE");
        require(projectMilestones[_projectId][_milestoneId].isVerified, "Milestone not verified");

        projectMilestones[_projectId][_milestoneId].isPaid = true;
    }

    function createDisbursementRequest(
        string memory _requestId,
        string memory _projectId,
        string memory _milestoneId,
        address _contractor,
        uint256 _amount,
        string memory _metadataHash
    ) external onlyRole(MPDC_ROLE) {
        require(!disbursementRequests[_requestId].exists, "Request already exists");
        require(projects[_projectId].exists, "Project does not exist");
        require(_isOperationalProject(projects[_projectId].status), "Project is not ACTIVE");
        require(projectMilestones[_projectId][_milestoneId].isVerified, "Milestone not verified");
        require(!projectMilestones[_projectId][_milestoneId].isPaid, "Milestone already paid");
        require(_contractor != address(0), "Invalid contractor address");
        require(_amount > 0, "Amount must be greater than zero");
        require(projects[_projectId].disbursedFunds + _amount <= projects[_projectId].allocatedFunds, "Exceeds allocated funds");

        disbursementRequests[_requestId] = DisbursementRequest({
            id: _requestId,
            projectId: _projectId,
            milestoneId: _milestoneId,
            contractor: _contractor,
            amount: _amount,
            metadataHash: _metadataHash,
            supportingHash: "",
            digitalSealHash: "",
            createdAt: block.timestamp,
            budgetSignedAt: 0,
            treasurerSignedAt: 0,
            initiatedBy: msg.sender,
            budgetSignedBy: address(0),
            treasurerSignedBy: address(0),
            budgetSigned: false,
            executed: false,
            exists: true
        });

        emit PendingTransactionCreated(_requestId, _projectId, _milestoneId, _amount, _contractor, _metadataHash, msg.sender);
    }

    function signDisbursementRequestByBudgetOfficer(
        string memory _requestId,
        string memory _supportingHash
    ) external onlyRole(BUDGET_OFFICER_ROLE) {
        DisbursementRequest storage requestRecord = disbursementRequests[_requestId];
        require(requestRecord.exists, "Request does not exist");
        require(!requestRecord.executed, "Request already executed");
        require(!requestRecord.budgetSigned, "Budget Officer already signed");
        require(projects[requestRecord.projectId].exists, "Project does not exist");
        require(projects[requestRecord.projectId].allocatedFunds >= requestRecord.amount, "Insufficient allocated funds");

        requestRecord.budgetSigned = true;
        requestRecord.budgetSignedAt = block.timestamp;
        requestRecord.budgetSignedBy = msg.sender;
        requestRecord.supportingHash = _supportingHash;

        emit TransactionPartiallySigned(_requestId, requestRecord.projectId, msg.sender, 1, _supportingHash);
    }

    function executeDisbursementRequest(
        string memory _requestId,
        string memory _digitalSealHash
    ) external onlyRole(TREASURER_ROLE) {
        DisbursementRequest storage requestRecord = disbursementRequests[_requestId];
        require(requestRecord.exists, "Request does not exist");
        require(requestRecord.budgetSigned, "Budget Officer signature required");
        require(!requestRecord.executed, "Request already executed");
        require(projects[requestRecord.projectId].exists, "Project does not exist");
        require(_isOperationalProject(projects[requestRecord.projectId].status), "Project is not ACTIVE");
        require(projectMilestones[requestRecord.projectId][requestRecord.milestoneId].isVerified, "Milestone not verified");
        require(!projectMilestones[requestRecord.projectId][requestRecord.milestoneId].isPaid, "Milestone already paid");

        requestRecord.executed = true;
        requestRecord.treasurerSignedAt = block.timestamp;
        requestRecord.treasurerSignedBy = msg.sender;
        requestRecord.digitalSealHash = _digitalSealHash;

        _disburseFunds(requestRecord.projectId, requestRecord.amount, _digitalSealHash);
        projectMilestones[requestRecord.projectId][requestRecord.milestoneId].isPaid = true;

        emit DisbursementDigitalSealOfTruth(
            _requestId,
            requestRecord.projectId,
            requestRecord.milestoneId,
            requestRecord.contractor,
            requestRecord.amount,
            _digitalSealHash,
            msg.sender
        );
    }

    function _isStatus(string memory currentStatus, string memory expectedStatus) internal pure returns (bool) {
        return keccak256(bytes(currentStatus)) == keccak256(bytes(expectedStatus));
    }

    function _isOperationalProject(string memory currentStatus) internal pure returns (bool) {
        return _isStatus(currentStatus, "ACTIVE") || _isStatus(currentStatus, "In Progress");
    }
}
