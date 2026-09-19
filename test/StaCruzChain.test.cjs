const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('StaCruzChain Smart Contract', function () {
  let StaCruzChain;
  let contract;
  let admin, mpdc, budgetOfficer, treasurer, other;

  beforeEach(async function () {
    [admin, mpdc, budgetOfficer, treasurer, other] = await ethers.getSigners();

    StaCruzChain = await ethers.getContractFactory('BayanLedger');
    contract = await StaCruzChain.connect(admin).deploy();
    await contract.deployed();

    await contract.connect(admin).grantRole(await contract.MPDC_ROLE(), mpdc.address);
    await contract.connect(admin).grantRole(await contract.BUDGET_OFFICER_ROLE(), budgetOfficer.address);
    await contract.connect(admin).grantRole(await contract.TREASURER_ROLE(), treasurer.address);
  });

  it('should create an MPDC-approved project and activate it after both gates', async function () {
    await expect(contract.connect(mpdc).createProjectWithMetadata('proj-001', 'Pagsawitan Drainage Repair', 500000, 'meta-hash-001'))
      .to.emit(contract, 'ProjectCreated')
      .withArgs('proj-001', 'Pagsawitan Drainage Repair', 500000, mpdc.address);

    const project = await contract.projects('proj-001');
    expect(project.exists).to.be.true;
    expect(project.name).to.equal('Pagsawitan Drainage Repair');
    expect(project.status).to.equal('MPDC Approved');
    expect(project.metadataHash).to.equal('meta-hash-001');

    await expect(contract.connect(budgetOfficer).allocateFunds('proj-001', 500000, 'SARO-2026-001'))
      .to.emit(contract, 'FundsAllocated')
      .withArgs('proj-001', 500000, 'SARO-2026-001', budgetOfficer.address);

    const pendingTreasury = await contract.projects('proj-001');
    expect(pendingTreasury.status).to.equal('SARO Approved - Pending Treasurer');

    await expect(contract.connect(treasurer).approveProjectActivation('proj-001', 'seal-hash-001'))
      .to.emit(contract, 'DigitalSealOfTruth')
      .withArgs('proj-001', 500000, treasurer.address);

    await expect(contract.connect(mpdc).verifyMilestone('proj-001', 'm-1', 30, 'ipfs://report1'))
      .to.emit(contract, 'MilestoneVerified')
      .withArgs('proj-001', 'm-1', 'ipfs://report1', mpdc.address);

    const milestone = await contract.projectMilestones('proj-001', 'm-1');
    expect(milestone.isVerified).to.be.true;
    expect(milestone.percentage).to.equal(30);

    const operationalProject = await contract.projects('proj-001');
    expect(operationalProject.status).to.equal('In Progress');
  });

  it('should verify milestone with evidence requiring at least 1 photo and 1 report', async function () {
    await contract.connect(mpdc).createProjectWithMetadata('proj-evidence', 'Bridge Inspection', 300000, 'meta-evidence');
    await contract.connect(budgetOfficer).allocateFunds('proj-evidence', 300000, 'SARO-EVID');
    await contract.connect(treasurer).approveProjectActivation('proj-evidence', 'seal-evid');

    // Should revert when 0 photos are provided
    await expect(
      contract.connect(mpdc).verifyMilestoneWithEvidence(
        'proj-evidence', 'm-evid-0', 25, 'ipfs://photo', 'evidence-hash-0', 'report-hash-0', 0, 1
      )
    ).to.be.revertedWith('At least one photo required');

    // Should revert when 0 reports are provided
    await expect(
      contract.connect(mpdc).verifyMilestoneWithEvidence(
        'proj-evidence', 'm-evid-0', 25, 'ipfs://photo', 'evidence-hash-0', 'report-hash-0', 1, 0
      )
    ).to.be.revertedWith('At least one report required');

    // Should succeed with 1 photo and 1 report
    await expect(
      contract.connect(mpdc).verifyMilestoneWithEvidence(
        'proj-evidence', 'm-evid-1', 50, 'ipfs://photo1', 'evidence-hash-1', 'report-hash-1', 1, 1
      )
    )
      .to.emit(contract, 'MilestoneVerified')
      .withArgs('proj-evidence', 'm-evid-1', 'ipfs://photo1', mpdc.address)
      .and.to.emit(contract, 'MilestoneEvidenceRecorded')
      .withArgs('proj-evidence', 'm-evid-1', 'evidence-hash-1', 'report-hash-1', 1, 1, mpdc.address);

    const milestone = await contract.projectMilestones('proj-evidence', 'm-evid-1');
    expect(milestone.isVerified).to.be.true;
    expect(milestone.photoCount).to.equal(1);
    expect(milestone.reportCount).to.equal(1);
    expect(milestone.evidenceHash).to.equal('evidence-hash-1');
    expect(milestone.reportHash).to.equal('report-hash-1');
  });

  it('should block milestone execution before treasury activation and reject over-disbursement', async function () {
    await contract.connect(mpdc).createProject('proj-002', 'Social Hall', 200000);

    await expect(contract.connect(mpdc).verifyMilestone('proj-002', 'm-1', 30, 'ipfs://blocked')).to.be.revertedWith('Project is not ACTIVE');
    await expect(contract.connect(treasurer).disburseFunds('proj-002', 100000)).to.be.revertedWith('Project is not ACTIVE');

    await contract.connect(budgetOfficer).allocateFunds('proj-002', 100000, 'SARO-2026-002');
    await expect(contract.connect(treasurer).disburseFunds('proj-002', 100000)).to.be.revertedWith('Project is not ACTIVE');
    await contract.connect(treasurer).approveProjectActivation('proj-002', 'seal-hash-002');
    await expect(contract.connect(treasurer).disburseFunds('proj-002', 100000)).to.not.be.reverted;

    const project = await contract.projects('proj-002');
    expect(project.disbursedFunds).to.equal(100000);
    expect(project.status).to.equal('Completed');
  });

  it('should allow Budget Officer and Treasurer to reject at their gates', async function () {
    await contract.connect(mpdc).createProject('proj-003', 'Road Widening', 300000);

    await expect(contract.connect(budgetOfficer).rejectProjectByBudgetOfficer('proj-003', 'No available appropriation'))
      .to.emit(contract, 'ProjectRejected')
      .withArgs('proj-003', 'Rejected - Budget Officer', 'No available appropriation', budgetOfficer.address);

    const rejectedByBudget = await contract.projects('proj-003');
    expect(rejectedByBudget.status).to.equal('Rejected - Budget Officer');

    await contract.connect(mpdc).createProject('proj-004', 'Bridge Repair', 450000);
    await contract.connect(budgetOfficer).allocateFunds('proj-004', 450000, 'SARO-2026-004');

    await expect(contract.connect(treasurer).rejectProjectByTreasurer('proj-004', 'Treasury cash flow unavailable'))
      .to.emit(contract, 'ProjectRejected')
      .withArgs('proj-004', 'Rejected - Treasurer', 'Treasury cash flow unavailable', treasurer.address);

    const rejectedByTreasurer = await contract.projects('proj-004');
    expect(rejectedByTreasurer.status).to.equal('Rejected - Treasurer');
  });

  it('should enforce role access control', async function () {
    await expect(contract.connect(other).createProject('proj-005', 'test', 10000)).to.be.revertedWith('Unauthorized: Missing role');
    await expect(contract.connect(other).allocateFunds('proj-001', 1000, 'SARO')).to.be.revertedWith('Unauthorized: Missing role');
    await expect(contract.connect(other).verifyMilestone('proj-001', 'm-x', 10, 'x')).to.be.revertedWith('Unauthorized: Missing role');
    await expect(contract.connect(other).disburseFunds('proj-001', 10)).to.be.revertedWith('Unauthorized: Missing role');
    await expect(contract.connect(other).approveProjectActivation('proj-001', 'seal')).to.be.revertedWith('Unauthorized: Missing role');
  });
});
