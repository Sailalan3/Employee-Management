const EmployeeRegistry = artifacts.require("EmployeeRegistry");

const { expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

contract("EmployeeRegistry", (accounts) => {
  // accounts[0] is reserved for the backend wallet — tests use [1..] so they
  // don't consume the deployer's nonces and de-sync the backend's NonceManager.
  const [, owner, alice, bob, stranger] = accounts;

  let registry;

  beforeEach(async () => {
    registry = await EmployeeRegistry.new({ from: owner });
  });

  describe("createEmployee", () => {
    it("stores the employee and increments the counter", async () => {
      const tx = await registry.createEmployee(
        "0xnamehash1",
        "Engineering",
        "Backend Engineer",
        alice,
        { from: owner }
      );

      const count = await registry.employeeCount();
      assert.strictEqual(count.toString(), "1");

      const emp = await registry.getEmployee(1);
      assert.strictEqual(emp.employeeId.toString(), "1");
      assert.strictEqual(emp.nameHash, "0xnamehash1");
      assert.strictEqual(emp.department, "Engineering");
      assert.strictEqual(emp.role, "Backend Engineer");
      assert.strictEqual(emp.walletAddress, alice);
      assert.strictEqual(emp.isActive, true);

      expectEvent(tx, "EmployeeCreated", {
        employeeId: web3.utils.toBN(1),
        walletAddress: alice,
      });
    });

    it("rejects the zero address as a wallet", async () => {
      await expectRevert.unspecified(
        registry.createEmployee(
          "0xnamehash1",
          "Engineering",
          "Backend Engineer",
          "0x0000000000000000000000000000000000000000",
          { from: owner }
        )
      );
    });

    it("only the owner can create employees", async () => {
      await expectRevert.unspecified(
        registry.createEmployee(
          "0xnamehash1",
          "Engineering",
          "Backend Engineer",
          alice,
          { from: stranger }
        )
      );
    });
  });

  describe("updateEmployee", () => {
    beforeEach(async () => {
      await registry.createEmployee(
        "0xnamehash1",
        "Engineering",
        "Backend Engineer",
        alice,
        { from: owner }
      );
    });

    it("updates fields and emits EmployeeUpdated", async () => {
      const tx = await registry.updateEmployee(
        1,
        "0xnamehash2",
        "Platform",
        "Staff Engineer",
        bob,
        { from: owner }
      );

      const emp = await registry.getEmployee(1);
      assert.strictEqual(emp.nameHash, "0xnamehash2");
      assert.strictEqual(emp.department, "Platform");
      assert.strictEqual(emp.role, "Staff Engineer");
      assert.strictEqual(emp.walletAddress, bob);

      expectEvent(tx, "EmployeeUpdated", {
        employeeId: web3.utils.toBN(1),
        walletAddress: bob,
      });
    });

    it("reverts when the employee does not exist", async () => {
      await expectRevert.unspecified(
        registry.updateEmployee(
          99,
          "0xnamehash2",
          "Platform",
          "Staff Engineer",
          bob,
          { from: owner }
        )
      );
    });

    it("reverts when the employee is inactive", async () => {
      await registry.deactivateEmployee(1, { from: owner });
      await expectRevert.unspecified(
        registry.updateEmployee(
          1,
          "0xnamehash2",
          "Platform",
          "Staff Engineer",
          bob,
          { from: owner }
        )
      );
    });
  });

  describe("deactivateEmployee", () => {
    beforeEach(async () => {
      await registry.createEmployee(
        "0xnamehash1",
        "Engineering",
        "Backend Engineer",
        alice,
        { from: owner }
      );
    });

    it("flips isActive and emits EmployeeDeleted", async () => {
      const tx = await registry.deactivateEmployee(1, { from: owner });

      const emp = await registry.getEmployee(1);
      assert.strictEqual(emp.isActive, false);

      expectEvent(tx, "EmployeeDeleted", {
        employeeId: web3.utils.toBN(1),
      });
    });

    it("reverts when called twice", async () => {
      await registry.deactivateEmployee(1, { from: owner });
      await expectRevert.unspecified(
        registry.deactivateEmployee(1, { from: owner })
      );
    });

    it("reverts for non-owners", async () => {
      await expectRevert.unspecified(
        registry.deactivateEmployee(1, { from: stranger })
      );
    });
  });

  describe("getEmployee", () => {
    it("reverts for unknown ids", async () => {
      await expectRevert.unspecified(registry.getEmployee(42));
    });
  });
});
