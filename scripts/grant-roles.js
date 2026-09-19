async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const mpdcWallet = process.env.MPDC_WALLET_ADDRESS;
  const budgetWallet = process.env.BUDGET_WALLET_ADDRESS;
  const treasurerWallet = process.env.TREASURER_WALLET_ADDRESS;

  if (!contractAddress) {
    throw new Error('Missing CONTRACT_ADDRESS in environment.');
  }

  if (!mpdcWallet || !budgetWallet || !treasurerWallet) {
    throw new Error('Missing one or more role wallet addresses in environment.');
  }

  const [admin] = await ethers.getSigners();
  console.log('Granting roles with admin wallet:', admin.address);
  console.log('Target contract:', contractAddress);

  const contract = await ethers.getContractAt('BayanLedger', contractAddress, admin);

  const assignments = [
    { label: 'MPDC', role: await contract.MPDC_ROLE(), wallet: mpdcWallet },
    { label: 'Budget Officer', role: await contract.BUDGET_OFFICER_ROLE(), wallet: budgetWallet },
    { label: 'Treasurer', role: await contract.TREASURER_ROLE(), wallet: treasurerWallet },
  ];

  for (const assignment of assignments) {
    if (!ethers.utils.isAddress(assignment.wallet)) {
      throw new Error(`Invalid wallet address for ${assignment.label}: ${assignment.wallet}`);
    }

    const alreadyGranted = await contract.roles(assignment.role, assignment.wallet);
    if (alreadyGranted) {
      console.log(`${assignment.label} role already granted to ${assignment.wallet}`);
      continue;
    }

    const tx = await contract.grantRole(assignment.role, assignment.wallet);
    await tx.wait();
    console.log(`${assignment.label} role granted to ${assignment.wallet} in tx ${tx.hash}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
