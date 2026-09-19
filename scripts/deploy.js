async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with account:', deployer.address);

  const BayanLedger = await ethers.getContractFactory('BayanLedger');
  const contract = await BayanLedger.deploy();

  await contract.deployed();
  console.log('BayanLedger deployed to:', contract.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
