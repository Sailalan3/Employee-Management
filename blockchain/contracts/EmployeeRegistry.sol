// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract EmployeeRegistry is Ownable {
    struct Employee {
        uint256 employeeId;
        string nameHash;
        string department;
        string role;
        address walletAddress;
        uint256 createdAt;
        bool isActive;
    }

    uint256 public employeeCount;
    mapping(uint256 => Employee) private employees;

    event EmployeeCreated(
        uint256 indexed employeeId,
        string nameHash,
        string department,
        string role,
        address indexed walletAddress,
        uint256 createdAt
    );

    event EmployeeUpdated(
        uint256 indexed employeeId,
        string nameHash,
        string department,
        string role,
        address indexed walletAddress
    );

    event EmployeeDeleted(uint256 indexed employeeId);

    error EmployeeNotFound(uint256 employeeId);
    error EmployeeInactive(uint256 employeeId);
    error InvalidWallet();

    constructor() Ownable(msg.sender) {}

    function createEmployee(
        string calldata nameHash,
        string calldata department,
        string calldata role,
        address walletAddress
    ) external onlyOwner returns (uint256) {
        if (walletAddress == address(0)) revert InvalidWallet();

        employeeCount += 1;
        uint256 newId = employeeCount;

        employees[newId] = Employee({
            employeeId: newId,
            nameHash: nameHash,
            department: department,
            role: role,
            walletAddress: walletAddress,
            createdAt: block.timestamp,
            isActive: true
        });

        emit EmployeeCreated(
            newId,
            nameHash,
            department,
            role,
            walletAddress,
            block.timestamp
        );

        return newId;
    }

    function updateEmployee(
        uint256 employeeId,
        string calldata nameHash,
        string calldata department,
        string calldata role,
        address walletAddress
    ) external onlyOwner {
        Employee storage emp = employees[employeeId];
        if (emp.employeeId == 0) revert EmployeeNotFound(employeeId);
        if (!emp.isActive) revert EmployeeInactive(employeeId);
        if (walletAddress == address(0)) revert InvalidWallet();

        emp.nameHash = nameHash;
        emp.department = department;
        emp.role = role;
        emp.walletAddress = walletAddress;

        emit EmployeeUpdated(employeeId, nameHash, department, role, walletAddress);
    }

    function deactivateEmployee(uint256 employeeId) external onlyOwner {
        Employee storage emp = employees[employeeId];
        if (emp.employeeId == 0) revert EmployeeNotFound(employeeId);
        if (!emp.isActive) revert EmployeeInactive(employeeId);

        emp.isActive = false;

        emit EmployeeDeleted(employeeId);
    }

    function getEmployee(uint256 employeeId)
        external
        view
        returns (Employee memory)
    {
        Employee memory emp = employees[employeeId];
        if (emp.employeeId == 0) revert EmployeeNotFound(employeeId);
        return emp;
    }
}
