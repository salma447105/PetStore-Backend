const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const app = express()
const port = 4100

// Load environment variables
dotenv.config()

// Ensure we have our Stripe key
if (!process.env.STRIPE_SECRET_KEY) {
    console.error('Missing STRIPE_SECRET_KEY environment variable');
    process.exit(1);
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

// Configure CORS - allow origin from env or default to localhost:4200
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:4200';
app.use(cors({
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// Parse JSON bodies
app.use(express.json())

app.get('/', (req, res) => {
    res.json({ 
        message: 'Stripe backend server is running',
        status: 'OK',
        timestamp: new Date().toISOString(),
        client: CLIENT_URL
    });
}); 
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { items } = req.body;
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Invalid items array in request' });
        }
        
        const lineItems = items.map(item => ({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.name,
                    description: item.description || undefined,
                },
                unit_amount: Math.round(item.price * 100), // Convert to cents
            },
            quantity: item.quantity || 1,
        }));

        const SUCCESS_URL = process.env.SUCCESS_URL || `${CLIENT_URL}/thank-you?session_id={CHECKOUT_SESSION_ID}`;
        const CANCEL_URL = process.env.CANCEL_URL || `${CLIENT_URL}/cancel`;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            // Redirect URLs after payment success/cancellation handled by Angular
            success_url: SUCCESS_URL,
            cancel_url: CANCEL_URL,
        });

    // Send the Session ID and (when available) hosted URL back to the Angular client
    res.json({ id: session.id, url: session.url || null });

    } catch (error) {
        console.error('Stripe Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/cancel', async (req, res) => {
    // remove data 
})

// Note: Webhooks must use the raw body, not the json() parser, for signature verification.
// You would need to add separate raw body parsing logic for this route.
// See official Stripe documentation for a complete, secure webhook implementation.
// Stripe webhook endpoint - verifies signature when STRIPE_WEBHOOK_SECRET is provided
// Handle raw body for webhook
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET is required. Please set it in your .env file.');
        return res.status(500).send('Webhook secret not configured');
    }

    try {
        const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        
        // Handle different event types
        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object;
                // Handle successful payment
                console.log('Payment successful for session:', session.id);
                
                // Retrieve the session details to get line items
                const checkoutSession = await stripe.checkout.sessions.retrieve(session.id, {
                    expand: ['line_items'],
                });
                
                // Save the order details
                const order = {
                    sessionId: session.id,
                    customerId: session.customer,
                    amount: session.amount_total,
                    items: checkoutSession.line_items.data,
                    status: 'completed',
                    createdAt: new Date(),
                };
                
                // Log the order (replace with your database save logic)
                console.log('Order saved:', order);
                break;

            case 'checkout.session.expired':
                console.log('Session expired:', event.data.object.id);
                // Handle expired checkout sessions
                break;

            case 'payment_intent.succeeded':
                const paymentIntent = event.data.object;
                console.log('Payment succeeded:', paymentIntent.id);
                break;

            case 'payment_intent.payment_failed':
                const failedPayment = event.data.object;
                console.log('Payment failed:', failedPayment.id);
                // Handle failed payments
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true, type: event.type });
    } catch (err) {
        console.error('Webhook Error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
});


// 5. Start the Server
app.listen(port, () => {
    console.log(`Stripe backend server listening at http://localhost:${port}`);
});