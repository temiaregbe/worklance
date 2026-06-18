import { useState } from "react";
import { JobDetailsCard } from "../components/JobDetailsCard";

export function SearchJobsPage({
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

  async function handleFetch(event) {
    event.preventDefault();

    try {
      const jobDetails = await fetchJob(jobId);
      setJob(jobDetails);
    } catch {
      setJob(null);
    }
  }

  return (
    <main className="page-layout">
      <section className="content-card compact-card">
        <div className="card-heading-row">
          <div>
            <p className="section-kicker">Job Search</p>
            <h2>Search and inspect any on-chain job</h2>
          </div>
          <p className="helper-copy">Enter a job ID to load status, addresses, payout, and work.</p>
        </div>

        <form className="search-form" onSubmit={handleFetch}>
          <input
            type="number"
            min="0"
            placeholder="Enter job ID"
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
            required
          />
          <button className="primary-button" type="submit" disabled={isBusy}>
            Search Job
          </button>
        </form>
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
