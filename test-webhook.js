const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function testWebhook() {
    try {
        // Create a test PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 2000, // $20.00
            currency: 'usd',
            payment_method_types: ['card'],
            metadata: {
                order_id: 'test-order-123'
            }
        });

        console.log('Created PaymentIntent:', paymentIntent.id);

        // Confirm the PaymentIntent with a test card
        const confirmedIntent = await stripe.paymentIntents.confirm(
            paymentIntent.id,
            {
                payment_method: 'pm_card_visa' // Test card token
            }
        );

        console.log('Payment status:', confirmedIntent.status);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    require('dotenv').config();
    testWebhook().then(() => process.exit());
}