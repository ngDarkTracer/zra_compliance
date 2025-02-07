require('dotenv').config()

const { createDirectus, authentication, rest, readItem, readItems} = require('@directus/sdk');
const { Client, Pool } = require('pg')
const express = require('express')

const app = express()
app.use(express.json())

const _email = process.env.EMAIL
const _password = process.env.PASSWORD

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
    // const { collection, id } = req.params
    // const response = await getCollection(collection, id || '')
    const response = await postgres.query('select invoice.*, JSON_AGG(travel_item) as travel_items from invoice inner join travel_item on invoice.id = travel_item.id_invoice group by invoice.id having count(travel_item) > 2 limit 1')
    const result = ZRAParse(JSON.stringify(response))
    res.send(response.rows)
})

app.get('/credit_note', async (req, res) => {
    // const { collection, id } = req.params
    // const response = await getCollection(collection, id || '')
    const response = await postgres.query('select credit_note.*, JSON_AGG(travel_item) as travel_items from credit_note inner join travel_item on credit_note.id = travel_item.id_credit_note group by credit_note.id having count(travel_item) > 2 limit 1')
    res.send(response.rows)
})

// app.get('/:collection/:id?', async (req, res) => {
//     const { collection, id } = req.params
//     const response = await getCollection(collection, id || '')
//     res.send(response.rows)
// })

app.listen(port, async () => {
    //authenticate(_email, _password)
    console.log(`Connecting...`)
    try {
        const response = await postgres.connect()
        console.log(`Connected!`)
    } catch (error) {
        console.log(`Error! => ${error.message}`)
    }
    console.log(`Server connected. Listening on port: ${port}`)
})

function ZRAParse(invoice) {}

async function authenticate(email, password) {
    try {
        await client.login(email, password);
        console.log('Authentification réussie.');
    } catch (error) {
        console.error('Erreur lors de l\'authentification :', error.message);
    }
}

async function getCollection(collection, index) {
    try {
        let result = null
        if (!index)
            return await client.request(readItems(collection));
        else
            return await client.request(readItem(collection, index));
        console.log(`retrieve successfully: ${JSON.stringify(result)}`)
    } catch(error) {
        console.log(`retrieve error: ${JSON.stringify(error)}`)
        return error
    }
}