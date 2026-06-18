import { useState } from "react";

const emptySubmissionForm = {
  jobId: "",
  submission: ""
};

export function SubmitWorkPage({ submitWork, isBusy }) {
  const [submissionForm, setSubmissionForm] = useState(emptySubmissionForm);

  async function handleSubmitWork(event) {
    event.preventDefault();

    const success = await submitWork(submissionForm);
    if (success) {
      setSubmissionForm(emptySubmissionForm);
    }
  }

  return (
    <main className="page-layout">
      <section className="content-card feature-spotlight">
        <div className="card-heading-row">
          <div>
            <p className="section-kicker">Freelancer Delivery</p>
            <h2>Submit completed work</h2>
          </div>
          <p className="helper-copy">
            Upload your files elsewhere, then store the IPFS hash or delivery link here.
          </p>
        </div>

        <form className="form-grid" onSubmit={handleSubmitWork}>
          <label>
            Job ID
            <input
              type="number"
              min="0"
              value={submissionForm.jobId}
              onChange={(event) =>
                setSubmissionForm({ ...submissionForm, jobId: event.target.value })
              }
              required
            />
          </label>

          <label className="span-2">
            IPFS Hash or Delivery Link
            <textarea
              rows="6"
              value={submissionForm.submission}
              onChange={(event) =>
                setSubmissionForm({ ...submissionForm, submission: event.target.value })
              }
              required
            />
          </label>

          <div className="span-2">
            <button className="primary-button" type="submit" disabled={isBusy}>
              Submit Work
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
