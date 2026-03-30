const EmployeeRegistry = artifacts.require("EmployeeRegistry");

module.exports = async function (deployer) {
  await deployer.deploy(EmployeeRegistry);
};
