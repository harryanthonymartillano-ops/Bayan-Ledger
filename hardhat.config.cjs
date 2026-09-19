require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-ethers');
require('dotenv').config();

module.exports = {
  solidity: {
    version: '0.8.20',
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    sepolia: {
      url: process.env.SEPOLIA_URL || 'https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY',
      accounts: [process.env.PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000'],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
};
