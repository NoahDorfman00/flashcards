export interface Flashcard {
    id: string;
    question: string;
    answer: string;
    topic: string;
    createdAt: number;
}

export interface FlashcardSet {
    id: string;
    title: string;
    topic: string;
    flashcards: Flashcard[];
    userId: string;
    createdAt: number;
}

export interface User {
    uid: string;
    email: string;
    displayName: string | null;
    photoURL: string | null;
} 