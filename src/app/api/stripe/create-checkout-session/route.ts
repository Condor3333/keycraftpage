import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '../../../../../auth'; // Adjust path as needed

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-04-30.basil",
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { priceId, email } = await req.json();

    if (!priceId) {
      return NextResponse.json({ error: 'Price ID is required' }, { status: 400 });
    }
    if (!email || email !== session.user.email) {
      // Ensure the email for checkout matches the logged-in user
      return NextResponse.json({ error: 'Email mismatch or not provided' }, { status: 400 });
    }
    
    const YOUR_DOMAIN = process.env.NEXT_PUBLIC_APP_URL;
    
    if (!YOUR_DOMAIN) {
      return NextResponse.json({ error: 'Server configuration error: NEXT_PUBLIC_APP_URL not set' }, { status: 500 });
    }

    // Check if the user already has a Stripe customer ID
    // You might store this on your User model in DynamoDB (e.g., user.stripeCustomerId)
    // For now, we'll let Stripe create a new customer if one isn't found by email,
    // or use an existing one if Stripe finds one with that email.
    // More robustly, you'd look up your internal user record for a stripeCustomerId.

    const checkoutSession = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription', // Assuming these are yearly subscriptions
      success_url: `${YOUR_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${YOUR_DOMAIN}/membership?canceled=true`, // Or your pricing page
      customer_email: email, // Pre-fill customer email
      // To associate with an existing Stripe customer ID if you have one:
      // customer: existingStripeCustomerId, 
      // To pass metadata that your webhook can use:
      metadata: {
        userId: session.user.id, // Store your internal user ID
        priceId: priceId, // Keeping this for potential direct use, though line_items is more robust
        // Add any other info your webhook might need to provision access
      },
      // ADDED: Expand line_items to get price and product details in webhook
      expand: ['line_items', 'line_items.price', 'line_items.price.product'], 
    });

    if (!checkoutSession.id) {
        console.error("STRIPE CHECKOUT: Failed to create session - ID missing", checkoutSession);
        return NextResponse.json({ error: "Could not create checkout session" }, { status: 500 });
    }

    return NextResponse.json({ sessionId: checkoutSession.id });

  } catch (error: any) {
    console.error("STRIPE CHECKOUT ERROR:", error);
    return NextResponse.json({ error: error.message || 'Failed to create checkout session' }, { status: 500 });
  }
} 
