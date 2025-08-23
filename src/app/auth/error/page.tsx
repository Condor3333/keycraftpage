'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation'; // To read query parameters
import { Suspense } from 'react';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const message = searchParams.get('message') || 'An unexpected error occurred.';
  const errorCode = searchParams.get('code'); // Optional error code for more specific messages

  let displayMessage = message;
  if (errorCode === 'VerificationTokenExpired') {
    displayMessage = 'Your verification token has expired. Please try registering again or request a new verification email.';
  } else if (errorCode === 'InvalidToken') {
    displayMessage = 'The verification token is invalid. Please check the link or try registering again.';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: '20px' }}>
      <h1 style={{ color: 'red' }}>Verification Error</h1>
      <p style={{ fontSize: '1.2em', margin: '20px 0' }}>
        {displayMessage}
      </p>
      <Link href="/signin" 
        style={{
          display: 'inline-block',
          padding: '10px 20px',
          fontSize: '1em',
          color: 'white',
          backgroundColor: '#007bff',
          border: 'none',
          borderRadius: '5px',
          textDecoration: 'none',
          cursor: 'pointer',
          marginRight: '10px'
        }}
      >
        Go to Sign In
      </Link>
      <Link href="/register" 
        style={{
          display: 'inline-block',
          padding: '10px 20px',
          fontSize: '1em',
          color: '#007bff',
          backgroundColor: 'transparent',
          border: '1px solid #007bff',
          borderRadius: '5px',
          textDecoration: 'none',
          cursor: 'pointer'
        }}
      >
        Try Registering Again
      </Link>
    </div>
  );
}

export default function AuthErrorPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AuthErrorContent />
        </Suspense>
    );
} 
