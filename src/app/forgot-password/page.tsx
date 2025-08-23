"use client";

import { useState } from 'react';
import Link from 'next/link';
import styles from '../signin/signin.module.css'; // Reusing signin styles for consistency

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/auth/send-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
      } else {
        setError(data.message || 'An unexpected error occurred.');
      }
    } catch (err) {
      setError('A network error occurred. Please try again.');
      console.error('Forgot password error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.authBox}>
        <div className={styles.logoPlaceholder}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0L22.3923 6V18L12 24L1.6077 18V6L12 0ZM12 2.12871L3.6077 7.00001V17L12 21.8713L20.3923 17V7.00001L12 2.12871Z"/>
                <path d="M12 7L19.5359 11.5V12.5L12 17L4.4641 12.5V11.5L12 7ZM12 8.79443L6.4641 12L12 15.2056L17.5359 12L12 8.79443Z"/>
            </svg>
        </div>
        <h1>Reset Your Password</h1>
        <p className={styles.subtleText}>Enter your email address and we will send you a link to reset your password.</p>
        
        {message ? (
          <p className={styles.successText} style={{color: 'green', textAlign: 'center', margin: '20px 0'}}>{message}</p>
        ) : (
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
            {error && (
              <div className={styles.errorContainer}>
                <p className={styles.errorMessage}>{error}</p>
              </div>
            )}
            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        <p className={styles.footerText}>
          Remember your password? <Link href="/signin">Sign in</Link>
        </p>
      </div>
      <p className={styles.termsText}>
        <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>
      </p>
    </div>
  );
} 
