import { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const gmail = google.gmail('v1');

async function authenticate() {
  const auth = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
  });

  // Ensure the client is authenticated
  // You may need to handle token retrieval and setting here
  google.options({ auth });

  return auth;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { emailId } = req.body;

  try {
    const auth = await authenticate();
    await gmail.users.messages.delete({
      userId: 'me',
      id: emailId,
      auth,
    });
    res.status(200).send('Email deleted successfully');
  } catch (error) {
    console.error('Error deleting email from Gmail:', error);
    res.status(500).send('Failed to delete email');
  }
}
