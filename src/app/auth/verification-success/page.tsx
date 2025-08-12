'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function VerificationSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect to sign-in after 3 seconds
    const timer = setTimeout(() => {
      router.push('/signin?verified=true');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1a1a1a',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '400px',
        padding: '40px',
        backgroundColor: '#2a2a2a',
        borderRadius: '8px',
        textAlign: 'center',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          margin: '0 auto 24px',
          backgroundColor: '#22c55e',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
        </div>
        
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          marginBottom: '16px',
          color: '#22c55e'
        }}>
          Email Verified Successfully!
        </h1>
        
        <p style={{
          fontSize: '16px',
          color: '#d1d5db',
          marginBottom: '24px',
          lineHeight: '1.5'
        }}>
          Your account has been activated. You can now sign in and start using KeyCraft.
        </p>
        
        <p style={{
          fontSize: '14px',
          color: '#9ca3af',
          marginBottom: '24px'
        }}>
          Redirecting to sign-in page in 3 seconds...
        </p>
        
        <Link 
          href="/signin?verified=true"
          style={{
            display: 'inline-block',
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: '500',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
        >
          Sign In Now
        </Link>
      </div>
    </div>
  );
} 