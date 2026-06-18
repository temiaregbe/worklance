export function Modal({ title, kicker = "Records", isOpen, onClose, children }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-head">
          <div className="modal-title-block">
            <h3>{title}</h3>
          </div>
          <button className="toolbar-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
