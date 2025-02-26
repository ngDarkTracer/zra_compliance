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

const local_postgres = new Client({
    user: process.env.DB_AB_USER,
    password: process.env.DB_AB_PASSWORD,
    host: process.env.DB_AB_HOST,
    port: process.env.DB_AB_PORT,
    database: process.env.DB_AB_DATABASE
})

const port = process.env.PORT || 3000


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
        const air_bookings = (await postgres.query('SELECT ticket_number, ARRAY_AGG(ROW_TO_JSON(air_booking)) AS bookings FROM air_booking GROUP BY ticket_number HAVING COUNT(*) > 1 limit 50'))?.rows.map((air_booking) => {
            return {...air_booking, bookings: air_booking?.bookings?.filter(travel_item => (travel_item?.id_invoice || travel_item?.id_credit_note))} // Remove item which has an empty id_invoice and an empty credit_note
        })
            .reduce((acc, air_booking) => {
            let linkedInvoice = air_booking.bookings.find(ab => ab.id_invoice)?.id_invoice
            acc.push(...air_booking.bookings.map(ab => ({...ab, id_invoice: linkedInvoice || ab.id_invoice})))
            return acc
        }, [])
            .filter(air_booking => air_booking.id_credit_note && air_booking.id_invoice)

        const groupedItems = groupBy(air_bookings, "id_credit_note") // Group element by id_invoice

        const credit_notes = (await postgres.query('select * from credit_note where id = ANY($1)', [Object.keys(groupedItems)])).rows
            .map(credit_note => ({...credit_note, travel_items: groupedItems[credit_note.id]})) // Query all credit where id in groupedItems tab and associate each credit_note with its travel_item

        // const parsedData = parse(credit_notes.rows)
        // const zra_response = await Promise.all(parsedData.map(credit_note => fetch(`${process.env.ZRAURL}/vsdc/trnsSales/saveSales`, {
        //     method: "POST",
        //     headers: {
        //         "Content-Type": "application/json"
        //     },
        //     body: JSON.stringify(credit_note)
        // }).then(response => response.json())))
        res.send(credit_notes)
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
    console.log(`Connecting to databases...`)
    try {
        await postgres.connect()
        await local_postgres.connect()
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

function groupBy(array, key) {
    return array.reduce((result, obj) => {
        const value = obj[key];
        if (!result[value]) {
            result[value] = [];
        }
        result[value].push(obj);
        return result;
    }, {});
}