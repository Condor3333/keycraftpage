'use client';

import React, { useState } from 'react';
import styles from './ResendVerificationButton.module.css';

interface ResendVerificationButtonProps {
  email: string;
}

const ResendVerificationButton: React.FC<ResendVerificationButtonProps> = ({ email }) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const handleResend = async () => {
    setIsSending(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/auth/resend-verification', {
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
        setError(data.message || 'An unknown error occurred.');
      }
    } catch (err) {
      setError('A network error occurred. Please try again.');
      console.error('Resend verification error:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={styles.container}>
      <button onClick={handleResend} disabled={isSending} className={styles.resendButton}>
        {isSending ? 'Sending...' : 'Resend Verification Email'}
      </button>
      {message && <p className={styles.successMessage}>{message}</p>}
      {error && <p className={styles.errorMessage}>{error}</p>}
    </div>
  );
};

export default ResendVerificationButton; 