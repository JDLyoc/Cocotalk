# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Firebase Setup

This project uses Firebase for features like logo uploading and storage. To connect your Firebase project:

1.  **Create a Firebase Project:** If you don't have one, create a new project at the [Firebase Console](https://console.firebase.google.com/).

2.  **Enable Services:** In your Firebase project, enable **Firestore Database** and **Storage**.

3.  **Get Config Keys:** Go to your Project Settings (click the gear icon) and find your web app's configuration keys.

4.  **Set Environment Variables:**
    *   Create a new file named `.env` in the root of your project.
    *   Copy the content of `.env.example` into your new `.env` file.
    *   Replace the placeholder values with your actual Firebase configuration keys.

The application will now be connected to your Firebase backend.
