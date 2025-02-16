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
        const response = await postgres.query('select credit_note.*, customer_name, JSON_AGG(travel_item) as travel_items from credit_note inner join travel_item on credit_note.id = travel_item.id_credit_note inner join customer on customer.id = credit_note.id_customer group by credit_note.id, customer.id having count(travel_item) > 2 limit 10')
        const parsedData = parse(response.rows)
        const zra_response = await Promise.all(parsedData.map(credit_note => fetch(`${process.env.ZRAURL}/vsdc/trnsSales/saveSales`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(credit_note)
        }).then(response => response.json())))
        res.send(zra_response)
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