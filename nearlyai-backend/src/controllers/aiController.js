const { GoogleGenerativeAI } = require('@google/generative-ai');
const getDb = require('../utils/db');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.generateProfile = async (req, res) => {
    try {
        const { business_name, category, services } = req.body;
        if (!business_name) return res.status(400).json({ error: 'business_name required' });
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(
            `Write a professional business description for a ${category || 'local'} business called "${business_name}" in Pakistan.
      ${services ? 'They offer: ' + services : ''}
      Keep it under 150 words. Make it sound professional and trustworthy. Include a tagline.`
        );
        res.json({ description: result.response.text() });
    } catch (err) { res.status(500).json({ error: 'AI unavailable: ' + err.message }); }
};

exports.customerQuery = async (req, res) => {
    try {
        const { question } = req.body;
        const businessId = req.params.id;
        if (!question) return res.status(400).json({ error: 'Question required' });

        const db = await getDb();
        const biz = await db.get('SELECT * FROM businesses WHERE id = ?', businessId);
        if (!biz) return res.status(404).json({ error: 'Business not found' });

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(
            `You are a helpful assistant for the business "${biz.name}".
      Business description: ${biz.description}
      Location: ${biz.address}, ${biz.area}, ${biz.city}
      Phone: ${biz.phone}
      
      Customer question: ${question}
      
      Answer helpfully based on the business info. If you don't know, say "Please contact the business directly at ${biz.phone}".`
        );
        const answer = result.response.text();

        await db.run('INSERT INTO ai_query_log (business_id, question, answer) VALUES (?, ?, ?)', businessId, question, answer);

        res.json({ answer });
    } catch (err) { res.status(500).json({ error: 'AI unavailable: ' + err.message }); }
};
