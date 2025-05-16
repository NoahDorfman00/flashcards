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
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
// import Stripe from "stripe";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import Anthropic from "@anthropic-ai/sdk";
// import * as cors from "cors";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// Initialize Firebase Admin
admin.initializeApp();

// Initialize CORS middleware
// const corsHandler = cors({origin: true});

// const stripe = new Stripe(functions.config().stripe.secret_key, {
//   apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion,
//   typescript: true,
// });

// 1. Create Checkout Session (v2)
// export const createCheckoutSession = onCall({
//   cors: true,
// }, async (request) => {
//   if (!request.auth) {
//     throw new HttpsError(
//       "unauthenticated", "User must be authenticated");
//   }
//   const uid = request.auth.uid;
//   const session = await stripe.checkout.sessions.create({
//     payment_method_types: ["card"],
//     mode: "subscription",
//     line_items: [
//       {
//         price: functions.config().stripe.price_id,
//         quantity: 1,
//       },
//     ],
//     success_url: "https://quiz.noahgdorfman.com/success",
//     cancel_url: "https://quiz.noahgdorfman.com/cancel",
//     client_reference_id: uid,
//     customer_email: request.auth.token.email,
//   });
//   return {sessionId: session.id};
// });

// // 2. Stripe Webhook Handler (v1)
// export const handleStripeWebhook = functions.https.onRequest(
//   async (req, res) => {
//     // Wrap the handler with CORS
//     return corsHandler(req, res, async () => {
//       const sig = req.headers["stripe-signature"] as string;
//       let event: Stripe.Event;
//       try {
//         event = stripe.webhooks.constructEvent(
//           req.rawBody,
//           sig,
//           functions.config().stripe.webhook_secret
//         );
//       } catch (err) {
//         const error = err as Error;
//         console.error("Webhook signature verification failed.",
//         error.message);
//         res.status(400).send(`Webhook Error: ${error.message}`);
//         return;
//       }

//       // Handle subscription events
//       if (event.type === "checkout.session.completed") {
//         const session = event.data.object as Stripe.Checkout.Session;
//         const uid = session.client_reference_id;
//         if (uid) {
//           await admin.database().ref(`users/${uid}/isSubscribed`).set(true);
//         }
//       }
//       if (event.type === "customer.subscription.deleted") {
//         // Optionally handle subscription cancellation
//         // You may want to look up the user by Stripe customer
//         // ID if you store it
//       }

//       res.json({received: true});
//     });
//   });

// Flashcard Generation Function (v2)
export const generateFlashcards = onCall({
  memory: "1GiB",
  timeoutSeconds: 60,
  region: "us-central1",
  cors: true,
}, async (request) => {
  const {topic, count = 10, apiKey} = request.data;

  if (!topic) {
    throw new HttpsError(
      "invalid-argument", "Topic is required");
  }

  try {
    const anthropic = new Anthropic({
      apiKey: apiKey || functions.config().anthropic.api_key,
    });

    const maxTokens = 4000;
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: maxTokens,
      messages: [
        {
          role: "user",
          content: `Generate ${count} high-quality flashcards about ${topic}. 
          Format each card as JSON with 'question' and 'answer' fields. 
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
      throw new HttpsError(
        "internal",
        "Failed. Try generating a smaller set or reword your topic.");
    }

    const formattedFlashcards = flashcards.map((card, index) => ({
      id: `temp-${index}`,
      question: card.question,
      answer: card.answer,
      topic,
      createdAt: Date.now(),
    }));

    return {flashcards: formattedFlashcards};
  } catch (error) {
    console.error("Error generating flashcards:", error);
    throw new HttpsError(
      "internal", "Failed to generate flashcards");
  }
});
