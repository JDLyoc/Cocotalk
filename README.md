# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Environment Variable Setup

This project uses a `.env` file to store secret keys for Firebase, Google AI, and Web Search services.

### Firebase Setup (Authentication, Database, Storage)

1.  **Create a Firebase Project:** If you don't have one, create a new project at the [Firebase Console](https://console.firebase.google.com/).

2.  **Enable Services:** In your Firebase project, go to the **Build** section and enable **Authentication** (with the Email/Password provider), **Firestore Database**, and **Storage**.

3.  **Get Web App Config:** In Project Settings (gear icon), find your web app's configuration keys.

4.  **Set Firebase Variables:** In the `.env` file, fill in all the `NEXT_PUBLIC_FIREBASE_*` variables with the values from your web app config. Also, set the `NEXT_PUBLIC_ADMIN_EMAIL` to the email you want to use for the admin account.

### Google AI Setup (Gemini API)

The app's AI features require a separate API key and configuration in the Google Cloud Console, which is linked to your Firebase project.

**CRITICAL: Ensure you are performing these steps in the Google Cloud Console for the *exact same project* as your Firebase project.** You can select your project at the top of the Google Cloud Console.

1.  **Enable Billing:** Many Google Cloud services, including the Gemini API, require a billing account to be linked to the project, even if your usage falls within the free tier.
    *   Go to the [Google Cloud Console](https://console.cloud.google.com/).
    *   Select your project (`cocotalk-72wpf`).
    *   In the navigation menu (☰), go to **Billing**.
    *   Follow the instructions to link your active billing account to this project.

2.  **Enable Gemini API:**
    *   In the Google Cloud Console search bar at the top, type **"Gemini API"**.
    *   Select it from the results and click **Enable**.

3.  **Create API Key:**
    *   In the Google Cloud Console, navigate to **APIs & Services > Credentials**.
    *   Click **Create Credentials** and choose **API key**.
    *   For development, it's recommended to temporarily remove all restrictions from the key to ensure it works, and add them back later if needed.

4.  **Set Google AI Variable:** Copy the new API key and paste it as the value for `GOOGLE_API_KEY` in your `.env` file.

### Web Search Setup (Optional)

The chat can perform live web searches for recent information. This requires a third-party API key. You only need to configure **one** of the following services. Serper is recommended as it has a generous free tier.

-   **Option 1 (Recommended): Serper API**
    1.  Go to [serper.dev](https://serper.dev/) and sign up for a free account.
    2.  Find your API key in your dashboard.
    3.  Add it to your `.env` file: `SERPER_API_KEY="your_serper_key"`

-   **Option 2: Brave Search API**
    1.  Go to [brave.com/search/api/](https://brave.com/search/api/) and get a key.
    2.  Add it to your `.env` file: `BRAVE_API_KEY="your_brave_key"`

-   **Option 3: Google Custom Search API**
    1.  This is more complex to set up. You need a Google API Key (you can use the same one as for Gemini) and a "Programmable Search Engine ID".
    2.  Follow the instructions [here](https://developers.google.com/custom-search/v1/overview) to create a search engine.
    3.  Add both to your `.env` file:
        `GOOGLE_SEARCH_API_KEY="your_google_api_key"`
        `GOOGLE_SEARCH_ENGINE_ID="your_search_engine_id"`

Once all variables in `.env` are set, restart your development server for the changes to take effect.
