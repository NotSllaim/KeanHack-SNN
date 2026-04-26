import express from 'express';
import { callSnowflakeLLM } from '../services/snowflakeSqlService.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'A prompt is required' });
    }

    const aiText = await callSnowflakeLLM(prompt);
    res.json({ response: aiText });
  } catch (error) {
    console.error('API Route Error:', error);
    res.status(500).json({ error: 'Failed to generate response from Snowflake' });
  }
});

export default router;