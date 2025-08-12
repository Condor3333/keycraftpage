'use client';

import { useState } from 'react';
import './contact.css';

// Basic email validation regex
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

export default function ContactPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ message: string; type: 'success' | 'error' | '' }>({ message: '', type: '' });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitStatus({ message: '', type: '' });

    const formData = new FormData(event.currentTarget);
    const firstName = formData.get('firstName') as string;
    const workEmail = formData.get('workEmail') as string;
    const comments = formData.get('comments') as string;

    // --- Client-side validation --- 
    if (!firstName || firstName.trim().length < 2) {
      setSubmitStatus({ message: 'Please enter a valid name (at least 2 characters).', type: 'error' });
      setSubmitting(false);
      return;
    }
    if (!workEmail || !EMAIL_REGEX.test(workEmail)) {
      setSubmitStatus({ message: 'Please enter a valid email address.', type: 'error' });
      setSubmitting(false);
      return;
    }
    if (!comments || comments.trim().length < 10) {
      setSubmitStatus({ message: 'Please provide a message (at least 10 characters).', type: 'error' });
      setSubmitting(false);
      return;
    }
    if (comments.trim().length > 5000) { // Max length check
      setSubmitStatus({ message: 'Your message is too long (max 5000 characters).', type: 'error' });
      setSubmitting(false);
      return;
    }
    // --- End client-side validation ---

    const data = { name: firstName, email: workEmail, message: comments };

    try {
      const response = await fetch('/api/send-contact-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      // Handle 429 Rate Limit Exceeded specifically
      if (response.status === 429) {
        // const errorText = await response.text(); // Optionally get the text for logging
        // console.warn('Rate limit exceeded on contact form:', errorText);
        setSubmitStatus({ message: 'You have sent too many emails, try again later.', type: 'error' });
      } else if (response.ok) {
        const result = await response.json();
        setSubmitStatus({ message: result.message || 'Message sent successfully!', type: 'success' });
        (event.target as HTMLFormElement).reset(); // Reset form
      } else {
        // For other errors, try to parse JSON, but have a fallback
        let errorMessage = 'Failed to send message. Please try again.';
        try {
          const result = await response.json();
          errorMessage = result.message || errorMessage;
        } catch (e) {
          // If JSON parsing fails, use the status text or a generic error
          errorMessage = response.statusText || errorMessage;
          console.warn('Could not parse error response as JSON from /api/send-contact-email', e);
        }
        setSubmitStatus({ message: errorMessage, type: 'error' });
      }
    } catch (error) {
      console.error('Contact form submission error:', error);
      setSubmitStatus({ message: 'An unexpected error occurred. Please try again.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="contact-page-container">
      <div className="contact-content">
        <h1 className="contact-title">Contact for Support</h1>
        <h2 className="contact-subtitle">Report bugs. Request Features. Apply for a job with KeyCraft.</h2>
        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">Name</label>
              <input type="text" id="firstName" name="firstName" required minLength={2} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="workEmail">Email</label>
              <input type="email" id="workEmail" name="workEmail" required />
            </div>
          </div>
          <div className="form-group full-width">
            <label htmlFor="comments">How can we help?</label>
            <textarea id="comments" name="comments" placeholder="Submit comments, questions, bug reports or portfolios" required minLength={10} maxLength={5000}></textarea>
          </div>
          <button type="submit" className="submit-button" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
          {submitStatus.message && (
            <p style={{ color: submitStatus.type === 'error' ? 'red' : 'green', marginTop: '10px' }}>
              {submitStatus.message}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}