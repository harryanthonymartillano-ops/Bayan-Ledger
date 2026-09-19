const { ethers } = require("hardhat");

async function main() {
  const contractAddress = "0x46C619a82F8Eb0AbC10e852F479f430F14484558";
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  // Get the contract
  const BayanLedger = await ethers.getContractFactory("BayanLedger");
  const contract = await BayanLedger.attach(contractAddress);
  
  // Admin wallet address to grant role
  const adminWallet = "0xaA5De983238eab1e68a73A5c265386d6fa761530";
  
  // Get the ADMIN_ROLE hash
  const ADMIN_ROLE = await contract.ADMIN_ROLE();
  console.log("ADMIN_ROLE hash:", ADMIN_ROLE);
  
  // Grant admin role
  console.log("Granting ADMIN_ROLE to:", adminWallet);
  const tx = await contract.grantRole(ADMIN_ROLE, adminWallet);
  await tx.wait();
  
  console.log("✅ Admin role granted successfully!");
  
  // Verify
  const hasRole = await contract.roles(ADMIN_ROLE, adminWallet);
  console.log("Verification - Has admin role:", hasRole);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });