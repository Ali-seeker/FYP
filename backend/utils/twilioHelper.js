const dotenv = require('dotenv');
dotenv.config();

let twilioClient = null;

if (process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('Twilio Client initialized successfully.');
  } catch (err) {
    console.warn('Twilio library loading failed, falling back to mock logger:', err.message);
  }
} else {
  console.log('Twilio credentials not found. Twilio operations will run in MOCK mode.');
}

/**
 * Send an automated receipt or payment reminder via SMS or WhatsApp.
 * @param {Object} params
 * @param {string} params.to - Customer phone number (e.g. '+923001234567')
 * @param {string} params.message - Body of the message
 * @param {'sms'|'whatsapp'} params.channel - Channel to send the notification through
 * @returns {Promise<{success: boolean, sid?: string, mock: boolean}>}
 */
const sendNotification = async ({ to, message, channel }) => {
  const formattedTo = channel === 'whatsapp' ? `whatsapp:${to}` : to;
  const formattedFrom = channel === 'whatsapp' 
    ? (process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886') 
    : (process.env.TWILIO_SMS_FROM || '+1234567890');

  if (twilioClient) {
    try {
      const res = await twilioClient.messages.create({
        body: message,
        from: formattedFrom,
        to: formattedTo
      });
      return { success: true, sid: res.sid, mock: false };
    } catch (error) {
      console.error(`Twilio execution error on channel ${channel}:`, error.message);
      return { success: false, error: error.message, mock: false };
    }
  } else {
    // MOCK MODE active
    console.log(`[MOCK NOTIFICATION - ${channel.toUpperCase()}]`);
    console.log(`To: ${formattedTo}`);
    console.log(`From: ${formattedFrom}`);
    console.log(`Message: "${message}"`);
    console.log(`-----------------------------------------------`);
    
    // Simulate async latency
    await new Promise(resolve => setTimeout(resolve, 300));
    return { success: true, sid: `MOCK_SID_${Date.now()}`, mock: true };
  }
};

module.exports = { sendNotification };
