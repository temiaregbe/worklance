// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title FreelanceMarketplace
 * @notice Proof-of-concept escrow contract for a decentralized freelance job.
 * @dev A client creates and funds a job, assigns a freelancer, receives a work
 * submission, and approves or rejects that submission. Approved work releases
 * the escrowed payment to the freelancer automatically.
 */
contract FreelanceMarketplace {
    enum JobState {
        Created,
        Funded,
        InProgress,
        Submitted,
        Completed,
        Cancelled
    }

    struct Job {
        uint256 jobId;
        string description;
        uint256 paymentAmount;
        address payable client;
        address payable freelancer;
        string workSubmission;
        JobState state;
        bool exists;
    }

    mapping(uint256 => Job) public jobs;

    event JobCreated(
        uint256 indexed jobId,
        address indexed client,
        string description,
        uint256 paymentAmount
    );
    event FreelancerAssigned(uint256 indexed jobId, address indexed freelancer);
    event PaymentDeposited(uint256 indexed jobId, uint256 amount);
    event WorkSubmitted(uint256 indexed jobId, address indexed freelancer, string submission);
    event WorkRejected(uint256 indexed jobId);
    event PaymentReleased(uint256 indexed jobId, address indexed freelancer, uint256 amount);
    event JobCancelled(uint256 indexed jobId);

    modifier jobExists(uint256 _jobId) {
        require(jobs[_jobId].exists, "Job does not exist");
        _;
    }

    modifier onlyClient(uint256 _jobId) {
        require(msg.sender == jobs[_jobId].client, "Only client can call this");
        _;
    }

    modifier onlyFreelancer(uint256 _jobId) {
        require(msg.sender == jobs[_jobId].freelancer, "Only freelancer can call this");
        _;
    }

    modifier inState(uint256 _jobId, JobState _state) {
        require(jobs[_jobId].state == _state, "Invalid job state");
        _;
    }

    /**
     * @notice Create a new freelance job.
     * @param _jobId Unique identifier for the job.
     * @param _description Description of the work to be completed.
     * @param _paymentAmount Amount of ETH, in wei, to be paid on completion.
     */
    function createJob(
        uint256 _jobId,
        string calldata _description,
        uint256 _paymentAmount
    ) external {
        require(!jobs[_jobId].exists, "Job ID already exists");
        require(bytes(_description).length > 0, "Description is required");
        require(_paymentAmount > 0, "Payment amount must be greater than zero");

        jobs[_jobId] = Job({
            jobId: _jobId,
            description: _description,
            paymentAmount: _paymentAmount,
            client: payable(msg.sender),
            freelancer: payable(address(0)),
            workSubmission: "",
            state: JobState.Created,
            exists: true
        });

        emit JobCreated(_jobId, msg.sender, _description, _paymentAmount);
    }

    /**
     * @notice Assign a freelancer to an existing job.
     * @param _jobId The job to update.
     * @param _freelancer Address of the freelancer.
     */
    function assignFreelancer(
        uint256 _jobId,
        address payable _freelancer
    ) external jobExists(_jobId) onlyClient(_jobId) {
        Job storage job = jobs[_jobId];

        require(_freelancer != address(0), "Invalid freelancer address");
        require(job.freelancer == address(0), "Freelancer already assigned");
        require(job.state == JobState.Created || job.state == JobState.Funded, "Cannot assign freelancer now");

        job.freelancer = _freelancer;

        if (job.state == JobState.Funded) {
            job.state = JobState.InProgress;
        }

        emit FreelancerAssigned(_jobId, _freelancer);
    }

    /**
     * @notice Deposit the agreed payment into escrow.
     * @dev The client must send exactly the payment amount in wei.
     * @param _jobId The job to fund.
     */
    function depositPayment(
        uint256 _jobId
    ) external payable jobExists(_jobId) onlyClient(_jobId) {
        Job storage job = jobs[_jobId];

        require(job.state == JobState.Created, "Job cannot be funded");
        require(msg.value == job.paymentAmount, "Incorrect payment amount");

        if (job.freelancer == address(0)) {
            job.state = JobState.Funded;
        } else {
            job.state = JobState.InProgress;
        }

        emit PaymentDeposited(_jobId, msg.value);
    }

    /**
     * @notice Submit completed work for client review.
     * @param _jobId The job being worked on.
     * @param _submission String reference to the submitted work, such as an IPFS hash.
     */
    function submitWork(
        uint256 _jobId,
        string calldata _submission
    )
        external
        jobExists(_jobId)
        onlyFreelancer(_jobId)
        inState(_jobId, JobState.InProgress)
    {
        require(bytes(_submission).length > 0, "Submission cannot be empty");

        Job storage job = jobs[_jobId];
        job.workSubmission = _submission;
        job.state = JobState.Submitted;

        emit WorkSubmitted(_jobId, msg.sender, _submission);
    }

    /**
     * @notice Approve the submitted work and release escrow to the freelancer.
     * @param _jobId The job to complete.
     */
    function approveWork(
        uint256 _jobId
    ) external jobExists(_jobId) onlyClient(_jobId) inState(_jobId, JobState.Submitted) {
        Job storage job = jobs[_jobId];
        uint256 amount = job.paymentAmount;
        address payable freelancer = job.freelancer;

        require(freelancer != address(0), "Freelancer not assigned");

        job.state = JobState.Completed;
        job.paymentAmount = 0;

        (bool success, ) = freelancer.call{value: amount}("");
        require(success, "Payment transfer failed");

        emit PaymentReleased(_jobId, freelancer, amount);
    }

    /**
     * @notice Reject submitted work and move the job back to in-progress.
     * @param _jobId The job under review.
     */
    function rejectWork(
        uint256 _jobId
    ) external jobExists(_jobId) onlyClient(_jobId) inState(_jobId, JobState.Submitted) {
        jobs[_jobId].state = JobState.InProgress;
        emit WorkRejected(_jobId);
    }

    /**
     * @notice Cancel a job before work has been submitted.
     * @dev If the job was funded, escrow is returned to the client.
     * @param _jobId The job to cancel.
     */
    function cancelJob(
        uint256 _jobId
    ) external jobExists(_jobId) onlyClient(_jobId) {
        Job storage job = jobs[_jobId];
        require(
            job.state == JobState.Created ||
                job.state == JobState.Funded ||
                job.state == JobState.InProgress,
            "Job cannot be cancelled"
        );

        uint256 refundAmount = 0;
        if (job.state == JobState.Funded || job.state == JobState.InProgress) {
            refundAmount = job.paymentAmount;
            job.paymentAmount = 0;
        }

        job.state = JobState.Cancelled;

        if (refundAmount > 0) {
            (bool success, ) = job.client.call{value: refundAmount}("");
            require(success, "Refund failed");
        }

        emit JobCancelled(_jobId);
    }

    /**
     * @notice Fetch the full details of a job.
     * @param _jobId The job ID to query.
     * @return The full Job struct for the given job ID.
     */
    function getJob(uint256 _jobId) external view jobExists(_jobId) returns (Job memory) {
        return jobs[_jobId];
    }
}
