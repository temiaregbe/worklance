import { useState } from "react";
import { JobDetailsCard } from "../components/JobDetailsCard";

export function ManageJobsPage({
  fetchJob,
  depositPayment,
  approveWork,
  rejectWork,
  cancelJob,
  jobStates,
  isBusy
}) {
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState(null);

  async function handleLoad(event) {
    event.preventDefault();

    try {
      const jobDetails = await fetchJob(jobId);
      setJob(jobDetails);
    } catch {
      setJob(null);
    }
  }

  return (
    <main className="page-layout two-column">
      <section className="content-card">
        <div className="card-heading-row">
          <div>
            <p className="section-kicker">Operations Console</p>
            <h2>Review submissions and release payout</h2>
          </div>
          <p className="helper-copy">Load a job to fund escrow, approve, reject, or cancel it.</p>
        </div>

        <form className="search-form stacked-form" onSubmit={handleLoad}>
          <input
            type="number"
            min="0"
            placeholder="Enter job ID"
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
            required
          />
          <button className="primary-button" type="submit" disabled={isBusy}>
            Load Job
          </button>
        </form>

        <div className="ops-notes">
          <article>
            <span>Funding</span>
            <p>Clients lock the exact payment amount in escrow before work is finalized.</p>
          </article>
          <article>
            <span>Review</span>
            <p>Submitted work can be approved for payout or rejected for revisions.</p>
          </article>
          <article>
            <span>Cancellation</span>
            <p>Jobs can be cancelled before completion, with escrow returned where applicable.</p>
          </article>
        </div>
      </section>

      <JobDetailsCard
        job={job}
        jobStates={jobStates}
        onFund={depositPayment}
        onApprove={approveWork}
        onReject={rejectWork}
        onCancel={cancelJob}
        isBusy={isBusy}
      />
    </main>
  );
}
