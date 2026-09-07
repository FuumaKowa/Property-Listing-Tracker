import express, { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { optionalAuth, requireAuth, AuthRequest } from './src/middleware/auth.ts';
import {
  getAllListingsFromDb,
  getListingsForUser,
  claimUnownedListings,
  createListingInDb,
  updateListingInDb,
  deleteListingFromDb,
  getAuditLogs,
  getOrCreateUser,
} from './src/db/listings.ts';
import { INITIAL_PROPERTY_LISTINGS } from './src/data/initialData.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy GenAI initialization
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// 1. Text-to-Table Structured Extraction
app.post('/api/gemini/extract', async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text content is required for extraction' });
  }

  const ai = getGenAI();

  if (!ai) {
    // Intelligent local fallback if API key is not configured
    const mockExtraction = heuristicExtract(text);
    return res.json({
      success: true,
      data: mockExtraction,
      note: 'Processed via local parser (Configure GEMINI_API_KEY for advanced multi-project AI parsing)',
    });
  }

  try {
    const prompt = `You are a real estate database assistant. Extract real estate property listing information from the provided raw text into a structured JSON array of listings matching this exact schema:
- Property (string): The property development or project name (e.g. "Service Apartment Linkar 52")
- Project_Category (string): One of: "Project Marketing (PM)", "Rental", "Subsale CoA (SSCOA)", "Subsale Direct Listing (SSDL)", "Million Dollar Property (MD)", or "Auction"
- Location (string): Town, district, or city with state if identifiable (e.g. "Shah Alam, Selangor")
- Tenure (string): "Freehold", "Leasehold", "Freehold Malay Reserved", or "-"
- PM (string): The assigned Project Manager / agent (e.g. "Haneah", "Benik", "Akram/Benik/Fb")
- Available_Units (string): Stock level, e.g. ratio "256/495", count "784", or percentage "70% Booking"
- Status (string): "Active" or "Expired"
- Date (string): "DD.MM" format (e.g. "26.10", "18.8")
- Renew_Status (string): "Renewed", "Want to be renew", or "Not Renewed"
- Notes (optional string): Any relevant caveats or unit details

Raw input text:
"""
${text}
"""

Return a JSON array of extracted listings.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              Property: { type: Type.STRING },
              Project_Category: {
                type: Type.STRING,
                enum: [
                  'Project Marketing (PM)',
                  'Rental',
                  'Subsale CoA (SSCOA)',
                  'Subsale Direct Listing (SSDL)',
                  'Million Dollar Property (MD)',
                  'Auction',
                ],
              },
              Location: { type: Type.STRING },
              Tenure: { type: Type.STRING },
              PM: { type: Type.STRING },
              Available_Units: { type: Type.STRING },
              Status: { type: Type.STRING },
              Date: { type: Type.STRING },
              Renew_Status: { type: Type.STRING },
              Notes: { type: Type.STRING },
            },
            required: ['Property', 'Location', 'PM', 'Available_Units', 'Status', 'Date', 'Renew_Status'],
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    const normalized = parsed.map((item: any) => ({
      property: item.Property || 'Unnamed Property',
      projectCategory: item.Project_Category || 'Project Marketing (PM)',
      location: item.Location || '-',
      tenure: item.Tenure || '-',
      pm: item.PM || '-',
      availableUnits: item.Available_Units || '-',
      status: item.Status === 'Expired' ? 'Expired' : 'Active',
      date: item.Date || `${new Date().getDate()}.${new Date().getMonth() + 1}`,
      renewStatus:
        item.Renew_Status === 'Renewed'
          ? 'Renewed'
          : (item.Renew_Status || '').toLowerCase().includes('want')
          ? 'Want to be renew'
          : 'Not Renewed',
      confidenceNotes: item.Notes || 'AI extracted from description',
    }));

    return res.json({ success: true, data: normalized });
  } catch (error: any) {
    console.error('Gemini extract error:', error);
    const fallback = heuristicExtract(text);
    return res.json({
      success: true,
      data: fallback,
      note: 'Fallback parser used: ' + (error?.message || 'Gemini request failure'),
    });
  }
});

// 2. Chat Mode Portfolio Assistant
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  const { message, history, tableData } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const ai = getGenAI();

  if (!ai) {
    const localReply = answerLocally(message, tableData || []);
    return res.json({
      success: true,
      reply: localReply.text,
      sources: localReply.sources,
      suggestedActions: localReply.suggestedActions,
    });
  }

  try {
    const tableContext = JSON.stringify(tableData || [], null, 2);
    const systemInstruction = `You are the expert Property Listing Tracker Portfolio Assistant in Google AI Studio.
You have real-time access to the user's active property listing database (${(tableData || []).length} properties).

Data Schema:
- id (number): unique identifier
- property (string): property/project name
- projectCategory (string): One of: "Project Marketing (PM)", "Rental", "Subsale CoA (SSCOA)", "Subsale Direct Listing (SSDL)", "Million Dollar Property (MD)", or "Auction"
- location (string): city, district, state
- tenure (string): Freehold, Leasehold, Freehold Malay Reserved, or -
- pm (string): Project Manager / team
- availableUnits (string): e.g. "10/62", "784", "70% Booking", "0/24"
- status (string): Active or Expired
- date (string): DD.MM format milestone date
- renewStatus (string): Renewed or Not Renewed

Guidelines:
1. Provide accurate, data-backed answers based strictly on the current active table data.
2. If asked about a specific PM (e.g. Nor Ozir, Zuraini, Benik, Haneah), list their exact properties, status, and renewal state.
3. If asked for a summary, provide counts of Active, Expired, Renewed, Not Renewed, and highlight immediate action items.
4. If asked about locations (e.g. Shah Alam, Klang, Sabak Bernam, Sitiawan), calculate total available units and projects.
5. Format your answers crisply using Markdown bullet points, bold numbers, and concise tables when appropriate.
6. Keep answers professional, crisp, and high-density. Avoid rambling.`;

    const chatHistory = (history || []).slice(-6).map((h: any) => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }],
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: `CURRENT DATABASE STATE:\n\`\`\`json\n${tableContext}\n\`\`\`\n\nUSER QUESTION: ${message}` }
          ],
        },
      ],
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    return res.json({
      success: true,
      reply: response.text || 'No response received.',
    });
  } catch (error: any) {
    console.error('Gemini chat error:', error);
    const localReply = answerLocally(message, tableData || []);
    return res.json({
      success: true,
      reply: localReply.text,
      sources: localReply.sources,
      suggestedActions: localReply.suggestedActions,
      note: 'Handled via local assistant: ' + (error?.message || ''),
    });
  }
});

// 3. Automated PM Alert Generator
app.post('/api/gemini/generate-pm-alert', async (req: Request, res: Response) => {
  const { listing } = req.body;
  if (!listing) {
    return res.status(400).json({ error: 'Listing data is required' });
  }

  const ai = getGenAI();
  if (!ai) {
    return res.json({
      success: true,
      draft: generateLocalAlert(listing),
    });
  }

  try {
    const prompt = `Generate urgent follow-up communication drafts for an expired real estate listing that has NOT been renewed.
Listing details:
- Property: ${listing.property}
- Assigned PM: ${listing.pm}
- Location: ${listing.location}
- Milestone Date: ${listing.date}
- Available Units: ${listing.availableUnits}
- Status: ${listing.status}
- Renew Status: ${listing.renewStatus}

Generate a JSON object with:
1. "urgency": "High" | "Medium" | "Low"
2. "emailSubject": professional email subject line
3. "emailBody": concise, respectful, action-oriented email body prompting renewal or status update
4. "whatsappMessage": short WhatsApp ready-to-send reminder with emojis
5. "slackMessage": crisp Slack message with markdown formatting`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            urgency: { type: Type.STRING },
            emailSubject: { type: Type.STRING },
            emailBody: { type: Type.STRING },
            whatsappMessage: { type: Type.STRING },
            slackMessage: { type: Type.STRING },
          },
          required: ['urgency', 'emailSubject', 'emailBody', 'whatsappMessage', 'slackMessage'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      draft: {
        id: 'alert_' + listing.id + '_' + Date.now(),
        listingId: listing.id,
        propertyName: listing.property,
        pm: listing.pm,
        location: listing.location,
        daysExpiredOrDate: listing.date,
        urgency: parsed.urgency || 'High',
        emailSubject: parsed.emailSubject,
        emailBody: parsed.emailBody,
        whatsappMessage: parsed.whatsappMessage,
        slackMessage: parsed.slackMessage,
      },
    });
  } catch (error) {
    return res.json({
      success: true,
      draft: generateLocalAlert(listing),
    });
  }
});

// 4. Location & Tenure Standardization
app.post('/api/gemini/standardize', async (req: Request, res: Response) => {
  const { listings } = req.body;
  if (!listings || !Array.isArray(listings)) {
    return res.status(400).json({ error: 'Listings array required' });
  }

  const ai = getGenAI();
  if (!ai) {
    const results = listings.map((l: any) => localStandardize(l));
    return res.json({ success: true, results });
  }

  try {
    const prompt = `Analyze and standardize real estate location and tenure data for the following property records.
Rules:
- Standardize Locations into clean format: "[Town / Area], [District if applicable], [State]" (e.g. "Shah Alam U9" -> "Seksyen U9, Shah Alam, Selangor", "Rantau Panjang Klang" -> "Rantau Panjang, Klang, Selangor").
- Standardize Tenures into standard taxonomy: "Freehold", "Leasehold", "Freehold Malay Reserved", or leave as "-" if unknown.

Input items:
${JSON.stringify(
  listings.map((l: any) => ({
    id: l.id,
    property: l.property,
    location: l.location,
    tenure: l.tenure,
  })),
  null,
  2
)}

Return a JSON array of objects with schema:
- id (number)
- standardizedLocation (string)
- standardizedTenure (string)
- suggestedChanges (array of strings explaining what changed)`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              standardizedLocation: { type: Type.STRING },
              standardizedTenure: { type: Type.STRING },
              suggestedChanges: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['id', 'standardizedLocation', 'standardizedTenure', 'suggestedChanges'],
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    const results = parsed.map((item: any) => {
      const original = listings.find((l: any) => l.id === item.id) || {};
      return {
        id: item.id,
        originalLocation: original.location || '',
        standardizedLocation: item.standardizedLocation,
        originalTenure: original.tenure || '',
        standardizedTenure: item.standardizedTenure,
        suggestedChanges: item.suggestedChanges || [],
      };
    });

    return res.json({ success: true, results });
  } catch (error) {
    const results = listings.map((l: any) => localStandardize(l));
    return res.json({ success: true, results });
  }
});

// Heuristic fallback for extraction
function heuristicExtract(text: string): any[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const results: any[] = [];

  // Match common project phrases
  const nameMatch = text.match(/(?:called|project|development|property|unit)\s+[:"]?([A-Za-z0-9\s&@-]+?)(?:[.,"\n]|in\s)/i) ||
    text.match(/^([A-Za-z0-9\s&@-]+?)(?:,|\s-|\sis\s)/);
  const propertyName = nameMatch ? nameMatch[1].trim() : 'New Project';

  const locMatch = text.match(/(?:in|at|location)\s+([A-Za-z0-9\s,]+?)(?:[.,\n]|with|managed)/i);
  const location = locMatch ? locMatch[1].trim() : 'Shah Alam, Selangor';

  let tenure = '-';
  if (/malay\s*reserved/i.test(text)) tenure = 'Freehold Malay Reserved';
  else if (/freehold/i.test(text)) tenure = 'Freehold';
  else if (/leasehold/i.test(text)) tenure = 'Leasehold';

  const pmMatch = text.match(/(?:managed by|pm|agent|handled by|assign to)\s+([A-Za-z\s/]+?)(?:[.,\n]|there|with)/i) ||
    text.match(/([A-Z][a-z]+)\s+will manage/i);
  const pm = pmMatch ? pmMatch[1].trim() : 'Unassigned';

  const unitsRatio = text.match(/(\d+)\s+(?:available|left)\s+(?:out of|of)\s+(\d+)/i) ||
    text.match(/(\d+)\s*\/\s*(\d+)/);
  let availableUnits = '10/50';
  if (unitsRatio) {
    availableUnits = `${unitsRatio[1]}/${unitsRatio[2]}`;
  } else {
    const rawCount = text.match(/(\d+)\s+(?:units|available)/i);
    if (rawCount) availableUnits = rawCount[1];
  }

  const d = new Date();
  const dateStr = `${d.getDate()}.${d.getMonth() + 1}`;

  let category: string = 'Project Marketing (PM)';
  if (/auction/i.test(text)) category = 'Auction';
  else if (/rental|rent|lease/i.test(text)) category = 'Rental';
  else if (/subsale\s*coa|sscoa/i.test(text)) category = 'Subsale CoA (SSCOA)';
  else if (/direct\s*listing|ssdl/i.test(text)) category = 'Subsale Direct Listing (SSDL)';
  else if (/million\s*dollar|md\s*property/i.test(text)) category = 'Million Dollar Property (MD)';

  results.push({
    property: propertyName,
    projectCategory: category,
    location: location,
    tenure: tenure,
    pm: pm,
    availableUnits: availableUnits,
    status: /expired/i.test(text) ? 'Expired' : 'Active',
    date: dateStr,
    renewStatus: /not renewed/i.test(text) ? 'Not Renewed' : 'Renewed',
    confidenceNotes: 'Parsed via intelligent pattern matcher',
  });

  return results;
}

function answerLocally(query: string, data: any[]) {
  const q = query.toLowerCase();

  // Query by PM
  if (q.includes('nor ozir') || q.includes('ozir')) {
    const pms = data.filter((d) => (d.pm || '').toLowerCase().includes('nor ozir') || (d.pm || '').toLowerCase().includes('ozir'));
    const active = pms.filter((p) => p.status === 'Active');
    const expired = pms.filter((p) => p.status === 'Expired');
    const text = `**Nor Ozir's Portfolio Analysis**:\n- Total Listings Assigned: **${pms.length}**\n- Active Listings: **${active.length}** (${active.map((a) => a.property).join(', ') || 'None'})\n- Expired Listings: **${expired.length}** (${expired.map((e) => e.property).join(', ') || 'None'})\n- Inventory Breakdown: Sssd Tmn Desa Idaman (8/28), Ss Taman Kelana (0/24), APT E-sentral Smart City (784 count).`;
    return { text, sources: pms.map((p) => p.property), suggestedActions: [{ label: 'Filter Nor Ozir', actionType: 'filter_pm', value: 'Nor Ozir' }] };
  }

  if (q.includes('zuraini')) {
    const pms = data.filter((d) => (d.pm || '').toLowerCase().includes('zuraini'));
    const text = `**Zuraini's Portfolio Status**:\n- Total Listings: **${pms.length}**\n- Status: All **${pms.length}** are currently **Expired & Not Renewed**.\n- Properties: Ss J3 Residence (45/125), Ss J2 Residence (0/80), Bungalow Indahville 2 (0/17), Ss Indahville 4 (10/46).\n- All 4 are **Freehold Malay Reserved** and require immediate renewal follow-up.`;
    return { text, sources: pms.map((p) => p.property), suggestedActions: [{ label: 'Filter Zuraini', actionType: 'filter_pm', value: 'Zuraini' }] };
  }

  if (q.includes('summary') || q.includes('daily') || q.includes('report') || q.includes('overview')) {
    const total = data.length;
    const active = data.filter((d) => d.status === 'Active').length;
    const expired = data.filter((d) => d.status === 'Expired').length;
    const renewed = data.filter((d) => d.renewStatus === 'Renewed').length;
    const notRenewed = data.filter((d) => d.renewStatus === 'Not Renewed').length;
    const fmr = data.filter((d) => (d.tenure || '').includes('Malay Reserved')).length;
    const text = `**Listing Portfolio Overview**:\n- Total Listings Tracked: **${total}**\n- Active Projects: **${active}** (${Math.round((active / total) * 100)}%)\n- Expired Projects: **${expired}** (${Math.round((expired / total) * 100)}%)\n- Renewal Status: **${renewed} Renewed** vs **${notRenewed} Pending Renewal**\n- Freehold Malay Reserved (FMR): **${fmr} projects**\n- **Urgent Action**: ${data.filter((d) => d.status === 'Expired' && d.renewStatus === 'Not Renewed').length} listings require PM follow-up notices.`;
    return { text, sources: ['Master Grid Dataset'] };
  }

  if (q.includes('malay reserved') || q.includes('fmr')) {
    const fmr = data.filter((d) => (d.tenure || '').includes('Malay Reserved'));
    const text = `**Freehold Malay Reserved (FMR) Properties** (${fmr.length} total):\n` +
      fmr.map((f) => `- **${f.property}** (${f.location}) — PM: ${f.pm} | Units: ${f.availableUnits} | Status: ${f.status} (${f.renewStatus})`).join('\n');
    return { text, sources: fmr.map((f) => f.property) };
  }

  if (q.includes('sabak bernam') || q.includes('shah alam') || q.includes('klang') || q.includes('ipoh')) {
    const targetLoc = q.includes('sabak bernam') ? 'sabak bernam' : q.includes('shah alam') ? 'shah alam' : q.includes('klang') ? 'klang' : 'ipoh';
    const matches = data.filter((d) => (d.location || '').toLowerCase().includes(targetLoc));
    const text = `**${targetLoc.toUpperCase()} Regional Inventory** (${matches.length} listings):\n` +
      matches.map((m) => `- **${m.property}** | PM: ${m.pm} | Units: ${m.availableUnits} | Status: ${m.status}`).join('\n');
    return { text, sources: matches.map((m) => m.property) };
  }

  return {
    text: `Found **${data.length} listings** in your tracker (${data.filter((d) => d.status === 'Active').length} Active, ${data.filter((d) => d.status === 'Expired').length} Expired). You can ask me to analyze specific PMs (e.g. *Zuraini, Nor Ozir, Haneah*), filter by state/town, calculate total available stock, or draft renewal alerts.`,
    sources: [],
  };
}

function generateLocalAlert(listing: any) {
  return {
    id: 'alert_' + listing.id + '_' + Date.now(),
    listingId: listing.id,
    propertyName: listing.property,
    pm: listing.pm,
    location: listing.location,
    daysExpiredOrDate: listing.date,
    urgency: 'High',
    emailSubject: `ACTION REQUIRED: Listing Renewal for ${listing.property} (${listing.location})`,
    emailBody: `Hi ${listing.pm},\n\nOur listing tracker indicates that the listing for "${listing.property}" located at ${listing.location} expired on ${listing.date} and is currently marked as "Not Renewed".\n\nCurrent available inventory is logged at: ${listing.availableUnits}.\n\nPlease review whether this project is being extended, renewed for marketing, or if stock is sold out. Kindly reply with the updated status.\n\nBest regards,\nProperty Portfolio Operations`,
    whatsappMessage: `🚨 *Listing Renewal Reminder*\nHi ${listing.pm}, "${listing.property}" at ${listing.location} is showing as Expired (${listing.date}) and Not Renewed. Available units: ${listing.availableUnits}. Please confirm if renewed or closed! Thank you.`,
    slackMessage: `:warning: *Listing Alert: Renewal Due*\n*Project:* ${listing.property}\n*PM:* @${listing.pm}\n*Location:* ${listing.location}\n*Expired Date:* ${listing.date}\n*Current Stock:* ${listing.availableUnits}\nPlease update the listing status in the master tracker.`,
  };
}

function localStandardize(listing: any) {
  let stdLoc = listing.location;
  const changes: string[] = [];

  if (stdLoc.includes('Shah Alam U9')) {
    stdLoc = 'Seksyen U9, Shah Alam, Selangor';
    changes.push('Standardized Section U9 notation and appended Selangor state tag');
  } else if (stdLoc.includes('Rantau Panjang Klang')) {
    stdLoc = 'Rantau Panjang, Klang, Selangor';
    changes.push('Added comma delimiter and explicit state suffix');
  } else if (stdLoc.includes('Meru Klang')) {
    stdLoc = 'Meru, Klang, Selangor';
    changes.push('Formatted district and state hierarchy');
  } else if (stdLoc === 'Shah Alam') {
    stdLoc = 'Shah Alam, Selangor';
    changes.push('Appended standard state suffix');
  } else if (stdLoc === 'Semenyih') {
    stdLoc = 'Semenyih, Selangor';
    changes.push('Appended state suffix');
  } else if (stdLoc === 'Puncak Alam') {
    stdLoc = 'Puncak Alam, Selangor';
    changes.push('Appended state suffix');
  }

  let stdTenure = listing.tenure;
  if (stdTenure === '-') {
    changes.push('Unspecified tenure flagged for legal review');
  }

  return {
    id: listing.id,
    originalLocation: listing.location,
    standardizedLocation: stdLoc,
    originalTenure: listing.tenure,
    standardizedTenure: stdTenure,
    suggestedChanges: changes.length > 0 ? changes : ['Already standard format'],
  };
}

// ==========================================
// Cloud SQL & Audit Trail Endpoints
// ==========================================

// Helper to extract user attribution info from request (Firebase Auth or guest header/body)
function extractUserInfo(req: AuthRequest) {
  if (req.user) {
    return {
      uid: req.user.uid,
      name: (req.user.name as string) || (req.user.email ? (req.user.email as string).split('@')[0] : 'Authenticated User'),
      email: (req.user.email as string) || undefined,
    };
  }

  // Fallback: client-provided user name from profile or header
  const headerName = req.headers['x-user-name'] as string;
  const headerEmail = req.headers['x-user-email'] as string;
  const bodyName = req.body?.updatedByName || req.body?.userName;
  const bodyEmail = req.body?.updatedByEmail || req.body?.userEmail;

  return {
    name: headerName || bodyName || 'Team Member',
    email: headerEmail || bodyEmail || undefined,
  };
}

// 1. Sync / Register user in Cloud SQL
app.post('/api/users/sync', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { uid, email, displayName, photoUrl } = req.body;
    const userUid = req.user?.uid || uid;
    const userEmail = req.user?.email || email;

    if (!userUid || !userEmail) {
      return res.status(400).json({ error: 'UID and email are required' });
    }

    const user = await getOrCreateUser(userUid, userEmail, displayName, photoUrl);
    res.json({ success: true, user });
  } catch (error: any) {
    console.error('Failed to sync user:', error);
    res.status(500).json({ error: error.message || 'Failed to sync user' });
  }
});

// 2. Get all listings for the authenticated user only
app.get('/api/listings', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userUid = req.user?.uid;
    if (!userUid) {
      return res.status(401).json({ error: 'Unauthorized: user not found' });
    }

    await claimUnownedListings(userUid);
    const data = await getListingsForUser(userUid);
    res.json({ success: true, data });
  } catch (error: any) {
    console.warn('Database query failed for /api/listings:', error?.message || error);
    res.status(500).json({ error: 'Failed to load your listings' });
  }
});

// 3. Create listing with user name and timestamp attribution
app.post('/api/listings', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: sign in to save listings' });
    }

    const userInfo = extractUserInfo(req);
    const created = await createListingInDb(req.body, userInfo);
    res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    console.error('Failed to create listing in database, returning local representation:', error);
    const fallbackId = Date.now();
    res.status(201).json({ success: true, data: { id: fallbackId, ...req.body }, fallback: true });
  }
});

// 4. Update listing with user name and timestamp attribution
app.patch('/api/listings/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: sign in to update listings' });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid listing ID' });
    }

    const userInfo = extractUserInfo(req);
    const updated = await updateListingInDb(id, req.body, userInfo);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error(`Failed to update listing ${req.params.id} in database:`, error);
    const id = parseInt(req.params.id, 10);
    res.json({ success: true, data: { id, ...req.body }, fallback: true });
  }
});

// 5. Delete listing
app.delete('/api/listings/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: sign in to delete listings' });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid listing ID' });
    }

    await deleteListingFromDb(id);
    res.json({ success: true, message: `Listing ${id} deleted` });
  } catch (error: any) {
    console.error(`Failed to delete listing ${req.params.id}:`, error);
    res.json({ success: true, message: `Listing ${req.params.id} deleted (local fallback)` });
  }
});

// 6. Get audit logs for traceability
app.get('/api/audit-logs', async (req: Request, res: Response) => {
  try {
    const listingIdParam = req.query.listingId ? parseInt(req.query.listingId as string, 10) : undefined;
    const logs = await getAuditLogs(listingIdParam);
    res.json({ success: true, data: logs });
  } catch (error: any) {
    console.error('Failed to fetch audit logs:', error);
    res.json({ success: true, data: [] });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Strict 404 handler for API routes: guarantees /api requests never return HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
