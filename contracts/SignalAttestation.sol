// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SignalAttestation {
    struct Report {
        bytes32 reportHash;
        bytes32 evidenceHash;
        string topic;
        uint8 riskScore;
        uint8 alphaScore;
        string verdict;
        string metadataURI;
        address creator;
        uint256 createdAt;
    }

    uint256 public reportCount;
    mapping(uint256 => Report) public reports;

    event ReportAttested(
        uint256 indexed reportId,
        address indexed creator,
        string topic,
        uint8 riskScore,
        uint8 alphaScore,
        string verdict,
        bytes32 reportHash,
        bytes32 evidenceHash,
        string metadataURI,
        uint256 createdAt
    );

    function attest(
        bytes32 reportHash,
        bytes32 evidenceHash,
        string calldata topic,
        uint8 riskScore,
        uint8 alphaScore,
        string calldata verdict,
        string calldata metadataURI
    ) external returns (uint256 reportId) {
        require(reportHash != bytes32(0), "reportHash required");
        require(evidenceHash != bytes32(0), "evidenceHash required");
        require(bytes(topic).length > 0, "topic required");
        require(riskScore <= 100, "riskScore > 100");
        require(alphaScore <= 100, "alphaScore > 100");
        require(bytes(verdict).length > 0, "verdict required");

        reportId = ++reportCount;
        uint256 createdAt = block.timestamp;

        reports[reportId] = Report({
            reportHash: reportHash,
            evidenceHash: evidenceHash,
            topic: topic,
            riskScore: riskScore,
            alphaScore: alphaScore,
            verdict: verdict,
            metadataURI: metadataURI,
            creator: msg.sender,
            createdAt: createdAt
        });

        emit ReportAttested(
            reportId,
            msg.sender,
            topic,
            riskScore,
            alphaScore,
            verdict,
            reportHash,
            evidenceHash,
            metadataURI,
            createdAt
        );
    }

    function getReport(uint256 reportId) external view returns (Report memory) {
        require(reportId > 0 && reportId <= reportCount, "report not found");
        return reports[reportId];
    }
}
