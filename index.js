const cors = require('cors')
const express = require('express')
const mysql = require('mysql2/promise')
const { v4: uuidv4 } = require('uuid')

require('dotenv').config()

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const app = express()
const port = 8000

// This is your Stripe CLI webhook secret for testing your endpoint locally.
const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET;


app.use(cors())

let conn = null

const initMySQL = async () => {
  conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'store'
  })
}

app.post('/api/checkout', express.json(), async (req, res) => {
    const { product, user } = req.body;  // Change from 'information' to 'user'
    try {
      // create payment session
      const orderId = uuidv4();
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'thb',
              product_data: {
                name: product.name,  // Ensuring product details are correctly used
              },
              unit_amount: product.price * 100,  // Calculating total cost
            },
            quantity: product.quantity,
          },
        ],
        mode: 'payment',
        success_url: `http://localhost:8888/success.html?id=${orderId}`,
        cancel_url: `http://localhost:8888/cancel.html?id=${orderId}`,
      });
  
      console.log('session', session);  // Logging session details for debugging
  
      // Create order in database
      const data = {
          name: user.name,  
          address: user.address,  // Correctly using user's address
          order_id: orderId, 
          session_id: session.id, 
          status: session.status   // Initial status from Stripe session
        };
  
      const [result] = await conn.query('INSERT INTO orders SET ?', data);
  
      res.json({
          message: 'Checkout success.',
          sessionId: session.id,
          orderId: data
        });
    } catch (error) {
      console.error('Error during checkout:', error.message);
      res.status(400).json({ error: 'Error processing your checkout request' });
    }
  });
  

app.get('/order/:id', async (req, res) => {
  const orderId = req.params.id
  try {
    const [result] = await conn.query('SELECT * from orders where order_id = ?', orderId)
    const selectedOrder = result[0]
    if (!selectedOrder) {
      throw {
        errorMessage: 'Order not found'
      }
    }
    res.json(selectedOrder)
  } catch (error) {
    console.log('error', error)
    res.status(404).json({ error: error.errorMessage || 'System error' })
  }
})

app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature']

  let event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret)
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`)
    return
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const paymentSuccessData = event.data.object
      const sessionId = paymentSuccessData.id

      const data = {
        status: paymentSuccessData.status
      }

      const result = await conn.query(
        'UPDATE orders SET ? WHERE session_id = ?',
        [data, sessionId]
      )

      console.log('=== update result', result)

      // event.data.object.id = session.id
      // event.data.object.customer_details คือข้อมูลลูกค้า
      break
    default:
      console.log(`Unhandled event type ${event.type}`)
  }

  // Return a 200 response to acknowledge receipt of the event
  res.send()
})

// Listen
app.listen(port, async () => {
  await initMySQL()
  console.log('Server started at port 8000')
})