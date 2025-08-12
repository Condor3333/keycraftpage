"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn, signOut, getCsrfToken, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./signin.module.css"; // We will create this CSS file next
import ResendVerificationButton from './ResendVerificationButton'; // Adjust the import path as necessary

// Fallback component for Suspense
function SignInFormLoading() {
  return (
    <div className={styles.pageContainer}>
      <div className={styles.authBox}>
        <h1>Loading...</h1>
        {/* You might want a more sophisticated skeleton UI here */}
      </div>
    </div>
  );
}

// Original SignInPage content moved to a new component
function SignInFormComponent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null); // For success messages like email verified
  const [loading, setLoading] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();

  // State for resend email functionality
  const [resendStatus, setResendStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [emailForResend, setEmailForResend] = useState<string>("");
  const [activeNoticeType, setActiveNoticeType] = useState<'pending_verification' | 'token_expired' | null>(null);

  // Provide a default for searchParams if it's null, then extract params
  const currentSearchParams = searchParams || new URLSearchParams();
  const noticeParam = currentSearchParams.get("notice");
  const emailParam = currentSearchParams.get("email");
  const callbackError = currentSearchParams.get("error");
  const callbackUrlParam = currentSearchParams.get("callbackUrl");



  useEffect(() => {
    // Sign-in page useEffect triggered
    const fetchCsrfToken = async () => {
      try {
        const token = await getCsrfToken();
        setCsrfToken(token || null);
      } catch {
        setError("Failed to load sign-in form. Please try again.");
      }
    };
    fetchCsrfToken();

    let shouldClearParamsViaReplace = false; 

    if (emailParam) {
      setEmailForResend(emailParam); 
    }

    if (noticeParam === "pending_verification") {
      setActiveNoticeType("pending_verification");
      setNotice(`Please check your email${emailParam ? ` at ${emailParam}` : ''} to verify your account before signing in.`);
      if (sessionStatus === "authenticated") { 
        signOut({ redirect: false }); 
      }
      shouldClearParamsViaReplace = true;
    } else if (noticeParam === "token_expired") {
      setActiveNoticeType("token_expired");
      setNotice("Verification token has expired. Please register again to receive a new link.");
      setError(null);
      setSuccessMessage(null);
      if (!emailParam && email) { 
        setEmailForResend(email);
      } else if (!emailParam && !email && session?.user?.email) {
        setEmailForResend(session.user.email);
      }
      if (sessionStatus === "authenticated") {
        signOut({ redirect: false });
      }
      shouldClearParamsViaReplace = true;
    } else if (noticeParam === "verified_success") {
      // Email verification success detected
      setSuccessMessage("Email successfully verified! You can now sign in.");
      setNotice(null); 
    }

    if (callbackError) {
      handleSignInError(callbackError);
      shouldClearParamsViaReplace = true; 
    }

    if (shouldClearParamsViaReplace) {
        router.replace("/signin", undefined); 
    }

  }, [noticeParam, emailParam, callbackError, router, sessionStatus, email]); // Use extracted params

  useEffect(() => {
          if (sessionStatus === "authenticated" && session?.user && (session.user as { emailVerified?: boolean; status?: string }).emailVerified && (session.user as { emailVerified?: boolean; status?: string }).status === 'active') {
      const callbackUrl = callbackUrlParam || "/dashboard";
      router.push(callbackUrl);
    }
  }, [session, sessionStatus, router, callbackUrlParam]); // Use extracted callbackUrlParam

  const handleSignInError = (errorCode: string | null) => {
    setSuccessMessage(null); // Clear success message on new error
    if (!errorCode) {
      setError("An unknown error occurred. Please try again.");
      return;
    }
    if (errorCode === "RateLimit") {
      setError("Too many sign-in attempts. Please try again later.");
    } else if (errorCode === "CredentialsSignin") {
      setError("Invalid email or password. If you have tried multiple times, please wait a few minutes and try again.");
    } else if (errorCode === "EmailNotVerified") {
      setNotice("Your email address has not been verified. Please check your inbox for a verification link, or register again to resend.");
    } else if (errorCode === "AccountDisabled") {
      setError("Your account has been disabled. Please contact support.");
    } else if (errorCode === "AccountPendingDeletion") {
      setError("Your account is pending deletion. Please contact support if you wish to reactivate it.");
    } else {
      setError("An error occurred during sign-in. Please try again.");
    }
    // console.error("NextAuth Sign-in Error Code:", errorCode);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSuccessMessage(null); // Clear success message on new submit
    setLoading(true);

    if (!email || !password) {
      setError("Email and password are required.");
      setLoading(false);
      return;
    }

    const res = await signIn("credentials", {
      redirect: false,
      email: email,
      password: password,
      callbackUrl: (searchParams || new URLSearchParams()).get("callbackUrl") || "/dashboard",
    });

    setLoading(false);
    if (res?.error) {
      handleSignInError(res.error);
      // If error is PENDING_VERIFICATION, ensure emailForResend is set from the input field
      if (res.error === "PENDING_VERIFICATION" && email) {
        setEmailForResend(email);
      }
    } else if (res?.ok) {
      // On successful sign-in, force a hard redirect to reload the page.
      // This ensures the session is fully updated on the client when the new page loads.
      window.location.href = res.url || ((searchParams || new URLSearchParams()).get("callbackUrl") || "/dashboard");
    }
  };

  // If notice is set, show only the notice and a way to go back or try other methods.
  if (notice) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.authBox}>
          <h1>Account Verification</h1>
          <p className={styles.primaryNoticeText}>
            {notice}
          </p>
          
          {(activeNoticeType === "pending_verification" || activeNoticeType === "token_expired") && emailForResend && (
            <div className={styles.secondaryActions}>
              <button
                onClick={async () => {
                  if (!emailForResend) {
                    setResendStatus({ message: "Email address not available for resend. Please try signing in again.", type: 'error' });
                    return;
                  }
                  setIsResending(true);
                  setResendStatus(null);
                  try {
                    const res = await fetch('/api/auth/resend-verification', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: emailForResend }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setResendStatus({ message: data.message, type: 'success' });
                    } else {
                      setResendStatus({ message: data.message || 'An error occurred.', type: 'error' });
                    }
                  } catch (err) {
                    setResendStatus({ message: "A network error occurred.", type: 'error' });
                  } finally {
                    setIsResending(false);
                  }
                }}
                disabled={isResending}
                className={styles.actionLinkButton}
              >
                {isResending ? 'Sending...' : 'Resend Verification Email'}
              </button>

              {resendStatus && (
                <p className={resendStatus.type === 'success' ? styles.successMessage : styles.errorMessage}>
                  {resendStatus.message}
                </p>
              )}

              <p>
                <a href="/signin" className={styles.actionLink}>
                  Try Signing In Again
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Otherwise, show the standard sign-in form
  return (
    <div className={styles.pageContainer}>
      <div className={styles.authBox}>
        <h1>Sign in</h1>
        {successMessage && <p className={styles.successText} style={{color: 'green', textAlign: 'center', marginBottom: '15px'}}>{successMessage}</p>}
        {csrfToken && <input name="csrfToken" type="hidden" defaultValue={csrfToken} />}
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              required
            />
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="password">Password</label>
            <div className={styles.passwordInputWrapper}>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div className={styles.forgotPassword}>
            <Link href="/forgot-password">Forgot Password?</Link>
          </div>
          {error && (
            <div className={styles.errorContainer}>
              <p className={styles.errorMessage}>{error}</p>
              {error.includes("not yet verified") && emailForResend && (
                <ResendVerificationButton email={emailForResend} />
              )}
            </div>
          )}
          <button type="submit" className={styles.submitButton} disabled={loading || !csrfToken}>
            {loading ? "Signing in..." : "Continue"}
          </button>
        </form>

        <p className={styles.footerText}>
          Don&apos;t have an account? <Link href="/register">Sign up</Link>
        </p>
      </div>
       <p className={styles.termsText}>
          <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>
      </p>
    </div>
  );
}

// Default export is now the wrapper
export default function SignInPage() {
  return (
    <Suspense fallback={<SignInFormLoading />}>
      <SignInFormComponent />
    </Suspense>
  );
} 