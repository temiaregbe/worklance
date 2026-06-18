import { useMemo, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { JobDetailsCard } from "../components/JobDetailsCard";
import { JobMarketplaceBoard } from "../components/JobMarketplaceBoard";
import { Modal } from "../components/Modal";
import { ProposalPanel } from "../components/ProposalPanel";
import { ChatPanel } from "../components/ChatPanel";
import { TransactionLedger } from "../components/TransactionLedger";
import { ProfileCard } from "../components/ProfileCard";
import { formatBudgetLabel } from "../utils/currency";

const emptySubmissionForm = {
  jobId: "",
  submission: "",
  links: "",
  files: []
};

const freelancerSections = [
  { id: "browse", label: "Browse Jobs", icon: "briefcase" },
  { id: "proposal", label: "Submit Proposal", icon: "file" },
  { id: "delivery", label: "Deliver Work", icon: "send" },
  { id: "receipts", label: "Receipts", icon: "receipt" },
  { id: "messages", label: "Messages", icon: "message" }
];

function resolveOnChainJobId(job) {
  return String(job?.onChainJobId || job?.jobId || "");
}

export function FreelancerDashboardPage({
  account,
  currentUser,
  jobs,
  messages,
  transactions,
  fetchJob,
  submitProposal,
  respondToCounterOffer,
  sendChatMessage,
  submitWork,
  sendPaymentConfirmation,
  jobStates,
  isBusy,
  onOpenSettings,
  onSaveProfile
}) {
  const [activePanel, setActivePanel] = useState("");
  const [transactionsOpen, setTransactionsOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobDetails, setJobDetails] = useState(null);
  const [submissionForm, setSubmissionForm] = useState(emptySubmissionForm);
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [browseQuery, setBrowseQuery] = useState("");
  const [browseStatus, setBrowseStatus] = useState("all");

  const availableJobs = useMemo(
    () => jobs.filter((job) => job.status !== "Cancelled" && job.status !== "Completed"),
    [jobs]
  );

  const freelancerJobs = useMemo(
    () =>
      jobs.filter(
        (job) =>
          job.selectedFreelancerProfileId === currentUser?.profileId ||
          job.freelancerProfileId === currentUser?.profileId ||
          (
            !job.selectedFreelancerProfileId &&
            job.selectedFreelancer?.toLowerCase() === currentUser?.wallet?.toLowerCase()
          ) ||
          (
            !job.freelancerProfileId &&
            job.freelancerWallet?.toLowerCase() === currentUser?.wallet?.toLowerCase()
          )
      ),
    [jobs, currentUser]
  );

  const freelancerActiveJobs = useMemo(
    () => freelancerJobs.filter((job) => !["Completed", "Cancelled"].includes(job.status)),
    [freelancerJobs]
  );

  const completedFreelancerJobs = useMemo(
    () => freelancerJobs.filter((job) => job.status === "Completed"),
    [freelancerJobs]
  );

  const submittedProposalJobs = useMemo(
    () =>
      jobs.filter((job) =>
        (job.proposals || []).some(
          (proposal) =>
            proposal.freelancerProfileId === currentUser?.profileId ||
            proposal.freelancerWallet?.toLowerCase() === currentUser?.wallet?.toLowerCase()
        )
      ),
    [jobs, currentUser]
  );

  const deliverableJobs = useMemo(
    () =>
      freelancerJobs.filter(
        (job) =>
          Boolean(job.smartContract) &&
          Boolean(resolveOnChainJobId(job)) &&
          Boolean(job.selectedFreelancer) &&
          !["Completed", "Cancelled"].includes(job.status)
      ),
    [freelancerJobs]
  );

  const browseJobs = useMemo(() => {
    const query = browseQuery.trim().toLowerCase();

    return availableJobs.filter((job) => {
      const matchesStatus =
        browseStatus === "all" ? true : (job.status || "Open").toLowerCase() === browseStatus;
      const haystack = [job.title, job.description, job.paymentAmountEth, job.deadline]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = query ? haystack.includes(query) : true;
      return matchesStatus && matchesQuery;
    });
  }, [availableJobs, browseQuery, browseStatus]);

  function evaluateDeliveryReadiness(nextDetails) {
    if (nextDetails.freelancer?.toLowerCase() !== account?.toLowerCase()) {
      return "This job is not assigned to the connected freelancer wallet.";
    }

    if (nextDetails.state !== 2) {
      return "This job is not yet ready for delivery. It must be funded and assigned first.";
    }

    return "Job confirmed. You can submit work now.";
  }

  async function handleSelectJob(job) {
    setSelectedJob(job);
    const chainJobId = resolveOnChainJobId(job);
    setSubmissionForm((current) => ({ ...current, jobId: chainJobId }));
    try {
      const nextDetails = await fetchJob(chainJobId);
      setJobDetails(nextDetails);
      setDeliveryStatus(evaluateDeliveryReadiness(nextDetails));
    } catch {
      setJobDetails(null);
      setDeliveryStatus("Contract details are not available for this job yet.");
    }
  }

  async function handleLoadDeliveryJob() {
    const nextJobId = submissionForm.jobId.trim() || resolveOnChainJobId(selectedJob);

    if (!nextJobId) {
      setDeliveryStatus("Enter a job ID first.");
      return;
    }

    try {
      const nextDetails = await fetchJob(nextJobId);
      setJobDetails(nextDetails);
      setSubmissionForm((current) => ({ ...current, jobId: nextJobId }));
      setDeliveryStatus(evaluateDeliveryReadiness(nextDetails));
    } catch {
      setJobDetails(null);
      setDeliveryStatus("Could not load that job from the contract.");
    }
  }

  async function handleSubmitWork(event) {
    event.preventDefault();
    let confirmedDetails = jobDetails;

    if (!confirmedDetails) {
      const nextJobId = submissionForm.jobId.trim() || resolveOnChainJobId(selectedJob);

      if (!nextJobId) {
        setDeliveryStatus("Select an assigned job before submitting work.");
        return;
      }

      try {
        confirmedDetails = await fetchJob(nextJobId);
        setJobDetails(confirmedDetails);
        setSubmissionForm((current) => ({ ...current, jobId: nextJobId }));
      } catch {
        setDeliveryStatus("Could not load the contract details for this job.");
        return;
      }
    }

    if (!submissionForm.submission.trim()) {
      setDeliveryStatus("Add a delivery link or IPFS hash before submitting.");
      return;
    }

    if (confirmedDetails.freelancer?.toLowerCase() !== account?.toLowerCase()) {
      setDeliveryStatus("This connected wallet is not the assigned freelancer for the job.");
      return;
    }

    if (confirmedDetails.state !== 2) {
      setDeliveryStatus("The job must be in progress before work can be submitted.");
      return;
    }

    const success = await submitWork(submissionForm);
    if (success) {
      setDeliveryStatus("Work submitted successfully.");
      try {
        setJobDetails(await fetchJob(submissionForm.jobId));
      } catch {
        // Keep the success message even if refresh fails.
      }
    }
  }

  async function handleOpenJob(job, nextPanel = "proposal") {
    setActivePanel(nextPanel);
    await handleSelectJob(job);
  }

  return (
    <main className="page-layout role-layout">
      <section className="dashboard-page-shell">
        <section className="dashboard-workspace-banner">
          <Link className="brand-lockup brand-lockup-simple" to="/">
            <span className="brand-mark brand-mark-simple">W</span>
            <span className="brand-title">WorkLance</span>
          </Link>
          <div className="dashboard-workspace-actions">
            <nav className="topbar-nav" aria-label="Workspace navigation">
              <NavLink to="/" className={({ isActive }) => (isActive ? "topbar-nav-link active" : "topbar-nav-link")}>
                Home
              </NavLink>
              <a className="topbar-nav-link" href="/#about">
                About
              </a>
              <Link className="topbar-nav-link" to="/freelancer">
                Browse Jobs
              </Link>
            </nav>
            <button className="dashboard-settings-button" type="button" onClick={onOpenSettings}>
              <DashboardNavIcon icon="settings" />
              Settings
            </button>
          </div>
        </section>

        <section className="dashboard-body-shell">
          <aside className="dashboard-rail" aria-label="Freelancer actions">
            {freelancerSections.map((section) =>
              {
                const isDeliveryLocked = section.id === "delivery" && deliverableJobs.length === 0;
                return (
              <button
                key={section.id}
                type="button"
                className={
                  activePanel === section.id
                    ? "dashboard-rail-item active"
                    : `dashboard-rail-item${isDeliveryLocked ? " disabled" : ""}`
                }
                onClick={() => {
                  if (isDeliveryLocked) {
                    return;
                  }
                  setActivePanel(section.id);
                }}
                disabled={isDeliveryLocked}
              >
                <DashboardNavIcon icon={section.icon} />
                {section.label}
              </button>
                );
              }
            )}
          </aside>

          <section className="dashboard-content-flow">
        <section className="dashboard-main">
          {!activePanel && (
            <section className="content-card clean-panel">
              <ProfileCard
                title="Freelancer Profile"
                user={currentUser}
                compact
                editable
                onSave={onSaveProfile}
                stats={{
                  jobs: freelancerJobs.length,
                  active: freelancerActiveJobs.length,
                  rating: "0.0"
                }}
                onViewJobs={() => setActivePanel("browse")}
                onViewActive={() => setActivePanel("delivery")}
              />
            </section>
          )}

          {activePanel === "browse" && (
              <section className="content-card clean-panel browse-board-panel browse-board-full">
                <div className="browse-board-head">
                  <div className="browse-board-head-row">
                    <div>
                      <h3>Browse Jobs</h3>
                      <p className="helper-copy wide-copy">
                        Discover projects looking for skilled freelancers.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="browse-search-row">
                  <input
                    className="browse-search-input"
                    type="text"
                    value={browseQuery}
                    onChange={(event) => setBrowseQuery(event.target.value)}
                    placeholder="Search jobs, skills, keywords..."
                  />
                  <button className="browse-filter-button" type="button">
                    Filters
                  </button>
                </div>

                <div className="browse-filter-row">
                  <div className="browse-filter-pills">
                    {[
                      { id: "all", label: "All Status" },
                      { id: "open", label: "Open" },
                      { id: "in progress", label: "In Progress" },
                      { id: "completed", label: "Completed" }
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={
                          browseStatus === option.id
                            ? "browse-filter-pill active"
                            : "browse-filter-pill"
                        }
                        onClick={() => setBrowseStatus(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <span className="browse-results-copy">{browseJobs.length} jobs found</span>
                </div>

                <JobMarketplaceBoard
                  jobs={browseJobs}
                  mode="browse"
                  showAction={false}
                  onSelectJob={(job) => handleOpenJob(job, "proposal")}
                />
              </section>
          )}

          {activePanel === "proposal" && (
            <section className="content-card clean-panel">
              <div className="panel-head">
                <div>
                  <p className="section-kicker">Proposal Submission</p>
                  <h3>{selectedJob ? "Submit a proposal" : "Available jobs"}</h3>
                </div>
                {selectedJob ? (
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setSelectedJob(null)}
                  >
                    Back to jobs
                  </button>
                ) : null}
              </div>
              {!selectedJob ? (
                <>
                  <JobMarketplaceBoard
                    jobs={availableJobs}
                    onSelectJob={(job) => handleOpenJob(job, "proposal")}
                    actionLabel="Open Job"
                  />
                  <section className="proposal-history-shell">
                    <div className="panel-head">
                      <div>
                        <p className="section-kicker">Previous Submissions</p>
                        <h3>Jobs you already proposed for</h3>
                      </div>
                    </div>
                    <JobMarketplaceBoard
                      jobs={submittedProposalJobs}
                      mode="client"
                      onSelectJob={(job) => handleOpenJob(job, "proposal")}
                      showAction={false}
                      variant="proposal-review"
                    />
                  </section>
                </>
              ) : (
                <ProposalPanel
                  currentUser={currentUser}
                  selectedJob={selectedJob}
                  onRespondToCounterOffer={async (jobId, proposalId, response) => {
                    const updatedJob = await respondToCounterOffer(jobId, proposalId, response);
                    setSelectedJob(updatedJob);
                  }}
                  onSubmitProposal={async (jobId, proposal) =>
                    submitProposal(jobId, {
                      ...proposal,
                      freelancerWallet: account,
                      freelancerName: currentUser?.name || "Freelancer",
                      freelancerUsername: currentUser?.username || ""
                    })
                  }
                  isBusy={isBusy}
                />
              )}
            </section>
          )}

          {activePanel === "delivery" && (
            <section className="content-card clean-panel">
              <div className="panel-head">
                <div>
                  <p className="section-kicker">Work Submission</p>
                  <h3>{selectedJob ? "Deliver work" : "Assigned jobs"}</h3>
                </div>
                {selectedJob ? (
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      setSelectedJob(null);
                      setJobDetails(null);
                      setSubmissionForm(emptySubmissionForm);
                      setDeliveryStatus("");
                    }}
                  >
                    Back to jobs
                  </button>
                ) : null}
              </div>
              {!selectedJob ? (
                <>
                  {deliverableJobs.length === 0 ? (
                    <p className="helper-copy wide-copy">
                      Deliver work becomes available after a client reviews your proposal, selects you, and creates the job agreement.
                    </p>
                  ) : null}
                  <JobMarketplaceBoard
                    jobs={deliverableJobs}
                    onSelectJob={(job) => handleOpenJob(job, "delivery")}
                    actionLabel="Deliver Job"
                    variant="proposal-review"
                  />
                </>
              ) : (
                <>
                  {jobDetails ? (
                    <JobDetailsCard
                      job={jobDetails}
                      jobStates={jobStates}
                      isBusy={isBusy}
                    />
                  ) : (
                    <section className="content-card job-details-card">
                      <div className="card-heading-row">
                        <div>
                          <p className="section-kicker">Selected Job</p>
                          <h3>{selectedJob.title}</h3>
                        </div>
                        <span className="state-badge">{selectedJob.status || "Assigned"}</span>
                      </div>
                      <div className="detail-grid">
                        <article>
                          <span>Job ID</span>
                          <strong>{selectedJob.jobId}</strong>
                        </article>
                        <article>
                          <span>Budget</span>
                          <strong>{formatBudgetLabel(selectedJob)}</strong>
                        </article>
                        <article>
                          <span>Deadline</span>
                          <strong>{selectedJob.deadline || "Not set"}</strong>
                        </article>
                        <article>
                          <span>Assignment</span>
                          <strong>{selectedJob.selectedFreelancerName || "Assigned to you"}</strong>
                        </article>
                      </div>
                    </section>
                  )}
                  <form className="form-grid" onSubmit={handleSubmitWork}>
                    <label>
                      Contract Job ID
                      <input type="text" value={submissionForm.jobId} readOnly />
                    </label>
                    <div className="delivery-actions-inline">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={handleLoadDeliveryJob}
                      >
                        Refresh Contract Details
                      </button>
                    </div>
                    <label className="span-2">
                      Delivery Link or IPFS Hash
                      <textarea
                        rows="5"
                        value={submissionForm.submission}
                        onChange={(event) =>
                          setSubmissionForm({ ...submissionForm, submission: event.target.value })
                        }
                        required
                      />
                    </label>
                    <label className="span-2">
                      Project Links
                      <textarea
                        rows="3"
                        value={submissionForm.links}
                        onChange={(event) =>
                          setSubmissionForm({ ...submissionForm, links: event.target.value })
                        }
                        placeholder="Add one link per line for Figma, GitHub, Drive, Loom, live preview, or other deliverables."
                      />
                    </label>
                    <label className="span-2">
                      Upload Project Files
                      <input
                        type="file"
                        multiple
                        onChange={(event) =>
                          setSubmissionForm({
                            ...submissionForm,
                            files: Array.from(event.target.files || [])
                          })
                        }
                      />
                    </label>
                    {submissionForm.files.length ? (
                      <div className="span-2 delivery-upload-list">
                        {submissionForm.files.map((file) => (
                          <span key={`${file.name}-${file.size}`} className="upload-chip">
                            {file.name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="span-2">
                      <button className="primary-button" type="submit" disabled={isBusy}>
                        Submit Work
                      </button>
                    </div>
                  </form>
                  {deliveryStatus ? <p className="helper-copy wide-copy">{deliveryStatus}</p> : null}
                </>
              )}
            </section>
          )}

          {activePanel === "receipts" && (
            <section className="content-card clean-panel">
              <div className="panel-head">
                <div>
                  <p className="section-kicker">Payment Records</p>
                  <h3>Receipts and confirmations</h3>
                </div>
              </div>

              {completedFreelancerJobs.length === 0 ? (
                <p className="helper-copy wide-copy">
                  Completed jobs will appear here after the client approves your submitted work and releases payment.
                </p>
              ) : (
                <div className="receipt-list">
                  {completedFreelancerJobs.map((job) => (
                    <article className="receipt-card" key={job.jobId}>
                      <div>
                        <p className="section-kicker">Completed Job</p>
                        <h4>{job.title || `Job #${job.jobId}`}</h4>
                        <p className="helper-copy">
                          Job ID: {job.jobId} · Amount: {formatBudgetLabel(job)}
                        </p>
                        <p className="helper-copy">
                          Client: {job.clientName || job.clientUsername || "Client"}
                        </p>
                      </div>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={isBusy}
                        onClick={() => sendPaymentConfirmation?.(job.jobId)}
                      >
                        Send Receipt
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {activePanel === "messages" && (
            <section className="content-card clean-panel">
              <div className="panel-head">
                <div>
                  <p className="section-kicker">Messages</p>
                  <h3>Chat with clients</h3>
                </div>
              </div>
              <ChatPanel
                jobs={freelancerJobs.length ? freelancerJobs : availableJobs}
                selectedJob={selectedJob}
                onSelectJob={(job) => handleOpenJob(job, "messages")}
                currentUser={currentUser}
                account={account}
                messages={messages}
                onSendMessage={sendChatMessage}
                isBusy={isBusy}
                mode="freelancer"
              />
            </section>
          )}
        </section>
          </section>
        </section>
      </section>

      <Modal
        title="Transaction Activity"
        isOpen={transactionsOpen}
        onClose={() => setTransactionsOpen(false)}
      >
        <TransactionLedger records={transactions} />
      </Modal>
    </main>
  );
}

function DashboardNavIcon({ icon }) {
  const icons = {
    home: (
      <path
        d="M3 8.5 8 4l5 4.5M4.5 7.5V13h7V7.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    ),
    briefcase: (
      <>
        <rect x="2.5" y="4.5" width="11" height="8.5" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5.5 4.5V3.7c0-.7.5-1.2 1.2-1.2h2.6c.7 0 1.2.5 1.2 1.2v.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2.5 8h11" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </>
    ),
    file: (
      <>
        <path d="M4 2.7h5l3 3V13H4Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4" />
        <path d="M9 2.7v3h3M5.7 8h4.6M5.7 10.1h4.6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
      </>
    ),
    check: (
      <>
        <circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="m5.6 8.2 1.6 1.6 3.2-3.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
      </>
    ),
    send: (
      <path
        d="m2.8 8 10-4.2-2.9 8.4-2.1-2.1L6 11.8 5.4 9.2Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    ),
    receipt: (
      <>
        <path d="M4 2.8h8v10.4l-1.4-.9-1.3.9-1.3-.9-1.3.9-1.3-.9-1.4.9Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4" />
        <path d="M6 6h4M6 8h4M6 10h2.6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
      </>
    ),
    message: (
      <>
        <path d="M3 4.5h10v6.3H8.2L5.4 13v-2.2H3Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4" />
        <path d="M5.3 6.7h5.4M5.3 8.7h3.7" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
      </>
    ),
    settings: (
      <>
        <circle cx="8" cy="8" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 2.5v1.4M8 12.1v1.4M13.5 8h-1.4M3.9 8H2.5M11.9 4.1 11 5M5 11l-.9.9M11.9 11.9 11 11M5 5 .1 4.1" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
      </>
    )
  };

  return (
    <span className="dashboard-nav-icon" aria-hidden="true">
      <svg viewBox="0 0 16 16" focusable="false">
        {icons[icon]}
      </svg>
    </span>
  );
}
