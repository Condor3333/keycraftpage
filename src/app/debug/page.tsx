export default function DebugPage() {
  const envVars = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Debug Information</h1>
      <h2>Environment Variables:</h2>
      <pre>{JSON.stringify(envVars, null, 2)}</pre>
      
      <h2>Current URL:</h2>
      <p>Window Location: {typeof window !== 'undefined' ? window.location.href : 'Server-side'}</p>
      
      <h2>Headers:</h2>
      <p>This page helps debug subdomain configuration issues.</p>
    </div>
  );
} 