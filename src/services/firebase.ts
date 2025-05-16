import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
    apiKey: "AIzaSyCuBgax1GXPP81-YKzFCBy_PFLo9u1y5ys",
    authDomain: "flashcards-d25b9.firebaseapp.com",
    databaseURL: "https://flashcards-d25b9-default-rtdb.firebaseio.com",
    projectId: "flashcards-d25b9",
    storageBucket: "flashcards-d25b9.firebasestorage.app",
    messagingSenderId: "43665516647",
    appId: "1:43665516647:web:db4a0457279ebfabc90cc2",
    measurementId: "G-37CZVP4786"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
export const functions = getFunctions(app);

// Connect to emulators in development
if (process.env.NODE_ENV === 'development') {
    connectFunctionsEmulator(functions, 'localhost', 5001);
    console.log('Connected to Firebase emulators');
} 