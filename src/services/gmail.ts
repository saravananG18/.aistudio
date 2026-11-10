import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signOut
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import QRCode from 'qrcode';

// Initialize Firebase App singleton safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Provider with Gmail scopes
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/gmail.compose');
provider.addScope('https://mail.google.com/');

// In-memory token cache (NEVER stored in localStorage per security guidelines)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Convert binary / string to base64url without padding
function base64url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export const getCachedAccessToken = (): string | null => cachedAccessToken;

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

// Listen to auth state changes
export const initGmailAuth = (
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else if (!isSigningIn) {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export interface GoogleAuthResult {
  success: boolean;
  user?: FirebaseUser;
  accessToken?: string;
  cancelled?: boolean;
  error?: string;
}

// Sign in with Google Popup
export const signInWithGoogleForGmail = async (): Promise<GoogleAuthResult> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      return {
        success: false,
        error: 'Failed to obtain Google OAuth access token with Gmail permissions.'
      };
    }
    cachedAccessToken = credential.accessToken;
    return {
      success: true,
      user: result.user,
      accessToken: cachedAccessToken
    };
  } catch (err: any) {
    const errorCode = err?.code || '';
    const errorMsg = err?.message || '';

    // Handle normal user cancellation without logging fatal error to console
    if (
      errorCode === 'auth/popup-closed-by-user' ||
      errorCode === 'auth/cancelled-popup-request' ||
      errorMsg.includes('popup-closed-by-user')
    ) {
      console.info('Google Workspace sign-in popup was dismissed by the user.');
      return {
        success: false,
        cancelled: true,
        error: 'Google Sign-in was cancelled.'
      };
    }

    if (errorCode === 'auth/popup-blocked') {
      console.warn('Google sign-in popup was blocked by browser.');
      return {
        success: false,
        error: 'Sign-in popup was blocked by your browser. Please allow popups for this applet and retry.'
      };
    }

    console.warn('Google Workspace sign-in notice:', errorMsg);
    return {
      success: false,
      error: errorMsg || 'Unable to connect Google account.'
    };
  } finally {
    isSigningIn = false;
  }
};

export const signOutGmail = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// Build and send RFC 2822 MIME message via Gmail REST API
export async function sendGmailMessage(params: {
  to: string;
  subject: string;
  htmlBody: string;
  qrDataUrl?: string; // Optional data:image/png;base64,...
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!cachedAccessToken) {
    return { 
      success: false, 
      error: 'Google account not connected. Please connect Gmail to enable automatic delivery.' 
    };
  }

  const boundary = `====_CIT_BOOKER_${Date.now()}_====`;
  const fromEmail = auth.currentUser?.email || 'me';

  let rawMessage = '';

  if (params.qrDataUrl && params.qrDataUrl.includes(',')) {
    // Multipart/related with inline CID image
    const base64Image = params.qrDataUrl.split(',')[1];

    rawMessage = [
      `From: "CIT Booker Campus Transport" <${fromEmail}>`,
      `To: <${params.to}>`,
      `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(params.subject)))}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/related; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      params.htmlBody,
      ``,
      `--${boundary}`,
      `Content-Type: image/png; name="boarding-qr.png"`,
      `Content-Transfer-Encoding: base64`,
      `Content-ID: <boarding-qr>`,
      `Content-Disposition: inline; filename="boarding-qr.png"`,
      ``,
      base64Image,
      ``,
      `--${boundary}--`
    ].join('\r\n');
  } else {
    // Simple HTML
    rawMessage = [
      `From: "CIT Booker Campus Transport" <${fromEmail}>`,
      `To: <${params.to}>`,
      `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(params.subject)))}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      params.htmlBody
    ].join('\r\n');
  }

  const encodedMessage = base64url(rawMessage);

  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cachedAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: encodedMessage })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Failed to send Gmail message');
    }

    return { success: true, messageId: data.id };
  } catch (err: any) {
    console.error('Gmail send error:', err);
    return { success: false, error: err.message };
  }
}

// 1. Send Booking Confirmation Email with Embedded QR Pass
export async function sendBookingConfirmationGmail(bookingDetails: {
  studentName: string;
  studentEmail: string;
  studentIdNumber?: string;
  bookingReference: string;
  seatId: string;
  busNumber: string;
  busName?: string;
  routeName: string;
  departureTime: string;
  parkingBay: string;
  qrIdentifier: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate QR Data URL
    const qrDataUrl = await QRCode.toDataURL(bookingDetails.qrIdentifier, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF'
      }
    });

    const subject = `CIT Booker — Bus Booking Confirmed [${bookingDetails.bookingReference}]`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
          .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: #2563eb; color: #ffffff; padding: 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
          .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.9; }
          .content { padding: 24px; }
          .qr-box { text-align: center; margin: 20px 0; background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px dashed #cbd5e1; }
          .qr-img { width: 220px; height: 220px; display: inline-block; }
          .meta-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
          .meta-label { color: #64748b; font-weight: 500; }
          .meta-value { color: #0f172a; font-weight: 700; text-align: right; }
          .badge-free { color: #16a34a; font-weight: 800; }
          .footer { padding: 16px 24px; background: #f8fafc; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1>Chennai Institute of Technology</h1>
            <p>Campus Bus Booking Confirmed · Free Student Shuttle (₹0)</p>
          </div>
          <div class="content">
            <p style="font-size: 14px; margin-top: 0;">Dear <strong>${bookingDetails.studentName}</strong>,</p>
            <p style="font-size: 13px; color: #475569; line-height: 1.5;">
              Your seat reservation on <strong>${bookingDetails.busNumber}</strong> (${bookingDetails.routeName}) has been confirmed successfully. Present your personal QR boarding pass below to the driver upon boarding.
            </p>

            <div class="qr-box">
              <img src="cid:boarding-qr" alt="Personal QR Boarding Pass" class="qr-img" />
              <div style="font-size: 11px; font-family: monospace; color: #64748b; margin-top: 8px;">
                Token: ${bookingDetails.qrIdentifier}
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;">Booking Reference</td>
                <td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: 700; color: #2563eb;">${bookingDetails.bookingReference}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;">Assigned Seat</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 800; font-size: 15px; color: #0f172a;">Seat ${bookingDetails.seatId}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;">Bus Number</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #0f172a;">${bookingDetails.busNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;">Route Itinerary</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #334155;">${bookingDetails.routeName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;">Scheduled Pickup</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #0f172a;">${bookingDetails.departureTime}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;">Boarding Terminal</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #334155;">${bookingDetails.parkingBay}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Total Amount Paid</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 800; color: #16a34a;">₹0 (Free Campus Shuttle)</td>
              </tr>
            </table>

            <div style="margin-top: 20px; padding: 12px; background: #eff6ff; border-radius: 8px; font-size: 12px; color: #1e40af;">
              💡 <strong>Boarding Instructions:</strong> Please arrive at your stop 5–10 minutes before the scheduled time. Show this QR code to the driver for digital verification.
            </div>
          </div>
          <div class="footer">
            Chennai Institute of Technology (Autonomous) · Sarathy Nagar, Kundrathur, Chennai - 600069
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendGmailMessage({
      to: bookingDetails.studentEmail,
      subject,
      htmlBody,
      qrDataUrl
    });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 2. Send Boarding Intimation Receipt Email
export async function sendBoardingIntimationGmail(boardingDetails: {
  studentName: string;
  studentEmail: string;
  studentIdNumber?: string;
  bookingReference: string;
  seatId: string;
  busNumber: string;
  routeName: string;
  boardedAt: string;
  driverName?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedTime = new Date(boardingDetails.boardedAt).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const subject = `CIT Booker — Boarding Confirmed for ${boardingDetails.busNumber} [${boardingDetails.bookingReference}]`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
          .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: #16a34a; color: #ffffff; padding: 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 800; }
          .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.95; }
          .content { padding: 24px; }
          .check-badge { text-align: center; margin: 16px 0; font-size: 36px; }
          .footer { padding: 16px 24px; background: #f8fafc; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1>✓ Boarding Verified</h1>
            <p>Chennai Institute of Technology — Campus Transport</p>
          </div>
          <div class="content">
            <p style="font-size: 14px; margin-top: 0;">Dear <strong>${boardingDetails.studentName}</strong>,</p>
            <p style="font-size: 13px; color: #475569; line-height: 1.5;">
              This is an official intimation that your digital QR pass was scanned and verified by the authorized driver. You have boarded <strong>${boardingDetails.busNumber}</strong>.
            </p>

            <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;">Passenger Name</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #0f172a;">${boardingDetails.studentName} (${boardingDetails.studentIdNumber || 'CIT'})</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;">Bus Number</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 800; color: #2563eb;">${boardingDetails.busNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;">Reserved Seat</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #0f172a;">Seat ${boardingDetails.seatId}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;">Route</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #334155;">${boardingDetails.routeName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;">Boarded At (IST)</td>
                <td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: 700; color: #16a34a;">${formattedTime}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Booking Reference</td>
                <td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: 600; color: #64748b;">${boardingDetails.bookingReference}</td>
              </tr>
            </table>

            <div style="margin-top: 20px; padding: 12px; background: #f0fdf4; border-radius: 8px; font-size: 12px; color: #166534; border: 1px solid #bbf7d0;">
              Have a safe journey to Chennai Institute of Technology!
            </div>
          </div>
          <div class="footer">
            Chennai Institute of Technology · Official Transit Boarding Record
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendGmailMessage({
      to: boardingDetails.studentEmail,
      subject,
      htmlBody
    });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
