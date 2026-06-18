import { useEffect, useState } from "react";

const emptyForm = {
  name: "",
  username: "",
  email: "",
  role: "client",
  skills: "",
  workHistory: "",
  bio: ""
};

export function AuthPanel({
  account,
  currentUser,
  onRegister,
  onLogin,
  onConnectWallet,
  isBusy,
  status,
  mode = "signup"
}) {
  const [form, setForm] = useState(emptyForm);
  const [cvFile, setCvFile] = useState(null);
  const [cvStatus, setCvStatus] = useState("");
  const [signInForm, setSignInForm] = useState({ username: "", wallet: "" });
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (currentUser) {
      setForm({
        name: currentUser.name || "",
        username: currentUser.username || "",
        email: currentUser.email || "",
        role: currentUser.role || "client",
        skills: currentUser.skills || "",
        workHistory: currentUser.workHistory || "",
        bio: currentUser.bio || ""
      });
      setCvStatus(currentUser.cvFileName || "");
    }

    setSignInForm((current) => ({
      username: currentUser?.username || current.username || "",
      wallet: current.wallet || ""
    }));
  }, [currentUser]);

  useEffect(() => {
    if (!account) {
      return;
    }

    setSignInForm((current) => ({
      ...current,
      wallet: account
    }));
  }, [account]);

  async function handleCvChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      setCvFile(null);
      setCvStatus("");
      return;
    }

    setCvFile(file);
    setCvStatus(file.name);
  }

  async function handleConnectWallet() {
    setAuthError("");
    const result = await Promise.resolve(onConnectWallet?.());
    if (result?.address) {
      setSignInForm((current) => ({
        ...current,
        wallet: result.address
      }));
    }
  }

  function handleRegister(event) {
    event.preventDefault();
    setAuthError("");
    Promise.resolve(onRegister({ ...form, cvFile })).then((success) => {
      if (!success) {
        setAuthError("Account creation failed. Check wallet connection and backend server.");
      }
    });
  }

  function handleSignIn(event) {
    event.preventDefault();
    setAuthError("");
    Promise.resolve(onLogin(signInForm)).then((success) => {
      if (!success) {
        setAuthError("Sign in failed. Verify your username, wallet address, and server status.");
      }
    });
  }

  return (
    <section className="auth-panel">
      <div className={`auth-card-shell ${mode === "signin" ? "auth-card-shell-signin" : ""}`}>
        <div className="auth-card-head">
          <h3>
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h3>
          {mode === "signin" ? (
            <p className="helper-copy auth-intro">Sign in with your registered username and wallet address.</p>
          ) : null}
        </div>

        {mode === "signup" ? (
          <form className="auth-form-stack" onSubmit={handleRegister}>
            <label>
              Full Name
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </label>
            <label>
              Username
              <input
                type="text"
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                placeholder="Choose a unique username"
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="name@example.com"
                required
              />
            </label>
            <label>
              CV Upload
              <input type="file" accept=".pdf,.doc,.docx" onChange={handleCvChange} />
            </label>
            {cvStatus ? <p className="helper-copy wide-copy">Selected CV: {cvStatus}</p> : null}
            <label>
              Role
              <select
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
              >
                <option value="client">Client</option>
                <option value="freelancer">Freelancer</option>
              </select>
            </label>
            <label>
              Skills
              <input
                type="text"
                value={form.skills}
                onChange={(event) => setForm({ ...form, skills: event.target.value })}
                placeholder="Solidity, UI design, technical writing..."
              />
            </label>
            <label>
              Work History
              <textarea
                rows="3"
                value={form.workHistory}
                onChange={(event) => setForm({ ...form, workHistory: event.target.value })}
              />
            </label>
            <label>
              Bio
              <textarea
                rows="3"
                value={form.bio}
                onChange={(event) => setForm({ ...form, bio: event.target.value })}
              />
            </label>

            <div className="auth-primary-action">
              <button className="primary-button auth-submit" type="submit" disabled={isBusy}>
                Create Account
              </button>
            </div>
            <div className="auth-wallet-block">
              <div className="auth-wallet-row">
                <button
                  className="ghost-button auth-wallet-fill"
                  type="button"
                  onClick={handleConnectWallet}
                >
                  {account ? "Reconnect MetaMask" : "Connect MetaMask"}
                </button>
                <input
                  type="text"
                  value={account || ""}
                  placeholder="No wallet connected yet"
                  readOnly
                />
              </div>
            </div>
            {authError ? <p className="auth-inline-error">{authError}</p> : null}
            {status ? <p className="helper-copy auth-status-copy">{status}</p> : null}
          </form>
        ) : (
          <form className="auth-signin-shell" onSubmit={handleSignIn}>
            <label>
              Username
              <input
                type="text"
                value={signInForm.username}
                onChange={(event) => setSignInForm({ ...signInForm, username: event.target.value })}
                placeholder="Enter your username"
                required
              />
            </label>
            <label>
              Wallet Address
              <input
                type="text"
                value={signInForm.wallet}
                onChange={(event) => setSignInForm({ ...signInForm, wallet: event.target.value })}
                placeholder="0x..."
                required
              />
            </label>
            <div className="auth-wallet-row">
              <button
                className="ghost-button auth-wallet-fill"
                type="button"
                onClick={handleConnectWallet}
              >
                {account ? "Switch MetaMask Wallet" : "Connect MetaMask"}
              </button>
            </div>
            <div className="auth-secondary-action">
              <button
                className="primary-button auth-submit"
                type="submit"
                disabled={isBusy || !signInForm.wallet.trim() || !signInForm.username.trim()}
              >
                Sign In
              </button>
            </div>
            {authError ? <p className="auth-inline-error">{authError}</p> : null}
            {status ? <p className="helper-copy auth-status-copy">{status}</p> : null}
          </form>
        )}
      </div>
    </section>
  );
}
