import { Flashcard } from '../types';

interface GenerateFlashcardsResponse {
    flashcards: Flashcard[];
}

interface GenerateFlashcardsRequest {
    topic: string;
    count?: number;
    apiKey?: string;
}

export const generateFlashcards = async (topic: string, apiKey?: string, count: number = 10): Promise<Flashcard[]> => {
    try {
        console.log('Sending request with:', { topic, count, apiKey: apiKey ? 'present' : 'not present' });

        const response = await fetch('https://us-central1-flashcards-d25b9.cloudfunctions.net/generateFlashcards', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ topic, count, apiKey })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Server response:', {
                status: response.status,
                statusText: response.statusText,
                error: errorData
            });
            throw new Error(errorData.error || 'Failed to generate flashcards');
        }

        const result = await response.json();
        return result.flashcards;
    } catch (error) {
        console.error('Error generating flashcards:', error);
        throw error;
    }
}; 