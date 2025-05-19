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
import { onRequest } from "firebase-functions/v2/https";
import Anthropic from "@anthropic-ai/sdk";
import { defineSecret } from "firebase-functions/params";
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
  origin: "https://study.noahgdorfman.com",
  methods: ["POST", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
});

// 1. Create Checkout Session (v2)
export const createCheckoutSession = onRequest({
  secrets: [stripeSecretKey, stripePriceId],
  cors: false,
}, async (req, res) => {
  // Add logging for debugging
  console.log("Request received:", {
    method: req.method,
    headers: req.headers,
    origin: req.headers.origin,
  });

  // Use the cors middleware
  return corsHandler(req, res, async () => {
    try {
      // Get the auth token from the Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const idToken = authHeader.split("Bearer ")[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;

      const stripe = new Stripe(stripeSecretKey.value(), {
        apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion,
        typescript: true,
      });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [
          {
            price: stripePriceId.value(),
            quantity: 1,
          },
        ],
        success_url: "https://study.noahgdorfman.com/success",
        cancel_url: "https://study.noahgdorfman.com/cancel",
        client_reference_id: uid,
        customer_email: decodedToken.email,
      });

      // Log response headers before sending
      console.log("Response headers before sending:", {
        headers: res.getHeaders(),
      });

      res.json({ sessionId: session.id });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
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
          await admin.database().ref(`users/${uid}/isSubscribed`).set(true);
          console.log("Successfully updated subscription status for user:", uid);
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
      // TODO: Handle subscription cancellation
    }

    res.json({ received: true });
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
      const { topic, count = 10, apiKey } = req.body;

      console.log("Parsed request body:",
        { topic, count, apiKey: apiKey ? "present" : "not present" });

      if (!topic) {
        console.error("Topic is missing from request");
        res.status(400).json({ error: "Topic is required" });
        return;
      }

      // Get the API key from secret if not provided in request
      const anthropicKey = apiKey || anthropicApiKey.value();

      if (!anthropicKey) {
        res.status(500).json({ error: "No API key available" });
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

      res.json({ flashcards: formattedFlashcards });
    } catch (error) {
      console.error("Error generating flashcards:", error);
      res.status(500).json({ error: "Failed to generate flashcards" });
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
