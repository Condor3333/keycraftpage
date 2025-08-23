"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./register.module.css"; // We will create this CSS file next
import { useRouter } from 'next/navigation'; // Import useRouter

export default function RegisterPage() {
  const router = useRouter(); // Initialize router
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError("All fields are necessary.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
    }

    setLoading(true);

    try {
      const currentEmail = email;
      const res = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email: currentEmail,
          password,
        }),
      });

      if (res.status === 429) {
        setError("Too many registration attempts. Please try again later.");
      } else if (res.ok) {
        const data = await res.json(); 
        if (data.success) {
          // Registration successful, redirecting to sign-in
          setFirstName("");
          setLastName("");
          setEmail("");
          setPassword("");
          setConfirmPassword("");
          router.push(`/signin?notice=${data.notice}&email=${data.email}`);
          return; 
        }
        // If res.ok but data.success is false (should ideally not happen if API is consistent)
        setError(data.message || "Registration failed. Please check your details.");
      } else {
        // For other non-429, non-ok errors
        let errorMessage = `Registration failed with status: ${res.status}.`;
        try {
          const data = await res.json();
          errorMessage = data.message || errorMessage;
        } catch (e) {
          // If JSON parsing fails for the error response
          console.warn("Could not parse error response as JSON from /api/register", e);
          // errorMessage remains the status-based one
        }
        setError(errorMessage);
      }

    } catch (err) {
      console.error("Registration error:", err);
      let errorMessage = "An unexpected error occurred. Please try again.";
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      if (err instanceof SyntaxError && err.message.includes("Unexpected token '<'")){
          errorMessage = "Received an invalid response from the server. Please try again.";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.authBox}>
        <h1>Sign up</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.nameFields}>
            <div className={styles.inputGroup}>
              <label htmlFor="firstName">First name</label>
              <input
                type="text"
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Your first name"
                required
                disabled={loading}
              />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="lastName">Last name</label>
              <input
                type="text"
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Your last name"
                required
                disabled={loading}
              />
            </div>
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              required
              disabled={loading}
            />
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="password">Password</label>
            <div className={styles.passwordInputWrapper}>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password (min. 6 characters)"
                required
                disabled={loading}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={loading}
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
          <div className={styles.inputGroup}>
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className={styles.passwordInputWrapper}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                disabled={loading}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                disabled={loading}
              >
                {showConfirmPassword ? (
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
          {error && <p className={styles.errorText}>{error}</p>}
          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? "Creating account..." : "Continue"}
          </button>
        </form>

        {/* <div className={styles.separator}>
          <span>OR</span>
        </div>

        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className={`${styles.socialButton} ${styles.googleButton}`}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '10px' }}>
            <path d="M17.6402 9.20455C17.6402 8.56818 17.5811 7.95455 17.4737 7.36364H9V10.8409H13.8439C13.6365 11.9909 13.0002 12.9545 12.0464 13.5909V15.8182H14.4811C15.9646 14.4545 16.9407 12.6364 17.2907 10.4091C17.5237 9.98182 17.6402 9.61364 17.6402 9.20455Z" fill="#4285F4"/>
            <path d="M9.00001 18C11.4348 18 13.4668 17.1955 14.4818 15.8182L12.047 13.5909C11.2328 14.1136 10.228 14.4545 9.00001 14.4545C6.91455 14.4545 5.15092 13.0227 4.50546 11.0682H1.95092V13.3591C2.95455 15.2727 4.75092 16.9091 6.90001 17.7273C7.59637 17.9318 8.29183 18 9.00001 18Z" fill="#34A853"/>
            <path d="M4.50524 11.0682C4.31342 10.5455 4.20433 10.0136 4.20433 9.45455C4.20433 8.89545 4.31342 8.36364 4.50524 7.84091V5.54545H1.9507C1.23728 6.75 0.818189 8.07727 0.818189 9.45455C0.818189 10.8318 1.23728 12.1591 1.9507 13.3636L4.50524 11.0682Z" fill="#FBBC05"/>
            <path d="M9.00001 4.45455C10.0236 4.45455 10.9109 4.85227 11.6373 5.54545L14.5418 2.63636C13.0682 1.22727 11.4555 0.454545 9.00001 0.454545C5.72819 0.454545 2.95455 2.09091 1.95092 4.54545L4.50546 6.83636C5.15092 5.88182 6.01455 4.45455 9.00001 4.45455Z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button> */}

        <p className={styles.footerText}>
          Already have an account? <Link href="/signin">Sign in</Link>
        </p>
      </div>
      <p className={styles.termsText}>
        By creating an account, you agree to the <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>
      </p>
    </div>
  );
} 
