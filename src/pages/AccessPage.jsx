import { Link } from "react-router-dom";
import { AuthPanel } from "../components/AuthPanel";

export function AccessPage({
  account,
  currentUser,
  onRegister,
  onLogin,
  onConnectWallet,
  isBusy,
  status,
  mode = "signin"
}) {
  const viewMode = mode;
  const isSignIn = viewMode === "signin";

  return (
    <main className="page-layout role-layout">
      <section className="access-page-shell">
        <section
          className={`content-card clean-panel access-page-card ${
            isSignIn ? "access-page-card-signin" : ""
          }`}
        >
          <div className="panel-head access-page-head">
            <Link className="ghost-button" to="/">
              Back Home
            </Link>
          </div>

          <AuthPanel
            account={account}
            currentUser={currentUser}
            onRegister={onRegister}
            onLogin={onLogin}
            onConnectWallet={onConnectWallet}
            isBusy={isBusy}
            status={status}
            mode={viewMode}
          />

          <p className="helper-copy wide-copy access-switch-copy">
            {isSignIn ? "Create a new account? " : "Existing account? "}
            <Link className="text-link" to={isSignIn ? "/signup" : "/signin"}>
              {isSignIn ? "Sign up" : "Sign in"}
            </Link>
          </p>
        </section>
      </section>
    </main>
  );
}
