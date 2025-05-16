import { functions } from './firebase';
import { Flashcard } from '../types';
import { httpsCallable } from 'firebase/functions';

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
        const generateFlashcardsFunction = httpsCallable<GenerateFlashcardsRequest, GenerateFlashcardsResponse>(functions, 'generateFlashcards');
        const result = await generateFlashcardsFunction({ topic, count, apiKey });
        return result.data.flashcards;
    } catch (error) {
        console.error('Error generating flashcards:', error);
        throw error;
    }
}; 