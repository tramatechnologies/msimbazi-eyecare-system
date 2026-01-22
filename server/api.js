/**
 * Backend API Proxy Server
 * Handles AI service calls server-side to protect API keys
 * Run with: node server/api.js
 */

import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Validate API key before starting server
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
if (!apiKey) {
  console.error('FATAL ERROR: GEMINI_API_KEY or API_KEY environment variable is not set');
  console.error('Please set GEMINI_API_KEY in your .env file');
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// Initialize AI client (API key stays on server)
const ai = new GoogleGenAI({ 
  apiKey: apiKey
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// AI Clinical Support endpoint
app.post('/api/clinical/ai-insights', async (req, res) => {
  try {
    const { chiefComplaint, notes } = req.body;

    if (!chiefComplaint && !notes) {
      return res.status(400).json({ 
        error: 'Chief complaint or notes required' 
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        Analyze the following eye clinic chief complaint and preliminary notes. 
        Suggest potential ICD-10 codes and management considerations for an optometrist.
        Chief Complaint: ${chiefComplaint || 'Not provided'}
        Notes: ${notes || 'Not provided'}
        Return the result as a concise summary.
      `,
    });

    res.json({ 
      insights: response.text || 'No insights available.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI Service Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate AI insights',
      message: error.message 
    });
  }
});

// AI Diagnosis Suggestion endpoint
app.post('/api/clinical/ai-diagnosis', async (req, res) => {
  try {
    const { chiefComplaint, examinationFindings } = req.body;

    if (!chiefComplaint && !examinationFindings) {
      return res.status(400).json({ 
        error: 'Chief complaint or examination findings required' 
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        As an optometrist, analyze the following patient presentation and examination findings.
        Provide a concise, professional diagnosis suggestion (2-3 sentences maximum).
        
        Chief Complaint: ${chiefComplaint || 'Not provided'}
        Examination Findings: ${examinationFindings || 'Not provided'}
        
        Return only the diagnosis suggestion without additional commentary.
      `,
    });

    res.json({ 
      suggestion: response.text || 'No diagnosis suggestion available.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI Diagnosis Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate diagnosis suggestion',
      message: error.message 
    });
  }
});

// AI ICD-10 Code Suggestion endpoint
app.post('/api/clinical/ai-icd10', async (req, res) => {
  try {
    const { diagnosis, chiefComplaint } = req.body;

    if (!diagnosis && !chiefComplaint) {
      return res.status(400).json({ 
        error: 'Diagnosis or chief complaint required' 
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        Based on the following diagnosis, suggest the most appropriate ICD-10 code for ophthalmology.
        Return ONLY the ICD-10 code in the format "HXX.X" (e.g., H52.1, H40.11) without any additional text.
        
        Diagnosis: ${diagnosis || 'Not provided'}
        Chief Complaint: ${chiefComplaint || 'Not provided'}
      `,
    });

    res.json({ 
      suggestion: response.text.trim().replace(/[^H0-9.]/g, '').substring(0, 8) || '',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI ICD-10 Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate ICD-10 suggestion',
      message: error.message 
    });
  }
});

// AI Treatment Plan Suggestion endpoint
app.post('/api/clinical/ai-treatment', async (req, res) => {
  try {
    const { diagnosis, examinationFindings } = req.body;

    if (!diagnosis && !examinationFindings) {
      return res.status(400).json({ 
        error: 'Diagnosis or examination findings required' 
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        As an optometrist, suggest a comprehensive treatment plan for the following diagnosis.
        Include: medications (if needed), follow-up schedule, lifestyle modifications, and patient education.
        Keep it concise and professional (3-4 sentences).
        
        Diagnosis: ${diagnosis || 'Not provided'}
        Examination Findings: ${examinationFindings || 'Not provided'}
      `,
    });

    res.json({ 
      suggestion: response.text || 'No treatment plan suggestion available.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI Treatment Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate treatment plan suggestion',
      message: error.message 
    });
  }
});

// AI Medication Suggestion endpoint
app.post('/api/clinical/ai-medications', async (req, res) => {
  try {
    const { diagnosis, chiefComplaint, allergies } = req.body;

    if (!diagnosis && !chiefComplaint) {
      return res.status(400).json({ 
        error: 'Diagnosis or chief complaint required' 
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        As an optometrist, suggest appropriate ophthalmic medications for the following condition.
        Include medication name, strength, frequency, and duration.
        Consider patient allergies: ${allergies || 'None reported'}
        
        Diagnosis: ${diagnosis || 'Not provided'}
        Chief Complaint: ${chiefComplaint || 'Not provided'}
        
        Format: List each medication with dosage and frequency (e.g., "Timolol 0.5% eye drops, 1 drop twice daily for 4 weeks").
      `,
    });

    res.json({ 
      suggestion: response.text || 'No medication suggestions available.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI Medication Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate medication suggestions',
      message: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`API Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
