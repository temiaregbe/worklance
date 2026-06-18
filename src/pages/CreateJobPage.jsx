import { useState } from "react";

const emptyCreateForm = {
  description: "",
  paymentAmount: ""
};

const emptyAssignForm = {
  jobId: "",
  freelancer: ""
};

export function CreateJobPage({ createJob, assignFreelancer, isBusy }) {
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [assignForm, setAssignForm] = useState(emptyAssignForm);

  async function handleCreateJob(event) {
    event.preventDefault();

    const success = await createJob(createForm);
    if (success) {
      setCreateForm(emptyCreateForm);
    }
  }

  async function handleAssignFreelancer(event) {
    event.preventDefault();

    const success = await assignFreelancer(assignForm);
    if (success) {
      setAssignForm(emptyAssignForm);
    }
  }

  return (
    <main className="page-layout two-column">
      <section className="content-card">
        <div className="card-heading-row">
          <div>
            <p className="section-kicker">Client Setup</p>
            <h2>Create a new job</h2>
          </div>
          <p className="helper-copy">This writes the job description and payment value on-chain.</p>
        </div>

        <form className="form-grid" onSubmit={handleCreateJob}>
          <label className="span-2">
            Job Description
            <textarea
              rows="5"
              value={createForm.description}
              onChange={(event) =>
                setCreateForm({ ...createForm, description: event.target.value })
              }
              required
            />
          </label>

          <label>
            Payment Amount (ETH)
            <input
              type="number"
              min="0"
              step="0.0001"
              value={createForm.paymentAmount}
              onChange={(event) =>
                setCreateForm({ ...createForm, paymentAmount: event.target.value })
              }
              required
            />
          </label>

          <div className="span-2">
            <button className="primary-button" type="submit" disabled={isBusy}>
              Create Job
            </button>
          </div>
        </form>
      </section>

      <section className="content-card">
        <div className="card-heading-row">
          <div>
            <p className="section-kicker">Team Matching</p>
            <h2>Assign the freelancer</h2>
          </div>
          <p className="helper-copy">You can assign a freelancer immediately or after funding.</p>
        </div>

        <form className="form-grid" onSubmit={handleAssignFreelancer}>
          <label>
            Job ID
            <input
              type="number"
              min="0"
              value={assignForm.jobId}
              onChange={(event) => setAssignForm({ ...assignForm, jobId: event.target.value })}
              required
            />
          </label>

          <label className="span-2">
            Freelancer Address
            <input
              type="text"
              placeholder="0x..."
              value={assignForm.freelancer}
              onChange={(event) =>
                setAssignForm({ ...assignForm, freelancer: event.target.value })
              }
              required
            />
          </label>

          <div className="span-2">
            <button className="primary-button" type="submit" disabled={isBusy}>
              Assign Freelancer
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
