import { ExtractionResult, PropertyListing, PMAlertDraft, StandardizationResult } from '../types';

export async function extractListingsWithAI(text: string): Promise<{ success: boolean; data: ExtractionResult[]; note?: string }> {
  try {
    const res = await fetch('/api/gemini/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      throw new Error(`Server error: ${res.statusText}`);
    }
    return await res.json();
  } catch (error: any) {
    console.error('Extract API error:', error);
    throw error;
  }
}

export async function sendChatMessage(
  message: string,
  history: any[],
  tableData: PropertyListing[]
): Promise<{ success: boolean; reply: string; sources?: string[]; suggestedActions?: any[]; note?: string }> {
  try {
    const res = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, tableData }),
    });
    if (!res.ok) {
      throw new Error(`Server error: ${res.statusText}`);
    }
    return await res.json();
  } catch (error: any) {
    console.error('Chat API error:', error);
    throw error;
  }
}

export async function generatePMAlertDraft(listing: PropertyListing): Promise<{ success: boolean; draft: PMAlertDraft }> {
  try {
    const res = await fetch('/api/gemini/generate-pm-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing }),
    });
    if (!res.ok) {
      throw new Error(`Server error: ${res.statusText}`);
    }
    return await res.json();
  } catch (error: any) {
    console.error('PM Alert API error:', error);
    throw error;
  }
}

export async function standardizeListings(listings: PropertyListing[]): Promise<{ success: boolean; results: StandardizationResult[] }> {
  try {
    const res = await fetch('/api/gemini/standardize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listings }),
    });
    if (!res.ok) {
      throw new Error(`Server error: ${res.statusText}`);
    }
    return await res.json();
  } catch (error: any) {
    console.error('Standardize API error:', error);
    throw error;
  }
}
