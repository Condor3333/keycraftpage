import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const resendApiKey = process.env.RESEND_API_KEY;
const toEmail = process.env.COMPANY_CONTACT_EMAIL || 'keycraftapp@gmail.com';

// Use a specific FROM_EMAIL for the contact form, defaulting to onboarding@resend.dev
// This avoids conflict with FROM_EMAIL used for verification, unless explicitly set to be the same.
const contactFormFromEmail = process.env.CONTACT_FORM_FROM_EMAIL || 'onboarding@resend.dev';

// Basic email validation regex
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

// Define Zod schema for contact form input
const ContactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters.").max(100, "Name is too long."),
  email: z.string().email("Invalid email format."),
  message: z.string().min(10, "Message must be at least 10 characters.").max(5000, "Message is too long."),
});

if (!resendApiKey) {
  console.error('RESEND_API_KEY is not set. Email functionality will be disabled.');
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function POST(req: NextRequest) {
  if (!resend) {
    console.error('Resend SDK not initialized due to missing API key.');
    return NextResponse.json({ message: 'Email service is currently unavailable.' }, { status: 503 });
  }

  try {
    const body = await req.json();

    // Validate with Zod
    const validationResult = ContactFormSchema.safeParse(body);
    if (!validationResult.success) {
      console.error("[Contact Form Validation Error]", validationResult.error.flatten());
      return NextResponse.json({ 
        message: 'Invalid contact form data.', 
        errors: validationResult.error.flatten().fieldErrors 
      }, { status: 400 });
    }

    const { name, email, message } = validationResult.data; // Use validated data

    // Sanitize/normalize inputs (basic trim)
    const sanitizedName = name.trim();
    const sanitizedEmail = email.trim();
    const sanitizedMessage = message.trim();

    const emailHtml = `
      <h1>New KeyCraft Contact Form Submission</h1>
      <p><strong>Name:</strong> ${sanitizedName}</p>
      <p><strong>Sender's Email:</strong> ${sanitizedEmail}</p>
      <p><strong>Comments/Question:</strong></p>
      <p>${sanitizedMessage || 'No comments provided.'}</p>
      <hr>
      <p><em>This email was sent from the KeyCraft contact form.</em></p>
    `;



    const { data, error } = await resend.emails.send({
      from: contactFormFromEmail, 
      to: [toEmail],   
      subject: `KeyCraft Contact Form: Message from ${sanitizedName}`,
      html: emailHtml,
      headers: {
        'Reply-To': sanitizedEmail
      },
    });

    if (error) {
      console.error('Resend API Error (send-contact-email):', JSON.stringify(error, null, 2));
      return NextResponse.json({ message: 'Error sending email via Resend.', errorDetail: error.message }, { status: 500 });
    }


    return NextResponse.json({ message: 'Message sent successfully! We will get back to you soon.', data }, { status: 200 });

  } catch (err: any) {
    console.error('API route /api/send-contact-email internal error:', err);
    return NextResponse.json({ message: 'Internal server error processing your request.', errorDetail: err.message }, { status: 500 });
  }
} 
