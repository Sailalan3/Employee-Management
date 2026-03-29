require("dotenv").config();
const HDWalletProvider = require("@truffle/hdwallet-provider");

const rpcUrl = process.env.GANACHE_RPC_URL || "http://127.0.0.1:7545";
const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;

module.exports = {
  networks: {
    development: deployerKey
      ? {
          provider: () =>
            new HDWalletProvider({
              privateKeys: [deployerKey],
              providerOrUrl: rpcUrl,
            }),
          network_id: process.env.GANACHE_CHAIN_ID || "*",
        }
      : {
          host: "127.0.0.1",
          port: 7545,
          network_id: process.env.GANACHE_CHAIN_ID || "*",
        },
    test: {
      host: "127.0.0.1",
      port: 7545,
      network_id: process.env.GANACHE_CHAIN_ID || "*",
    },
  },

  contracts_directory: "./contracts",
  contracts_build_directory: "./build/contracts",
  migrations_directory: "./migrations",

  compilers: {
    solc: {
      version: "0.8.20",
      settings: {
        evmVersion: "london",
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },
};
