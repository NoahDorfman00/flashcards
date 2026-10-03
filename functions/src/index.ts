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
import {apiKeyHint, decryptApiKey, encryptApiKey} from "./apiKeyCrypto";

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
const keyEncryptionKey = defineSecret("ANTHROPIC_KEY_ENCRYPTION_KEY");

// Initialize CORS middleware with specific configuration
const corsHandler = cors({
  origin: ["https://study.noahgdorfman.com", "http://localhost:3000"],
  methods: ["POST", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  preflightContinue: false,
  optionsSuccessStatus: 204,
});

const PAID_STATUSES = ["subscribed", "pending_cancellation"];
const MAX_FLASHCARDS = 30;
const MAX_TOPIC_LENGTH = 500;

/**
 * Verifies the Firebase ID token in the Authorization header.
 * @param {string | undefined} authHeader The raw Authorization header.
 * @return {Promise<admin.auth.DecodedIdToken | null>} The decoded token,
 *   or null if the header is missing or the token is invalid.
 */
async function verifyAuthHeader(
  authHeader: string | undefined
): Promise<admin.auth.DecodedIdToken | null> {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  try {
    return await admin.auth().verifyIdToken(authHeader.split("Bearer ")[1]);
  } catch (error) {
    console.warn("ID token verification failed:",
      error instanceof Error ? error.message : "Unknown error");
    return null;
  }
}

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
    const decodedToken = await verifyAuthHeader(req.headers.authorization);
    if (!decodedToken) {
      res.status(401).json({error: "Unauthorized"});
      return;
    }
    if (!decodedToken.email) {
      res.status(400).json({error: "Account has no email address"});
      return;
    }
    const uid = decodedToken.uid;

    try {
      const stripe = new Stripe(stripeSecretKey.value(), {
        apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion,
        typescript: true,
      });

      // Create or retrieve the customer
      const customers = await stripe.customers.list({
        email: decodedToken.email,
        limit: 1,
      });

      const customer = customers.data.length > 0 ?
        customers.data[0] :
        await stripe.customers.create({
          email: decodedToken.email,
          metadata: {
            firebaseUID: uid,
          },
        });

      // Store the Stripe customer ID in Firebase
      await admin.database()
        .ref(`users/${uid}/stripeCustomerId`).set(customer.id);

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
        cancel_url: "https://study.noahgdorfman.com/profile",
        client_reference_id: uid,
      });
      console.log("Checkout session created:", {
        uid,
        sessionId: session.id,
        customerId: customer.id,
      });

      res.json({sessionId: session.id});
    } catch (error) {
      console.error("Error creating checkout session:", {
        uid,
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

      console.log("Webhook event received:", {
        type: event.type,
        id: event.id,
      });
    } catch (err) {
      const error = err as Error;
      console.error("Webhook signature verification failed:", {
        error: error.message,
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
        console.error("No user ID found in session:", session.id);
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

/**
 * Reads and decrypts the user's own Anthropic key, if they've saved one.
 * Keys still stored in plaintext (saved before encryption was added) are
 * encrypted in place on first use.
 * @param {admin.database.Reference} userRef The user's database record.
 * @param {string} uid The user's uid.
 * @return {Promise<string | null>} The API key, or null if none is saved.
 */
async function getUserApiKey(
  userRef: admin.database.Reference, uid: string
): Promise<string | null> {
  const [encryptedSnap, legacySnap] = await Promise.all([
    userRef.child("anthropicKeyEncrypted").get(),
    userRef.child("anthropicKey").get(),
  ]);
  const encrypted = encryptedSnap.val();
  if (typeof encrypted === "string" && encrypted) {
    return decryptApiKey(encrypted, uid, keyEncryptionKey.value());
  }
  const legacy = legacySnap.val();
  if (typeof legacy === "string" && legacy.trim()) {
    await storeUserApiKey(userRef, uid, legacy.trim());
    return legacy.trim();
  }
  return null;
}

/**
 * Encrypts and stores a user's API key, removing any plaintext copy.
 * @param {admin.database.Reference} userRef The user's database record.
 * @param {string} uid The user's uid.
 * @param {string} apiKey The API key.
 * @return {Promise<void>}
 */
async function storeUserApiKey(
  userRef: admin.database.Reference, uid: string, apiKey: string
): Promise<void> {
  await userRef.update({
    anthropicKeyEncrypted:
      encryptApiKey(apiKey, uid, keyEncryptionKey.value()),
    anthropicKeyHint: apiKeyHint(apiKey),
    anthropicKey: null,
  });
}

// Save (or remove) the user's own Anthropic API key, encrypted at rest.
export const saveAnthropicKey = onRequest({
  secrets: [keyEncryptionKey],
  cors: false,
  region: "us-central1",
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    const decodedToken = await verifyAuthHeader(req.headers.authorization);
    if (!decodedToken) {
      res.status(401).json({error: "Unauthorized"});
      return;
    }
    const uid = decodedToken.uid;
    const userRef = admin.database().ref(`users/${uid}`);
    const apiKey = typeof req.body?.apiKey === "string" ?
      req.body.apiKey.trim() : "";

    try {
      if (!apiKey) {
        await userRef.update({
          anthropicKeyEncrypted: null,
          anthropicKeyHint: null,
          anthropicKey: null,
        });
        console.log("Removed Anthropic key:", {uid});
        res.json({hint: null});
        return;
      }

      if (!/^sk-ant-[A-Za-z0-9_-]{20,300}$/.test(apiKey)) {
        res.status(400).json({error: "That doesn't look like an " +
          "Anthropic API key (it should start with sk-ant-)"});
        return;
      }

      // Check the key works before saving it.
      try {
        await new Anthropic({apiKey}).models.list({limit: 1});
      } catch (error) {
        if (error instanceof Anthropic.AuthenticationError ||
          error instanceof Anthropic.PermissionDeniedError) {
          res.status(400).json({error: "Anthropic rejected that API key"});
          return;
        }
        // Network or service errors: save anyway rather than block the user.
        console.warn("Could not verify Anthropic key:", {
          uid,
          errorMessage: error instanceof Error ? error.message : "Unknown",
        });
      }

      await storeUserApiKey(userRef, uid, apiKey);
      console.log("Saved Anthropic key:", {uid});
      res.json({hint: apiKeyHint(apiKey)});
    } catch (error) {
      console.error("Error saving Anthropic key:", {
        uid,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      res.status(500).json({error: "Failed to save key"});
    }
  });
});

// Flashcard Generation Function (v2)
export const generateFlashcards = onRequest({
  secrets: [anthropicApiKey, keyEncryptionKey],
  memory: "1GiB",
  timeoutSeconds: 300,
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

  // Handle CORS for actual request
  return corsHandler(req, res, async () => {
    const decodedToken = await verifyAuthHeader(req.headers.authorization);
    if (!decodedToken) {
      res.status(401).json({error: "Sign in to generate flashcards"});
      return;
    }
    const uid = decodedToken.uid;

    const topic = req.body?.topic;
    const count = Math.min(
      Math.max(Math.floor(Number(req.body?.count) || 10), 1), MAX_FLASHCARDS);

    if (typeof topic !== "string" || !topic.trim() ||
      topic.length > MAX_TOPIC_LENGTH) {
      res.status(400).json({error: "A topic of up to " +
        `${MAX_TOPIC_LENGTH} characters is required`});
      return;
    }

    // Decide whose Anthropic key pays for this request: the owner's key for
    // subscribers, then the user's own saved key, then the user's single
    // free generation.
    const userRef = admin.database().ref(`users/${uid}`);
    let keySource: "user" | "subscription" | "free";
    let userApiKey: string | null = null;
    const statusSnap = await userRef.child("subscriptionStatus").get();
    if (PAID_STATUSES.includes(statusSnap.val())) {
      keySource = "subscription";
    } else {
      try {
        userApiKey = await getUserApiKey(userRef, uid);
      } catch (error) {
        console.error("Could not read saved Anthropic key:", {
          uid,
          errorMessage: error instanceof Error ? error.message : "Unknown",
        });
        res.status(500).json({error: "Couldn't read your saved API key. " +
          "Please save it again on your profile."});
        return;
      }
      if (userApiKey) {
        keySource = "user";
      } else {
        // Atomically claim the free generation so concurrent requests can't
        // both use it.
        const claim = await userRef.child("freeGenerationUsed")
          .transaction((used) => used === true ? undefined : true);
        if (!claim.committed) {
          res.status(402).json({
            error: "Free generation already used",
            code: "FREE_TIER_USED",
          });
          return;
        }
        keySource = "free";
      }
    }

    console.log("Generating flashcards:", {uid, topic, count, keySource});

    let gotResponse = false;
    try {
      const anthropic = new Anthropic({
        apiKey: userApiKey ?? anthropicApiKey.value(),
      });

      const response = await anthropic.beta.messages.create({
        model: "claude-sonnet-5-5",
        max_tokens: 16000,
        output_config: {effort: "medium"},
        // Retry policy declines on the server-defined fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        messages: [
          {
            role: "user",
            content: `Generate ${count} high-quality flashcards about the ` +
              "topic below. Use web search only if the topic needs current " +
              "or specialized facts. When you're done, call the flash_cards " +
              `tool once with all ${count} cards. Don't put citation tags ` +
              "in the questions or answers.\n\n" +
              `<topic>${topic}</topic>`,
          },
        ],
        tools: [
          {
            type: "custom",
            name: "flash_cards",
            description: "Submit the finished set of flashcards.",
            strict: true,
            input_schema: {
              type: "object",
              properties: {
                cards: {
                  type: "array",
                  description: "The flashcards, each with a question and " +
                    "answer.",
                  items: {
                    type: "object",
                    properties: {
                      question: {
                        type: "string",
                        description: "The question for the flashcard.",
                      },
                      answer: {
                        type: "string",
                        description: "The answer to the question.",
                      },
                    },
                    required: ["question", "answer"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["cards"],
              additionalProperties: false,
            },
          },
          {
            name: "web_search",
            type: "web_search_20260209",
            max_uses: 2,
          },
        ],
      });
      gotResponse = true;

      console.log("Anthropic response:", {
        uid,
        model: response.model,
        stopReason: response.stop_reason,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      });

      if (response.stop_reason === "refusal") {
        res.status(422).json({error: "Flashcards can't be generated for " +
          "this topic. Try rewording it or choose a different topic."});
        return;
      }

      let flashcards: unknown;
      const toolUse = response.content.find(
        (block) => block.type === "tool_use" && block.name === "flash_cards");
      if (toolUse && toolUse.type === "tool_use") {
        flashcards = (toolUse.input as {cards?: unknown}).cards;
      } else {
        // Fallback: the model answered in text instead of calling the tool.
        const text = response.content
          .filter((block) => block.type === "text")
          .map((block) => block.type === "text" ? block.text : "")
          .join("\n");
        const firstBracket = text.indexOf("[");
        const lastBracket = text.lastIndexOf("]");
        try {
          flashcards = JSON.parse(
            text.substring(firstBracket, lastBracket + 1));
        } catch (e) {
          flashcards = null;
        }
      }

      const cards = Array.isArray(flashcards) ? flashcards.filter(
        (card): card is {question: string; answer: string} =>
          typeof card?.question === "string" &&
          typeof card?.answer === "string") : [];
      if (cards.length === 0) {
        res.status(500).json({error: "Failed. Try generating a smaller " +
          "set or reword your topic."});
        return;
      }

      const formattedFlashcards = cards.map((card, index) => ({
        id: `temp-${index}`,
        question: card.question,
        answer: card.answer,
        topic,
        createdAt: Date.now(),
      }));

      res.json({flashcards: formattedFlashcards});
    } catch (error) {
      console.error("Error generating flashcards:", {
        uid,
        keySource,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      if (keySource === "free" && !gotResponse) {
        // Give the free generation back if the Anthropic call itself failed
        // (nothing was billed). Once a response comes back it stays used.
        await userRef.child("freeGenerationUsed").set(false)
          .catch(() => undefined);
      }
      if (keySource === "user" &&
        error instanceof Anthropic.AuthenticationError) {
        res.status(400).json({error: "Anthropic rejected your saved API " +
          "key. Update it on your profile."});
        return;
      }
      res.status(500).json({error: "Failed to generate flashcards"});
    }
  });
});
