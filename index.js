require('dotenv').config()

//const { readItem, readItems } = require('@directus/sdk')
const { Client } = require('pg')
const { parse } = require('./parse')
const express = require('express')
const cron = require('node-cron')

const app = express()
app.use(express.json())

const postgres = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE
})

const port = process.env.PORT || 3000

// const client = createDirectus('https://directus-rapid-demo.onrender.com/')
//     .with(authentication('json'))
//     .with(rest());

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice & Credit Note</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                background: linear-gradient(135deg, #4b6cb7, #182848);
                color: white;
                margin: 0;
            }
            .buttons {
                margin-bottom: 20px;
            }
            button {
                background: #ff9800;
                border: none;
                color: white;
                padding: 12px 24px;
                font-size: 18px;
                cursor: pointer;
                border-radius: 5px;
                margin: 10px;
                transition: 0.3s;
            }
            button:hover {
                background: #e68900;
            }
            #response {
                background: white;
                color: black;
                padding: 20px;
                border-radius: 5px;
                box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.2);
                width: 50%;
                text-align: center;
                display: none;
                margin-top: 20px;
            }
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background-color: #f5f5f5;
            }
            
            .spinner {
              border: 8px solid #f3f3f3;
              border-top: 8px solid #3498db;
              border-radius: 50%;
              width: 60px;
              height: 60px;
              animation: spin 1.5s linear infinite;
              display: none;
            }
            
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body>
        <h1>Invoice & Credit Note</h1>
        <div class="buttons">
            <button onclick="fetchData('invoice')">Invoice</button>
            <button onclick="fetchData('credit_note')">Credit Note</button>
        </div>
        <div class="spinner"></div>
        <script>
            function fetchData(type) {
                document.querySelector('.spinner').style.display = 'block'
                if (type === 'invoice'){
                    window.location.href = window.location.origin + '/invoice';
                }else{
                    window.location.href = window.location.origin + '/credit_note';}
            }
        </script>
    </body>
    </html>`)
})

app.get('/invoice', async (req, res) => {
    try {
        const response = await postgres.query('select invoice.*, customer_name, JSON_AGG(travel_item) as travel_items from invoice inner join travel_item on invoice.id = travel_item.id_invoice inner join customer on customer.id = invoice.id_customer group by invoice.id, customer.id having count(travel_item) > 2 limit 10')
        const parsedData = parse(response.rows)
        const zra_response = await Promise.all(parsedData.map(invoice => fetch(`${process.env.ZRAURL}/vsdc/trnsSales/saveSales`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(invoice)
        }).then(response => response.json())))
        res.send(zra_response)
    } catch (e) {
        res.send(`Error message: ${e.message}\n Error trace: ${e.stack}`)
    }
})

app.get('/credit_note', async (req, res) => {
    try {
        const credit_notes = await postgres.query('select credit_note.*, customer_name, JSON_AGG(air_booking) as travel_items from credit_note inner join air_booking on credit_note.id = air_booking.id_credit_note inner join customer on customer.id = credit_note.id_customer group by credit_note.id, customer.id having count(air_booking) > 2 limit 100')
        const ticket_numbers = credit_notes.rows.map(row => row.travel_items[0].ticket_number)
        const id_invoices = await postgres.query('select ticket_number, id_invoice from air_booking where id_invoice is not null and ticket_number = ANY($1)', [ticket_numbers])

        const adjustedCredit_note = credit_notes.rows.map(credit_note => {
            return { ...credit_note, linked_invoice: id_invoices.rows.find(({ ticket_number, id_invoice }) => ticket_number === credit_note.travel_items[0].ticket_number)?.id_invoice }
        })
        const parsedData = parse(adjustedCredit_note)
        const zra_response = await Promise.all(parsedData.map(credit_note => fetch(`${process.env.ZRAURL}/vsdc/trnsSales/saveSales`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(credit_note)
        }).then(response => response.json())))
        res.send(adjustedCredit_note)
    } catch (e) {
        res.send(`Error message: ${e.message}\n Error trace: ${e.stack}`)
    }
})

// app.get('/:collection/:id?', async (req, res) => {
//     const { collection, id } = req.params
//     const response = await getCollection(collection, id || '')
//     res.send(response.rows)
// })

app.listen(port, async () => {
    console.log(`Connecting...`)
    try {
        await postgres.connect()
        console.log(`Connected!`)
    } catch (error) {
        console.log(`Connexion error: ${error.message}`)
    }
    console.log(`Server connected. Listening on port: ${port}`)
})

// async function getCollection(collection, index) {
//     try {
//         let result = null
//         if (!index)
//             return await client.request(readItems(collection));
//         else
//             return await client.request(readItem(collection, index));
//         console.log(`retrieve successfully: ${JSON.stringify(result)}`)
//     } catch(error) {
//         console.log(`retrieve error: ${JSON.stringify(error)}`)
//         return error
//     }
// }