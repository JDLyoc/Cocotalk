# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Environment Variable Setup

This project uses a `.env` file to store secret keys for both Firebase and Google AI services.

### Firebase Setup (Authentication, Database, Storage)

1.  **Create a Firebase Project:** If you don't have one, create a new project at the [Firebase Console](https://console.firebase.google.com/).

2.  **Enable Services:** In your Firebase project, go to the **Build** section and enable **Authentication** (with the Email/Password provider), **Firestore Database**, and **Storage**.

3.  **Get Web App Config:** In Project Settings (gear icon), find your web app's configuration keys.

4.  **Set Firebase Variables:** In the `.env` file, fill in all the `NEXT_PUBLIC_FIREBASE_*` variables with the values from your web app config. Also, set the `NEXT_PUBLIC_ADMIN_EMAIL` to the email you want to use for the admin account.

### Google AI Setup (Gemini API)

The app's AI features require a separate API key.

1.  **Enable Gemini API:** Go to the [Google Cloud Console](https://console.cloud.google.com/) for the *same project*. Search for and enable the **"Gemini API"**. Your project may also require billing to be enabled to use the API.

2.  **Create API Key:** In the Google Cloud Console, navigate to **APIs & Services > Credentials**. Click **Create Credentials** and choose **API key**.

3.  **Set Google AI Variable:** Copy the new API key and paste it as the value for `GOOGLE_API_KEY` in your `.env` file.

Once all variables in `.env` are set, restart your development server for the changes to take effect.
