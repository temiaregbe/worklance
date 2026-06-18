import { useEffect, useMemo, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { FileManager } from "../components/FileManager";
import { JobDetailsCard } from "../components/JobDetailsCard";
import { JobMarketplaceBoard } from "../components/JobMarketplaceBoard";
import { ProposalPanel } from "../components/ProposalPanel";
import { ChatPanel } from "../components/ChatPanel";
import { ProfileCard } from "../components/ProfileCard";
import { formatBudgetLabel, normalizeEthAmount, supportedCurrencies } from "../utils/currency";

const emptyListing = {
  title: "",
  description: "",
  deadline: "",
  paymentAmountValue: "",
  paymentCurrency: "ETH",
  paymentAmountEth: ""
};

const emptyAssignForm = {
  jobId: "",
  freelancer: ""
};

const clientSections = [
  { id: "listing", label: "Post Job", icon: "briefcase" },
  { id: "proposals", label: "Review Proposals", icon: "inbox" },
  { id: "contract", label: "Assign Freelancer", icon: "user" },
  { id: "escrow", label: "Escrow & Approval", icon: "shield" },
  { id: "messages", label: "Messages", icon: "message" }
];

function resolveOnChainJobId(job) {
  return String(job?.onChainJobId || job?.jobId || "");
}

function resolveEscrowAmount(job) {
  if (!job) {
    return "0";
  }

  if (job.agreedProposalAmountEth) {
    return String(job.agreedProposalAmountEth);
  }

  const selectedProposal = (job.proposals || []).find(
    (proposal) => proposal.id === job.selectedProposalId
  );

  if (selectedProposal?.negotiationStatus === "accepted" && selectedProposal.counterAmountEth) {
    return String(selectedProposal.counterAmountEth);
  }

  if (selectedProposal?.bidAmountEth) {
    return String(selectedProposal.bidAmountEth);
  }

  return String(job.paymentAmountEth || "0");
}

function resolveSelectedFreelancerWallet(job) {
  if (!job) {
    return "";
  }

  const selectedProposal = (job.proposals || []).find(
    (proposal) => proposal.id === job.selectedProposalId
  );

  return String(selectedProposal?.freelancerWallet || job.selectedFreelancer || "");
}

export function ClientDashboardPage({
  account,
  currentUser,
  status,
  jobs,
  messages,
  createJob,
  createListing,
  editListing,
  assignFreelancer,
  attachSmartContract,
  depositPayment,
  approveWork,
  rejectWork,
  cancelJob,
  saveFileRecord,
  sendChatMessage,
  sendClientReceipt,
  selectProposal,
  updateProposalOffer,
  fetchJob,
  jobStates,
  isBusy,
  onOpenSettings,
  onSaveProfile
}) {
  const [activePanel, setActivePanel] = useState("");
  const [listingForm, setListingForm] = useState(emptyListing);
  const [assignForm, setAssignForm] = useState(emptyAssignForm);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobOverview, setJobOverview] = useState(null);
  const [postJobFilesOpen, setPostJobFilesOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState("");
  const [assignmentFeedback, setAssignmentFeedback] = useState("");
  const [listingFeedback, setListingFeedback] = useState("");

  function getResolvedFreelancer(job) {
    return (
      job?.selectedFreelancer ||
      ""
    );
  }

  const clientJobs = useMemo(
    () =>
      jobs.filter(
        (job) =>
          !currentUser ||
          job.clientProfileId === currentUser.profileId ||
          (
            !job.clientProfileId &&
            job.clientWallet?.toLowerCase() === currentUser.wallet.toLowerCase()
          )
      ),
    [jobs, currentUser]
  );

  const clientActiveJobs = useMemo(
    () => clientJobs.filter((job) => !["Completed", "Cancelled"].includes(job.status)),
    [clientJobs]
  );

  const escrowJobs = useMemo(
    () =>
      clientJobs.filter(
        (job) =>
          Boolean(job.onChainVerified) &&
          Boolean(job.smartContract) &&
          Boolean(resolveOnChainJobId(job)) &&
          !["Cancelled"].includes(job.status)
      ),
    [clientJobs]
  );

  const nextJobId = useMemo(() => {
    if (jobs.length === 0) {
      return "1";
    }

    const maxJobId = jobs.reduce((max, job) => {
      const nextId = Number(job.jobId) || 0;
      return Math.max(max, nextId);
    }, 0);

    return String(maxJobId + 1);
  }, [jobs]);

  useEffect(() => {
    if (!selectedJob) {
      return;
    }

    const freshJob = jobs.find((job) => String(job.jobId) === String(selectedJob.jobId));
    if (!freshJob) {
      return;
    }

    setSelectedJob(freshJob);
    setAssignForm((current) => ({
      ...current,
      jobId: resolveOnChainJobId(freshJob),
      freelancer: getResolvedFreelancer(freshJob) || current.freelancer
    }));
  }, [jobs, selectedJob]);

  async function handleCreateListing(event) {
    event.preventDefault();
    setListingFeedback("");

    try {
      if (editingJobId) {
        const updatedListing = await editListing(editingJobId, {
          title: listingForm.title,
          description: listingForm.description,
          deadline: listingForm.deadline,
          paymentAmountValue: listingForm.paymentAmountValue,
          paymentCurrency: listingForm.paymentCurrency,
          paymentAmountEth: listingForm.paymentAmountEth
        });
        setSelectedJob(updatedListing);
        setListingForm(emptyListing);
        setEditingJobId("");
        setListingFeedback(`Listing #${updatedListing.jobId} updated successfully.`);
        return;
      }

    const nextJob = {
      ...listingForm,
      paymentAmountEth: normalizeEthAmount(listingForm.paymentAmountValue, listingForm.paymentCurrency),
      jobId: nextJobId,
      clientWallet: account,
      clientName: currentUser?.name || "Client",
      clientUsername: currentUser?.username || "",
      status: "Open"
    };

      const nextListing = await createListing({
        ...nextJob,
        onChainJobId: "",
        onChainVerified: false,
        status: "Open"
      });
      setSelectedJob(nextListing);
      setAssignForm((current) => ({ ...current, jobId: "" }));
      setListingForm(emptyListing);
      setListingFeedback(`Job #${nextJobId} published successfully.`);
    } catch (error) {
      setListingFeedback(error?.message || "Could not save listing changes.");
    }
  }

  function handleEditListing(job) {
    setEditingJobId(String(job.jobId));
    setListingFeedback("");
    setListingForm({
      title: job.title || "",
      description: job.description || "",
      deadline: job.deadline || "",
      paymentAmountValue: job.paymentAmountValue || job.paymentAmountEth || "",
      paymentCurrency: job.paymentCurrency || "ETH",
      paymentAmountEth: job.paymentAmountEth || ""
    });
    setSelectedJob(job);
    setPostJobFilesOpen(false);
  }

  async function handleSelectProposal(jobId, proposalId) {
    const proposal = (selectedJob?.proposals || []).find((item) => item.id === proposalId);
    if (proposal?.negotiationStatus === "pending") {
      setAssignmentFeedback("Wait for the freelancer to accept or decline the counter offer before selecting.");
      return;
    }

    if (proposal?.negotiationStatus === "declined") {
      setAssignmentFeedback("This counter offer was declined. Send another offer before selecting this freelancer.");
      return;
    }

    const updatedJob = await selectProposal(jobId, proposalId);
    setSelectedJob(updatedJob);
    setAssignForm({
      jobId: resolveOnChainJobId(updatedJob),
      freelancer: getResolvedFreelancer(updatedJob)
    });

    setActivePanel("contract");
  }

  async function handleCounterOffer(jobId, proposalId, updates) {
    const updatedJob = await updateProposalOffer(jobId, proposalId, updates);
    setSelectedJob(updatedJob);
    setAssignmentFeedback("Counter offer saved. Select the freelancer when both sides agree.");
    return updatedJob;
  }

  async function handleAssignFreelancer() {
    setAssignmentFeedback("");

    const freelancerWallet = resolveSelectedFreelancerWallet(selectedJob);

    if (!selectedJob?.jobId || !freelancerWallet.trim()) {
      setAssignmentFeedback("Select a freelancer first so the job and wallet are ready.");
      return;
    }

    let jobForAssignment = selectedJob;
    const chainJobId = resolveOnChainJobId(jobForAssignment) || String(jobForAssignment.jobId);
    const agreementAmountEth = resolveEscrowAmount(jobForAssignment);

    if (!Number.isFinite(Number(agreementAmountEth)) || Number(agreementAmountEth) <= 0) {
      setAssignmentFeedback("Select a valid proposal amount before creating the smart contract.");
      return;
    }

    if (!jobForAssignment.onChainVerified) {
      const created = await createJob({
        jobId: chainJobId,
        description: jobForAssignment.description,
        paymentAmount: agreementAmountEth
      });

      if (!created) {
        setAssignmentFeedback("The on-chain contract could not be created. Check MetaMask and try again.");
        return;
      }

      jobForAssignment = await attachSmartContract(jobForAssignment.jobId, {
        milestones: ["Delivery"],
        paymentTerms: `${agreementAmountEth} ETH on approval`,
        agreementDate: new Date().toISOString(),
        selectedFreelancer: freelancerWallet,
        agreedAmountEth: agreementAmountEth
      });
      setSelectedJob(jobForAssignment);
    }

    const result = await assignFreelancer({
      jobId: chainJobId,
      freelancer: freelancerWallet
    });
    if (result?.success) {
      setAssignmentFeedback(result.message || "Freelancer assigned successfully on-chain.");
      setAssignForm(emptyAssignForm);
      setSelectedJob((current) => ({
        ...(current || jobForAssignment),
        ...jobForAssignment,
        selectedFreelancer: freelancerWallet,
        status: "Freelancer Assigned"
      }));
      await loadOnChainJob(chainJobId);
      setActivePanel("escrow");
      return;
    }

    setAssignmentFeedback(
      result?.message ||
      status ||
      "Assignment failed. Check wallet connection, job setup, and contract state."
    );
  }

  function handleManageListing(job, nextPanel = activePanel) {
    setSelectedJob(job);
    setJobOverview(null);
    setAssignForm((current) => ({
      ...current,
      jobId: resolveOnChainJobId(job),
      freelancer: getResolvedFreelancer(job) || current.freelancer
    }));
    setActivePanel(nextPanel);
  }

  function handleSectionChange(sectionId) {
    if (sectionId === "contract") {
      const assignableJob =
        selectedJob?.selectedFreelancer
          ? selectedJob
          : clientJobs.find(
              (job) =>
                Boolean(job.selectedFreelancer) &&
                !["Completed", "Cancelled"].includes(job.status)
            );

      if (assignableJob) {
        handleManageListing(assignableJob, "contract");
        setAssignmentFeedback("");
        return;
      }

      setAssignmentFeedback("Select a job in Review Proposals and choose a freelancer first.");
      setActivePanel("proposals");
      return;
    }

    setActivePanel(sectionId);
  }

  async function loadOnChainJob(jobId) {
    try {
      setJobOverview(await fetchJob(jobId));
    } catch {
      setJobOverview(null);
    }
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
          <aside className="dashboard-rail" aria-label="Client actions">
            {clientSections.map((section) =>
              <button
                key={section.id}
                type="button"
                className={
                  activePanel === section.id
                    ? "dashboard-rail-item active"
                    : "dashboard-rail-item"
                }
                onClick={() => handleSectionChange(section.id)}
              >
                <DashboardNavIcon icon={section.icon} />
                {section.label}
              </button>
            )}
          </aside>

          <section className="dashboard-content-flow">
        <section className="dashboard-main">
          {!activePanel && (
            <section className="content-card clean-panel">
              <ProfileCard
                title="Client Profile"
                user={currentUser}
                compact
                editable
                onSave={onSaveProfile}
                stats={{
                  jobs: clientJobs.length,
                  active: clientActiveJobs.length,
                  rating: "0.0"
                }}
                onViewJobs={() => setActivePanel("listing")}
                onViewActive={() => setActivePanel("escrow")}
              />
            </section>
          )}

          {activePanel === "listing" && (
            <section className="content-card clean-panel browse-board-full">
              <div className="panel-head">
                <div>
                  <p className="section-kicker">Job Posting</p>
                  <h3>Create a new listing</h3>
                </div>
              </div>

              <form className="form-grid" onSubmit={handleCreateListing}>
                <label>
                  Job Title
                  <input
                    value={listingForm.title}
                    onChange={(event) => setListingForm({ ...listingForm, title: event.target.value })}
                    required
                  />
                </label>
                <label>
                  {editingJobId ? "Editing Job ID" : "Generated Job ID"}
                  <input type="text" value={editingJobId || nextJobId} readOnly />
                </label>
                <label className="span-2">
                  Project Description
                  <textarea
                    rows="5"
                    value={listingForm.description}
                    onChange={(event) =>
                      setListingForm({ ...listingForm, description: event.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Deadline
                  <input
                    type="date"
                    value={listingForm.deadline}
                    onChange={(event) => setListingForm({ ...listingForm, deadline: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Payment Amount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={listingForm.paymentAmountValue}
                    onChange={(event) =>
                      setListingForm((current) => ({
                        ...current,
                        paymentAmountValue: event.target.value,
                        paymentAmountEth: normalizeEthAmount(event.target.value, current.paymentCurrency)
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  Currency
                  <select
                    value={listingForm.paymentCurrency}
                    onChange={(event) =>
                      setListingForm((current) => ({
                        ...current,
                        paymentCurrency: event.target.value,
                        paymentAmountEth: normalizeEthAmount(current.paymentAmountValue, event.target.value)
                      }))
                    }
                  >
                    {supportedCurrencies.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="helper-copy wide-copy span-2">
                  Approximate on-chain escrow value: {listingForm.paymentAmountEth || "0"} ETH
                </p>
                <div className="span-2 action-row">
                  <button className="primary-button" type="submit" disabled={isBusy || !currentUser}>
                    {editingJobId ? "Save Listing Changes" : "Publish Job"}
                  </button>
                  {editingJobId ? (
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      setEditingJobId("");
                      setListingForm(emptyListing);
                      setListingFeedback("");
                    }}
                  >
                    Cancel Edit
                  </button>
                  ) : null}
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setPostJobFilesOpen((current) => !current)}
                  >
                    {postJobFilesOpen ? "Hide file upload" : "Add project files"}
                  </button>
                </div>
                {listingFeedback ? (
                  <p className="helper-copy wide-copy span-2">{listingFeedback}</p>
                ) : null}
              </form>

              {postJobFilesOpen && (
                <FileManager
                  selectedJob={selectedJob}
                  onSaveFile={saveFileRecord}
                  isBusy={isBusy}
                  title="Project files"
                  heading="Attach supporting files"
                  emptyMessage="Publish or select a job first to attach briefs, reference files, or supporting documents."
                />
              )}

              <section className="listing-management-shell">
                <div className="panel-head">
                  <div>
                    <p className="section-kicker">Your Listings</p>
                    <h3>Edit posted jobs</h3>
                  </div>
                </div>
                <JobMarketplaceBoard
                  jobs={clientJobs}
                  mode="client"
                  actionLabel="Edit Listing"
                  onSelectJob={handleEditListing}
                />
              </section>
            </section>
          )}

          {activePanel === "proposals" && (
            <section className="content-card clean-panel">
              <div className="panel-head">
                <div>
                  <p className="section-kicker">Freelancer Selection</p>
                  <h3>{selectedJob ? "Review proposals" : "Posted jobs"}</h3>
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
              {!selectedJob && assignmentFeedback ? (
                <p className="helper-copy wide-copy">{assignmentFeedback}</p>
              ) : null}
              {!selectedJob ? (
                <JobMarketplaceBoard
                  jobs={clientJobs}
                  onSelectJob={(job) => handleManageListing(job, "proposals")}
                  mode="client"
                  variant="proposal-review"
                />
              ) : (
                <ProposalPanel
                  mode="client"
                  selectedJob={selectedJob}
                  onSelectProposal={handleSelectProposal}
                  onCounterOffer={handleCounterOffer}
                />
              )}
            </section>
          )}

          {activePanel === "contract" && (
            <section className="content-card clean-panel">
              <div className="panel-head">
                <div>
                  <p className="section-kicker">Smart Contract Setup</p>
                  <h3>{selectedJob ? "Confirm assignment" : "Assign the selected freelancer"}</h3>
                </div>
                {selectedJob ? (
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setActivePanel("proposals")}
                  >
                    Back to proposals
                  </button>
                ) : null}
              </div>
              {!selectedJob ? (
                <section className="assignment-shell-empty">
                  <p className="helper-copy wide-copy">
                    Select a freelancer from the proposal review flow first.
                  </p>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => setActivePanel("proposals")}
                  >
                    Go to Review Proposals
                  </button>
                </section>
              ) : (
                <>
                  <section className="assignment-shell assignment-confirm-shell">
                    <article className="assignment-summary-card assignment-primary-card">
                      <div className="assignment-summary-head">
                        <div>
                          <p className="section-kicker">Chosen Listing</p>
                          <h4>{selectedJob.title}</h4>
                        </div>
                        <span className="state-badge">{selectedJob.status || "Open"}</span>
                      </div>
                      <div className="assignment-summary-meta">
                        <span>Job ID: {selectedJob.jobId}</span>
                        <span>Budget: {formatBudgetLabel(selectedJob)}</span>
                        <span>Deadline: {selectedJob.deadline || "Not set"}</span>
                      </div>
                    </article>

                    <article className="assignment-summary-card assignment-secondary-card">
                      <div className="assignment-summary-head">
                        <div>
                          <p className="section-kicker">Selected Freelancer</p>
                          <h4>{selectedJob.selectedFreelancerUsername || selectedJob.selectedFreelancerName || "Freelancer selected"}</h4>
                        </div>
                        <span className="state-badge assignment-state-badge">
                          {selectedJob.smartContract ? "Ready to assign" : "Preparing agreement"}
                        </span>
                      </div>
                      <div className="assignment-summary-meta">
                        <span>Wallet: {resolveSelectedFreelancerWallet(selectedJob) || "Not selected"}</span>
                        <span>Proposal accepted</span>
                      </div>
                    </article>
                  </section>

                  {selectedJob.selectedFreelancer ? (
                <div className="form-grid assignment-form-shell">
                  <div className="span-2 assignment-submit-row">
                    <button
                      className="primary-button"
                      type="button"
                      disabled={isBusy}
                      onClick={handleAssignFreelancer}
                    >
                      {isBusy ? "Assigning..." : "Assign On-Chain"}
                    </button>
                    <p className="helper-copy wide-copy">
                      This confirms the selected freelancer as the official assignee for the contract.
                    </p>
                  </div>
                  {assignmentFeedback ? (
                    <p className="helper-copy wide-copy span-2">{assignmentFeedback}</p>
                  ) : null}
                </div>
                  ) : null}
                  {!selectedJob.selectedFreelancer ? (
                    <p className="helper-copy wide-copy">
                      Select a freelancer from the proposal review section before assigning this job on-chain.
                    </p>
                  ) : null}
                </>
              )}
            </section>
          )}

          {activePanel === "escrow" && (
            <section className="content-card clean-panel">
              <div className="panel-head">
                <div>
                  <p className="section-kicker">Approval & Payment</p>
                  <h3>{selectedJob ? "Manage escrow" : "Contract-backed jobs"}</h3>
                </div>
                {selectedJob ? (
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      setSelectedJob(null);
                      setJobOverview(null);
                    }}
                  >
                    Back to jobs
                  </button>
                ) : null}
              </div>
              {!selectedJob ? (
                <JobMarketplaceBoard
                  jobs={escrowJobs}
                  onSelectJob={(job) => handleManageListing(job, "escrow")}
                  mode="client"
                  actionLabel="Manage Escrow"
                  variant="proposal-review"
                />
              ) : (
                <>
                  <section className="assignment-shell">
                    <article className="assignment-summary-card escrow-summary-card">
                      <div className="assignment-summary-head">
                        <div>
                          <p className="section-kicker">Contract Listing</p>
                          <h4>{selectedJob.title}</h4>
                        </div>
                        <span className="state-badge">{selectedJob.status || "Open"}</span>
                      </div>
                      <div className="assignment-summary-meta">
                        <span>Job ID: {resolveOnChainJobId(selectedJob)}</span>
                        <span>Budget: {formatBudgetLabel(selectedJob)}</span>
                        <span>Freelancer: {selectedJob.selectedFreelancerName || "Not selected"}</span>
                      </div>
                    </article>
                  </section>
                  <div className="action-row">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => loadOnChainJob(resolveOnChainJobId(selectedJob))}
                    >
                      Load On-Chain State
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() =>
                        depositPayment(
                          resolveOnChainJobId(selectedJob),
                          resolveEscrowAmount(selectedJob)
                        )
                      }
                    >
                      Fund Job
                    </button>
                    {selectedJob.status === "Completed" ? (
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => sendClientReceipt(selectedJob.jobId)}
                      >
                        Send Client Receipt
                      </button>
                    ) : null}
                  </div>
                  <JobDetailsCard
                    job={jobOverview}
                    jobStates={jobStates}
                    onApprove={approveWork}
                    onReject={rejectWork}
                    onCancel={cancelJob}
                    isBusy={isBusy}
                    emptyMessage="Load this contract-backed job to review escrow, approval, and payment release."
                  />
                </>
              )}
            </section>
          )}

          {activePanel === "messages" && (
            <section className="content-card clean-panel">
              <div className="panel-head">
                <div>
                  <p className="section-kicker">Messages</p>
                  <h3>Chat with freelancers</h3>
                </div>
              </div>
              <ChatPanel
                jobs={clientJobs}
                selectedJob={selectedJob}
                onSelectJob={(job) => handleManageListing(job, "messages")}
                currentUser={currentUser}
                account={account}
                messages={messages}
                onSendMessage={sendChatMessage}
                isBusy={isBusy}
                mode="client"
              />
            </section>
          )}
        </section>
          </section>
        </section>
      </section>
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
    inbox: (
      <>
        <path d="M3 5.2 4.3 3h7.4L13 5.2V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M5 8.2h2l1 1.3 1-1.3h2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    user: (
      <>
        <circle cx="8" cy="5.2" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M4 12.5c.8-1.9 2.2-2.9 4-2.9s3.2 1 4 2.9" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
      </>
    ),
    shield: (
      <path
        d="M8 2.7 12 4v3.5c0 2.4-1.5 4.3-4 5.8-2.5-1.5-4-3.4-4-5.8V4Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
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
