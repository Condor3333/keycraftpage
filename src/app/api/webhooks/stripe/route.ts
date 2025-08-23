import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { DynamoDBAdapter } from "../../../../lib/dynamodb-adapter";
import type { AdapterUser } from "next-auth/adapters";

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-04-30.basil", // Use the latest API version or specify your version
});

// This is your Stripe webhook secret for verifying signatures
// Get it from Stripe Dashboard → Developers → Webhooks
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = (await headers()).get("stripe-signature") || "";

    
    
    // Make sure we have a webhook secret configured
    if (!webhookSecret) {
      console.error("STRIPE WEBHOOK ERROR: Missing STRIPE_WEBHOOK_SECRET environment variable");
      return NextResponse.json(
        { message: "Missing webhook secret" },
        { status: 500 }
      );
    }

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret as string);
    } catch (err: unknown) {
      let errorMessage = "An unknown error occurred during webhook signature verification";
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      console.error(`STRIPE WEBHOOK ERROR: Signature verification failed: ${errorMessage}`);
      console.error(`Signature received: ${signature.substring(0, 20)}...`);
      return NextResponse.json(
        { message: `Webhook signature verification failed: ${errorMessage}` },
        { status: 400 }
      );
    }

    

    // Extract data and type from the event
    const { data, type } = event;

    // Handle different event types
    if (type === 'checkout.session.completed') {
      const session = data.object as Stripe.Checkout.Session;
      
      
      
      
      
      
      // Make sure the payment was successful
      if (session.payment_status === 'paid') {
        
        await handleSuccessfulPayment(session);
      } else {
        
      }
    } 
    // Handle subscription cancellations
    else if (type === 'customer.subscription.deleted') {
      const subscription = data.object as Stripe.Subscription;
      
      await handleSubscriptionCancellation(subscription);
    }
    // Handle subscription updates (downgrade/upgrade)
    else if (type === 'customer.subscription.updated') {
      const subscription = data.object as Stripe.Subscription;
      
      await handleSubscriptionUpdate(subscription);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    let errorMessage = "Error processing Stripe webhook";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    console.error("Stripe webhook error:", error); // Log the original error object too
    return NextResponse.json(
      { message: "Error processing Stripe webhook", details: errorMessage },
      { status: 500 }
    );
  }
}

// Function to handle successful payment
async function handleSuccessfulPayment(session: Stripe.Checkout.Session) {
  try {
    const customerEmail = session.customer_details?.email;
    const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null;
    const userIdFromMetadata = session.metadata?.userId || session.client_reference_id;

    console.log(`STRIPE WEBHOOK: Processing payment for session ${session.id}. UserID (metadata/client_ref): ${userIdFromMetadata}, Email: ${customerEmail}`);

    if (!userIdFromMetadata && !customerEmail) {
      console.error("STRIPE WEBHOOK: Critical - Cannot identify user. Missing userId/client_reference_id in metadata AND customer email in session:", session.id);
      return;
    }
    
    const adapter = DynamoDBAdapter();

    let user: AdapterUser | null = null;
    if (userIdFromMetadata) {
      user = await adapter.getUser!(userIdFromMetadata); 
      if (!user && customerEmail) {
        console.warn(`STRIPE WEBHOOK: User not found by ID ${userIdFromMetadata}, attempting fallback to email ${customerEmail} for session ${session.id}`);
        user = await adapter.getUserByEmail!(customerEmail.toLowerCase());
      }
    } else if (customerEmail) { 
      user = await adapter.getUserByEmail!(customerEmail.toLowerCase());
    }

    if (!user || !user.id) {
      console.error(`STRIPE WEBHOOK: User not found for session ${session.id}. Email: ${customerEmail}, Metadata/ClientRef UserID: ${userIdFromMetadata}`);
      return;
    }

    console.log(`STRIPE WEBHOOK: Found user ${user.id} (Email: ${user.email}) for session ${session.id}`);
    
    let planType = 'unknown_plan';
    let newActivePlans = Array.isArray((user as any).activePlans) ? [...(user as any).activePlans] : [];

    // Explicitly fetch line items for the session
    let fetchedLineItems: Stripe.LineItem[] = [];
    try {
      const lineItemsList = await stripe.checkout.sessions.listLineItems(session.id, {
        expand: ['data.price.product'], // Ensure price and product are expanded here too
      });
      fetchedLineItems = lineItemsList.data;
      console.log("STRIPE WEBHOOK DEBUG: Fetched Line Items via API:", JSON.stringify(fetchedLineItems, null, 2));
    } catch (listError) {
      console.error(`STRIPE WEBHOOK: Error fetching line items for session ${session.id}:`, listError);
      // Decide if you want to proceed without line items or return an error
    }

    if (fetchedLineItems.length > 0 && fetchedLineItems[0].price) {
      const priceIdFromLineItem = fetchedLineItems[0].price.id;
      
      
      if (priceIdFromLineItem === process.env.NEXT_PUBLIC_STRIPE_TIER1_PRICE_ID) {
        planType = 'tier1';
        if (!newActivePlans.includes('tier1')) newActivePlans.push('tier1');
      } else if (priceIdFromLineItem === process.env.NEXT_PUBLIC_STRIPE_TIER2_PRICE_ID) {
        planType = 'tier2';
        if (!newActivePlans.includes('tier2')) newActivePlans.push('tier2');
        // If Tier 2 is purchased, conceptually it might include Tier 1 benefits.
        // For now, let's just add tier2. If distinct plans are needed, adjust.
      } else {
        console.warn(`STRIPE WEBHOOK: Unrecognized priceId ${priceIdFromLineItem} from line_items for user ${user.email}.`);
      }
    } else {
      console.warn(`STRIPE WEBHOOK: Could not determine priceId from line_items for session ${session.id}. Check Stripe event payload.`);
    }
        
    const updateData: Partial<AdapterUser> & { id: string; dateModified?: string; customerId?: string; } = {
      id: user.id,
      hasPaid: true,
      activePlans: newActivePlans,
      dateModified: new Date().toISOString(),
    };

    if (stripeCustomerId && !((user as any).customerId)) {
      updateData.customerId = stripeCustomerId;
      
    }
    
    await adapter.updateUser!(updateData);

    
    console.log(`STRIPE WEBHOOK: User payment status after update attempt: hasPaid=${updateData.hasPaid}, activePlans=${JSON.stringify(updateData.activePlans)}`);
    
  } catch (error) {
    console.error("STRIPE WEBHOOK: Error handling successful payment:", error);
    throw error;
  }
}

// Function to handle subscription cancellation
async function handleSubscriptionCancellation(subscription: Stripe.Subscription) {
  
  try {
    if (!subscription.customer) {
      console.error("STRIPE WEBHOOK (Subscription Cancel): No customer ID in subscription object.");
      return;
    }
    
    const customerId = typeof subscription.customer === 'string' 
      ? subscription.customer 
      : subscription.customer.id;
    
    const adapter = DynamoDBAdapter();
    // TODO: Implement robust user lookup by Stripe Customer ID.
    // This might require a GSI on 'stripeCustomerId' in your DynamoDB table.
    // For now, we'll log and skip. If email is available via customer object, could use that.
    // const user = await adapter.getUserByStripeCustomerId(customerId); // Placeholder for actual lookup
    
    // Alternative: Fetch customer from Stripe to get email, then lookup user by email
    let userEmail: string | null = null;
    try {
        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.deleted) { // Check if customer object is not deleted
            userEmail = customer.email;
        }
    } catch (e) {
        console.error(`STRIPE WEBHOOK (Subscription Cancel): Error fetching customer ${customerId} from Stripe to get email:`, e);
    }

    if (!userEmail) {
        console.warn(`STRIPE WEBHOOK (Subscription Cancel): Could not retrieve email for Stripe customer ${customerId}. Cannot update user plans.`);
        return;
    }

    const user = await adapter.getUserByEmail!(userEmail.toLowerCase());

    if (!user || !user.id) {
      console.error(`STRIPE WEBHOOK (Subscription Cancel): No user found with Stripe customer email: ${userEmail} (derived from customer ID: ${customerId})`);
      return;
    }
    
    console.log(`STRIPE WEBHOOK (Subscription Cancel): Processing for user: ${user.email} (ID: ${user.id})`);
    
    // Determine which plan(s) were cancelled by inspecting subscription.items
    // This is a simplified example; you'd need to map price IDs to your internal plan identifiers.
    const cancelledPlanIds = subscription.items.data.map(item => item.price.id);
    console.log(`STRIPE WEBHOOK (Subscription Cancel): Cancelled Stripe Price IDs: ${cancelledPlanIds.join(', ')}`);

    let currentActivePlans = Array.isArray((user as any).activePlans) ? [...(user as any).activePlans] : [];
    let plansChanged = false;

    // Example: map Stripe Price IDs to your plan names (e.g., 'tier1', 'tier2')
    const priceIdToPlanName: Record<string, string> = {
        [process.env.NEXT_PUBLIC_STRIPE_TIER1_PRICE_ID || '']: 'tier1',
        [process.env.NEXT_PUBLIC_STRIPE_TIER2_PRICE_ID || '']: 'tier2',
    };

    cancelledPlanIds.forEach(stripePriceId => {
        const planNameToRemove = priceIdToPlanName[stripePriceId];
        if (planNameToRemove) {
            const index = currentActivePlans.indexOf(planNameToRemove);
            if (index > -1) {
                currentActivePlans.splice(index, 1);
                plansChanged = true;
                console.log(`STRIPE WEBHOOK (Subscription Cancel): Plan '${planNameToRemove}' marked for removal for user ${user.email}`);
            }
        }
    });

    if (plansChanged) {
        const updateData: Partial<AdapterUser> & { id: string; dateModified?: string } = {
            id: user.id,
            activePlans: currentActivePlans,
            hasPaid: currentActivePlans.length > 0, // Update hasPaid based on remaining active plans
            dateModified: new Date().toISOString(),
        };
        await adapter.updateUser!(updateData);
        console.log(`STRIPE WEBHOOK (Subscription Cancel): User ${user.email} plans updated. New activePlans: ${JSON.stringify(currentActivePlans)}, hasPaid: ${updateData.hasPaid}`);
    } else {
        console.log(`STRIPE WEBHOOK (Subscription Cancel): No relevant active plans found to remove for user ${user.email} based on cancelled Stripe price IDs.`);
    }
    
  } catch (error) {
    console.error("STRIPE WEBHOOK (Subscription Cancel): Error handling subscription cancellation:", error);
    // Do not re-throw here to allow other webhook events to process if this one fails.
  }
}

// Function to handle subscription updates (downgrades/upgrades)
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  
  try {    
    if (!subscription.customer) {
      console.error("STRIPE WEBHOOK (Subscription Update): No customer ID in subscription object.");
      return;
    }
    
    const customerId = typeof subscription.customer === 'string' 
      ? subscription.customer 
      : subscription.customer.id;
          
    const adapter = DynamoDBAdapter();
    // TODO: Implement robust user lookup by Stripe Customer ID (GSI).
    // For now, fetch customer email from Stripe, then user by email.
    let userEmail: string | null = null;
    try {
        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.deleted) userEmail = customer.email;
    } catch (e) {
        console.error(`STRIPE WEBHOOK (Subscription Update): Error fetching customer ${customerId} from Stripe:`, e);
    }

    if (!userEmail) {
        console.warn(`STRIPE WEBHOOK (Subscription Update): Could not retrieve email for Stripe customer ${customerId}. Cannot update plans.`);
        return;
    }

    const user = await adapter.getUserByEmail!(userEmail.toLowerCase());

    if (!user || !user.id) {
      console.error(`STRIPE WEBHOOK (Subscription Update): No user found with email: ${userEmail} (from Stripe customer ${customerId})`);
      return;
    }
    
    console.log(`STRIPE WEBHOOK (Subscription Update): Processing for user: ${user.email} (ID: ${user.id})`);
    
    if (subscription.status === 'active') {
      // Determine the new set of active plans based on subscription.items
      const newStripePriceIds = subscription.items.data.map(item => item.price.id);
      console.log(`STRIPE WEBHOOK (Subscription Update): Current active Stripe Price IDs for user ${user.email}: ${newStripePriceIds.join(', ')}`);

      const priceIdToPlanName: Record<string, string> = {
        [process.env.NEXT_PUBLIC_STRIPE_TIER1_PRICE_ID || '']: 'tier1',
        [process.env.NEXT_PUBLIC_STRIPE_TIER2_PRICE_ID || '']: 'tier2',
      };

      let newActivePlans: string[] = [];
      newStripePriceIds.forEach(stripePriceId => {
        const planName = priceIdToPlanName[stripePriceId];
        if (planName && !newActivePlans.includes(planName)) {
          newActivePlans.push(planName);
        }
      });
      
      // If tier2 is active, ensure tier1 is also considered active if that's your business logic
      // Example: if (newActivePlans.includes('tier2') && !newActivePlans.includes('tier1')) {
      //   newActivePlans.push('tier1');
      // }


      const updateData: Partial<AdapterUser> & { id: string; dateModified?: string } = {
        id: user.id,
        activePlans: newActivePlans,
        hasPaid: newActivePlans.length > 0,
        dateModified: new Date().toISOString(),
      };
      
      await adapter.updateUser!(updateData);
      console.log(`STRIPE WEBHOOK (Subscription Update): User ${user.email} plans updated. New activePlans: ${JSON.stringify(newActivePlans)}, hasPaid: ${updateData.hasPaid}`);

    } else if (['past_due', 'unpaid', 'canceled'].includes(subscription.status)) {
      // Potentially revoke access if subscription is no longer active.
      // This might overlap with 'customer.subscription.deleted' but good to handle defensively.
      console.log(`STRIPE WEBHOOK (Subscription Update): Subscription for user ${user.email} is ${subscription.status}. Consider revoking access if not already handled by 'deleted' event.`);
      // You might call a similar logic to handleSubscriptionCancellation here if needed,
      // or ensure your 'deleted' handler is robust.
    } else {
      console.log(`STRIPE WEBHOOK (Subscription Update): Subscription status for user ${user.email} is '${subscription.status}'. No specific plan update action taken for this status here.`);
    }
  } catch (error) {
    console.error("STRIPE WEBHOOK (Subscription Update): Error handling subscription update:", error);
  }
} 
