import { useState } from "react";

export function FileManager({
  selectedJob,
  onSaveFile,
  isBusy,
  title = "File Upload & Storage",
  heading = "Attach project files",
  emptyMessage = "Select a job first to attach files or deliverables."
}) {
  const [label, setLabel] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");

  async function handleChange(event) {
    const file = event.target.files?.[0];
    if (!file || !selectedJob) {
      return;
    }
    setFileName(file.name);
    await onSaveFile({
      jobId: selectedJob.jobId,
      label: label || file.name,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      file
    });
    setUploadStatus(`${file.name} stored successfully.`);
  }

  return (
    <section className="content-card file-manager-panel">
      <div className="card-heading-row">
        <div>
          <p className="section-kicker">{title}</p>
          <h3>{heading}</h3>
        </div>
      </div>
      <label>
        Label
        <input type="text" value={label} onChange={(event) => setLabel(event.target.value)} />
      </label>
      <label>
        Upload file
        <input type="file" onChange={handleChange} disabled={isBusy || !selectedJob} />
      </label>
      <p className="helper-copy wide-copy">
        {selectedJob
          ? `Ready to store files for job #${selectedJob.jobId}${fileName ? ` (${fileName})` : ""}.`
          : emptyMessage}
      </p>
      {uploadStatus ? <p className="helper-copy wide-copy">{uploadStatus}</p> : null}
    </section>
  );
}
