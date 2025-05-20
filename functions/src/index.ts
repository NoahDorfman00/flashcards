/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// import {onRequest} from "firebase-functions/v2/https";
// import * as logger from "firebase-functions/logger";
// import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import {onRequest} from "firebase-functions/v2/https";
import Anthropic from "@anthropic-ai/sdk";
import {defineSecret} from "firebase-functions/params";
import * as cors from "cors";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// Initialize Firebase Admin
admin.initializeApp();

// Define secrets
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const stripePriceId = defineSecret("STRIPE_PRICE_ID");

// Temporary function to check environment variables
export const checkEnv = onRequest({
  secrets: [anthropicApiKey],
  region: "us-central1",
}, async (req, res) => {
  res.json({
    hasAnthropicKey: !!anthropicApiKey.value(),
    keyLength: anthropicApiKey.value()?.length,
    envKeys: Object.keys(process.env),
  });
});

// Initialize CORS middleware with specific configuration
const corsHandler = cors({
  origin: ["https://study.noahgdorfman.com", "http://localhost:3000"],
  methods: ["POST", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  preflightContinue: false,
  optionsSuccessStatus: 204,
});

// 1. Create Checkout Session (v2)
export const createCheckoutSession = onRequest({
  secrets: [stripeSecretKey, stripePriceId],
  cors: false,
}, async (req, res) => {
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Origin", req.headers.origin || "https://study.noahgdorfman.com");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Credentials", "true");
    res.status(204).send("");
    return;
  }

  // Use the cors middleware
  return corsHandler(req, res, async () => {
    try {
      // Get the auth token from the Authorization header
      const authHeader = req.headers.authorization;
      console.log("Auth header received:", {
        hasHeader: !!authHeader,
        startsWithBearer: authHeader?.startsWith("Bearer "),
        headerValue: authHeader ? `${authHeader.substring(0, 20)}...` : null,
        allHeaders: req.headers,
      });

      if (!authHeader?.startsWith("Bearer ")) {
        console.log("Unauthorized: Invalid auth header format");
        res.status(401).json({error: "Unauthorized"});
        return;
      }

      const idToken = authHeader.split("Bearer ")[1];
      console.log("Decoding ID token...", {
        tokenLength: idToken.length,
        tokenPrefix: idToken.substring(0, 10) + "...",
        tokenParts: idToken.split(".").length, // Should be 3 for a valid JWT
        tokenExpiry:
          new Date(
            JSON.parse(atob(idToken.split(".")[1])).exp * 1000).toISOString(),
        currentTime: new Date().toISOString(),
      });

      try {
        console.log("Verifying ID token...");
        // First check if the token is a valid JWT format
        if (idToken.split(".").length !== 3) {
          throw new Error("Invalid token format: not a valid JWT");
        }

        const decodedToken = await admin.auth().verifyIdToken(idToken, true);
        // Check if token is revoked
        console.log("Token verified successfully:", {
          uid: decodedToken.uid,
          email: decodedToken.email,
          auth_time: decodedToken.auth_time,
          exp: decodedToken.exp,
          iat: decodedToken.iat,
          token_valid: decodedToken.exp > Date.now() / 1000,
          current_time: Date.now() / 1000,
          time_until_expiry: decodedToken.exp - (Date.now() / 1000),
        });

        if (!decodedToken.email) {
          throw new Error("Token does not contain email");
        }

        const uid = decodedToken.uid;
        console.log("Token decoded successfully:", {
          uid,
          email: decodedToken.email,
        });

        console.log("Initializing Stripe...");
        const stripe = new Stripe(stripeSecretKey.value(), {
          apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion,
          typescript: true,
        });

        // First, create or retrieve the customer
        console.log("Looking up existing customer...");
        const customers = await stripe.customers.list({
          email: decodedToken.email,
          limit: 1,
        });
        console.log("Customer lookup results:", {
          foundCustomers: customers.data.length,
          firstCustomerId: customers.data[0]?.id,
        });

        let customer;
        if (customers.data.length > 0) {
          customer = customers.data[0];
          console.log("Using existing customer:", {
            id: customer.id,
            email: customer.email,
          });

          // Store the Stripe customer ID in Firebase for existing customers too
          await admin.database()
            .ref(`users/${uid}/stripeCustomerId`).set(customer.id);
          console.log("Stored existing Stripe customer ID in Firebase:",
            customer.id);
        } else {
          console.log("Creating new customer...");
          customer = await stripe.customers.create({
            email: decodedToken.email,
            metadata: {
              firebaseUID: uid,
            },
          });
          console.log("New customer created:", {
            id: customer.id,
            email: customer.email,
          });

          // Store the Stripe customer ID in Firebase
          await admin.database()
            .ref(`users/${uid}/stripeCustomerId`)
            .set(customer.id);
          console.log("Stored new Stripe customer ID in Firebase:",
            customer.id);
        }

        console.log("Creating checkout session...");
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "subscription",
          customer: customer.id,
          line_items: [
            {
              price: stripePriceId.value(),
              quantity: 1,
            },
          ],
          success_url: "https://study.noahgdorfman.com/success",
          cancel_url: "https://study.noahgdorfman.com/cancel",
          client_reference_id: uid,
        });
        console.log("Checkout session created:", {
          sessionId: session.id,
          customerId: session.customer,
        });

        res.json({sessionId: session.id});
      } catch (tokenError) {
        console.error("Token verification failed:", {
          error: tokenError,
          errorMessage:
            tokenError instanceof Error ? tokenError.message :
              "Unknown error",
          errorStack:
            tokenError instanceof Error ? tokenError.stack : undefined,
        });
        res.status(401).json({error: "Invalid token"});
      }
    } catch (error) {
      console.error("Error creating checkout session:", {
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({error: "Failed to create checkout session"});
    }
  });
});

// Add new cloud function for subscription cancellation
export const cancelSubscription = onRequest({
  secrets: [stripeSecretKey],
  cors: false,
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      // Get the auth token from the Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        console.log("Unauthorized: Invalid auth header format");
        res.status(401).json({error: "Unauthorized"});
        return;
      }

      const idToken = authHeader.split("Bearer ")[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;
      console.log("User authenticated:", {uid, email: decodedToken.email});

      // Get the Stripe customer ID from Firebase
      const customerIdRef = await admin.database()
        .ref(`users/${uid}/stripeCustomerId`).get();

      console.log("Firebase customer lookup result:", {
        exists: customerIdRef.exists(),
        value: customerIdRef.val(),
        path: `users/${uid}/stripeCustomerId`,
      });

      if (!customerIdRef.exists()) {
        console.log("No Stripe customer found for user:", uid);
        res.status(404).json({error: "No Stripe customer found"});
        return;
      }
      const customerId = customerIdRef.val();

      const stripe = new Stripe(stripeSecretKey.value(), {
        apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion,
        typescript: true,
      });

      // Get the active subscription
      console.log("Looking up active subscriptions for customer:", customerId);
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });

      console.log("Subscription lookup results:", {
        foundSubscriptions: subscriptions.data.length,
        firstSubscriptionId: subscriptions.data[0]?.id,
        status: subscriptions.data[0]?.status,
      });

      if (subscriptions.data.length === 0) {
        console.log("No active subscription found for customer:", customerId);
        res.status(404).json({error: "No active subscription found"});
        return;
      }

      const subscription = subscriptions.data[0];
      console.log("Found active subscription:", {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end ?
          new Date(subscription.current_period_end * 1000).toISOString() :
          "not set",
      });

      // Cancel the subscription at period end
      await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
      });

      // Update the subscription status in the database
      await admin.database().ref(`users/${uid}/subscriptionStatus`)
        .set("pending_cancellation");

      console.log("Successfully cancelled subscription:", {
        subscriptionId: subscription.id,
        userId: uid,
        cancelledAt: new Date().toISOString(),
      });

      res.json({success: true});
    } catch (error) {
      console.error("Error canceling subscription:", {
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({error: "Failed to cancel subscription"});
    }
  });
});

// Add new cloud function for subscription reactivation
export const reactivateSubscription = onRequest({
  secrets: [stripeSecretKey],
  cors: false,
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      // Get the auth token from the Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({error: "Unauthorized"});
        return;
      }

      const idToken = authHeader.split("Bearer ")[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;

      // Get the Stripe customer ID from Firebase
      const customerIdRef = await admin.database()
        .ref(`users/${uid}/stripeCustomerId`).get();
      if (!customerIdRef.exists()) {
        res.status(404).json({error: "No Stripe customer found"});
        return;
      }
      const customerId = customerIdRef.val();

      const stripe = new Stripe(stripeSecretKey.value(), {
        apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion,
        typescript: true,
      });

      // Get the subscription that's pending cancellation
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length === 0) {
        res.status(404).json({error: "No active subscription found"});
        return;
      }

      const subscription = subscriptions.data[0];

      // Reactivate the subscription by removing the cancel_at_period_end flag
      await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: false,
      });

      // Update the subscription status in the database
      await admin.database().ref(`users/${uid}/subscriptionStatus`)
        .set("subscribed");

      res.json({success: true});
    } catch (error) {
      console.error("Error reactivating subscription:", error);
      res.status(500).json({error: "Failed to reactivate subscription"});
    }
  });
});

// 2. Stripe Webhook Handler (v1)
export const handleStripeWebhook = onRequest({
  secrets: [stripeSecretKey, stripeWebhookSecret],
}, async (req, res) => {
  // Wrap the handler with CORS
  return corsHandler(req, res, async () => {
    console.log("Webhook received:", {
      method: req.method,
      headers: req.headers,
      hasBody: !!req.body,
      bodyLength: req.body?.length,
      signature: req.headers["stripe-signature"],
      webhookSecretLength: stripeWebhookSecret.value()?.length,
    });

    const stripe = new Stripe(stripeSecretKey.value(), {
      apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion,
      typescript: true,
    });

    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;

    try {
      if (!req.rawBody) {
        console.error("No raw body available for webhook verification");
        res.status(400).send("No raw body available");
        return;
      }

      if (!sig) {
        console.error("No Stripe signature found in headers");
        res.status(400).send("No Stripe signature found");
        return;
      }

      if (!stripeWebhookSecret.value()) {
        console.error("No webhook secret configured");
        res.status(500).send("Webhook secret not configured");
        return;
      }

      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        stripeWebhookSecret.value()
      );

      console.log("Webhook event constructed successfully:", {
        type: event.type,
        id: event.id,
        object: event.data.object,
      });
    } catch (err) {
      const error = err as Error;
      console.error("Webhook signature verification failed:", {
        error: error.message,
        signature: sig,
        hasWebhookSecret: !!stripeWebhookSecret.value(),
        webhookSecretLength: stripeWebhookSecret.value()?.length,
        rawBodyLength: req.rawBody?.length,
      });
      res.status(400).send(`Webhook Error: ${error.message}`);
      return;
    }

    // Handle subscription events
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.client_reference_id;
      console.log("Processing checkout.session.completed:", {
        uid,
        sessionId: session.id,
        customerId: session.customer,
        subscriptionId: session.subscription,
      });

      if (uid) {
        try {
          await admin.database().ref(`users/${uid}/subscriptionStatus`)
            .set("subscribed");
          console.log("Successfully updated subscription status for user:",
            uid);
        } catch (err) {
          console.error("Failed to update subscription status:", err);
          res.status(500).send("Failed to update subscription status");
          return;
        }
      } else {
        console.error("No user ID found in session:", session);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      console.log("Processing customer.subscription.deleted:", {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
      });

      try {
        // Get the customer ID from the subscription
        const customerId = subscription.customer as string;
        console.log("Looking up user by Stripe customer ID:", customerId);

        // Find the user by Stripe customer ID in Firebase
        const userSnapshot = await admin.database()
          .ref("users")
          .orderByChild("stripeCustomerId")
          .equalTo(customerId)
          .once("value");

        const userData = userSnapshot.val();
        console.log("User lookup results:", {
          found: !!userData,
          userIds: userData ? Object.keys(userData) : [],
        });

        if (userData) {
          const userId = Object.keys(userData)[0];
          console.log("Updating subscription status in database for user:",
            userId);

          // Update the user's subscription status
          await admin.database()
            .ref(`users/${userId}/subscriptionStatus`)
            .set("unsubscribed");

          console.log("Successfully updated subscription status for user:",
            userId);
        } else {
          console.log("No user found with Stripe customer ID:", customerId);
        }
      } catch (err) {
        console.error("Failed to update subscription status:", {
          error: err,
          errorMessage: err instanceof Error ? err.message : "Unknown error",
          errorStack: err instanceof Error ? err.stack : undefined,
        });
      }
    }

    res.json({received: true});
  });
});

// Flashcard Generation Function (v2)
export const generateFlashcards = onRequest({
  secrets: [anthropicApiKey],
  memory: "1GiB",
  timeoutSeconds: 60,
  region: "us-central1",
}, async (req, res) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Origin", "https://study.noahgdorfman.com");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Credentials", "true");
    res.status(204).send("");
    return;
  }

  // Log request details
  console.log("Received request:", {
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query,
  });

  // Handle CORS for actual request
  return corsHandler(req, res, async () => {
    try {
      const {topic, count = 10, apiKey} = req.body;

      console.log("Parsed request body:",
        {topic, count, apiKey: apiKey ? "present" : "not present"});

      if (!topic) {
        console.error("Topic is missing from request");
        res.status(400).json({error: "Topic is required"});
        return;
      }

      // Get the API key from secret if not provided in request
      const anthropicKey = apiKey || anthropicApiKey.value();

      if (!anthropicKey) {
        res.status(500).json({error: "No API key available"});
        return;
      }

      const anthropic = new Anthropic({
        apiKey: anthropicKey,
      });

      const maxTokens = 4000;
      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: maxTokens,
        messages: [
          {
            role: "user",
            content: `Generate ${count} high-quality flashcards about ${topic}. 
                        Format each card as JSON with 
                        'question' and 'answer' fields. 
                        Return only the JSON array, no additional text.`,
          },
        ],
      });

      const contentBlock = response.content[0];
      let raw = (contentBlock && "text" in contentBlock) ? contentBlock.text :
        JSON.stringify(contentBlock);

      // Try to extract the JSON array
      const firstBracket = raw.indexOf("[");
      const lastBracket = raw.lastIndexOf("]");
      if (firstBracket !== -1 &&
        lastBracket !== -1 &&
        lastBracket > firstBracket) {
        raw = raw.substring(firstBracket,
          lastBracket + 1);
      }

      let flashcards;
      try {
        flashcards = JSON.parse(raw) as Array<{
          question: string;
          answer: string
        }>;
      } catch (e) {
        res.status(500).json(
          {
            error: "Failed. Try generating a smaller set or reword your topic.",
          });
        return;
      }

      const formattedFlashcards = flashcards.map((card, index) => ({
        id: `temp-${index}`,
        question: card.question,
        answer: card.answer,
        topic,
        createdAt: Date.now(),
      }));

      res.json({flashcards: formattedFlashcards});
    } catch (error) {
      console.error("Error generating flashcards:", error);
      res.status(500).json({error: "Failed to generate flashcards"});
    }
  });
});

// // Test function to check all secrets
// export const testSecrets = onCall({
//   secrets: [stripeSecretKey, stripePriceId,
//     stripeWebhookSecret, anthropicApiKey],
// }, async () => {
//   return {
//     stripeKey: !!stripeSecretKey.value(),
//     priceId: !!stripePriceId.value(),
//     webhookSecret: !!stripeWebhookSecret.value(),
//     anthropicKey: !!anthropicApiKey.value(),
//     priceIdValue: stripePriceId.value(),
//     envKeys: Object.keys(process.env),
//   };
// });
