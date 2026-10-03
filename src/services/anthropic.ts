import { Flashcard } from '../types';

export class GenerateFlashcardsError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
    }
}

// The server decides whose key pays: subscription, the user's saved (encrypted) key, or the free generation.
export const generateFlashcards = async (idToken: string, topic: string, count: number = 10): Promise<Flashcard[]> => {
    try {
        console.log('Sending request with:', { topic, count });

        const response = await fetch('https://us-central1-flashcards-d25b9.cloudfunctions.net/generateFlashcards', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ topic, count })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Server response:', {
                status: response.status,
                statusText: response.statusText,
                error: errorData
            });
            throw new GenerateFlashcardsError(errorData.error || 'Failed to generate flashcards', errorData.code);
        }

        const result = await response.json();
        return result.flashcards;
    } catch (error) {
        console.error('Error generating flashcards:', error);
        throw error;
    }
}; 

// Save the user's own Anthropic key (encrypted server-side). An empty key removes it.
// Returns the display hint for the saved key, e.g. "…AbCd", or null when removed.
export const saveAnthropicKey = async (idToken: string, apiKey: string): Promise<string | null> => {
    const response = await fetch('https://us-central1-flashcards-d25b9.cloudfunctions.net/saveAnthropicKey', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ apiKey }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(result.error || 'Failed to save key');
    }
    return result.hint ?? null;
};
