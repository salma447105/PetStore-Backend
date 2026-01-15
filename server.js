import express, { Router } from "express";
import Stripe from "stripe";
import 'dotenv/config'
import cors from 'cors';
import payRouter from "./routes/payment.route.js";
const app = express()


// Ensure we have our Stripe key
if (!process.env.STRIPE_SECRET_KEY) {
    console.error('Missing STRIPE_SECRET_KEY environment variable');
    process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Configure CORS - allow origin from env
const CLIENT_URL = process.env.CLIENT_URL;
const PORT = process.env.PORT;
app.use(cors({
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// Parse JSON bodies
app.use(express.json())
app.use('/pay',payRouter)
app.get('/', (req, res) => {
    res.json({ 
        message: 'Server is running',
        status: 'OK',
        timestamp: new Date().toISOString(),
        client: CLIENT_URL
    });
}); 


app.listen(PORT, () => {
    console.log(`Stripe backend server listening at http://localhost:${PORT}`);
});