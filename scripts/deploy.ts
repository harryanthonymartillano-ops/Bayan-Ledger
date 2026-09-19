import { ethers } from 'hardhat';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  const BayanLedger = await ethers.getContractFactory('BayanLedger');
  const contract = await BayanLedger.deploy();

  await contract.deployed();

  console.log('BayanLedger deployed to:', contract.address);

  const deployment = {
    contractAddress: contract.address,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.resolve(process.cwd(), 'artifacts', 'deployment.latest.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(deployment, null, 2));
  console.log('Deployment metadata written to:', outputPath);
  console.log(`Set VITE_CONTRACT_ADDRESS=${contract.address} and backend CONTRACT_ADDRESS=${contract.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
