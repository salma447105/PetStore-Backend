const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 4100;

// Local storage for orders
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir);
  }
}

// Load orders from file
async function loadOrders() {
  try {
    const data = await fs.readFile(ORDERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Save orders to file
async function saveOrders(orders) {
  await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

// Configure CORS
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:4200';
app.use(cors({
  origin: CLIENT_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON bodies
app.use(express.json());

// Initialize data directory
ensureDataDir().catch(console.error);

// Create a new order
app.post('/create-order', async (req, res) => {
  try {
    const { items, userId, shippingAddress } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid items array in request' });
    }

    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const order = {
      id: Date.now().toString(),
      userId,
      items: items.map(item => ({
        productId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        image: item.image
      })),
      total,
      shippingAddress,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const orders = await loadOrders();
    orders.push(order);
    await saveOrders(orders);

    // Simulate payment processing
    setTimeout(async () => {
      const orders = await loadOrders();
      const orderIndex = orders.findIndex(o => o.id === order.id);
      if (orderIndex !== -1) {
        orders[orderIndex].status = 'completed';
        await saveOrders(orders);
      }
    }, 5000); // Simulate 5-second payment processing

    res.json({ 
      orderId: order.id,
      status: 'pending',
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('Order Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get order status
app.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const orders = await loadOrders();
    const order = orders.find(o => o.id === orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's orders
app.get('/orders/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await loadOrders();
    const userOrders = orders.filter(o => o.userId === userId);
    res.json(userOrders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel order
app.post('/cancel-order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const orders = await loadOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);

    if (orderIndex === -1) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (orders[orderIndex].status !== 'pending') {
      return res.status(400).json({ error: 'Can only cancel pending orders' });
    }

    orders[orderIndex].status = 'cancelled';
    await saveOrders(orders);

    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Payment server running on port ${port}`);
});