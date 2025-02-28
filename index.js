require('dotenv').config()

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

app.get('/invoice', async (req, res) => {
    try {
        const response = (await postgres.query('select invoice.*, customer_name, JSON_AGG(travel_item) as travel_items from invoice inner join travel_item on invoice.id = travel_item.id_invoice inner join customer on customer.id = invoice.id_customer group by invoice.id, customer.id having count(travel_item) > 2 limit 10')).rows
        const parsedData = parse(response)
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
        const air_bookings = (await postgres.query('SELECT ticket_number, ARRAY_AGG(ROW_TO_JSON(air_booking)) AS bookings FROM air_booking GROUP BY ticket_number HAVING COUNT(*) > 1 limit 10'))?.rows.map((air_booking) => {
            return {...air_booking, bookings: air_booking?.bookings?.filter(travel_item => (travel_item?.id_invoice || travel_item?.id_credit_note))} // Remove item which has an empty id_invoice and an empty credit_note
        })
            .reduce((acc, air_booking) => {
                let linkedInvoice = air_booking.bookings.find(ab => ab.id_invoice)?.id_invoice
                acc.push(...air_booking.bookings.map(ab => ({...ab, id_invoice: linkedInvoice || ab.id_invoice})))
                return acc
            }, [])
            .filter(air_booking => air_booking.id_credit_note && air_booking.id_invoice)

        const invoices_ids = air_bookings.map(air_booking => air_booking.id_invoice)

        const invoices_numbers = (await postgres.query('select id, invoice_number from invoice where id = ANY($1)', [invoices_ids])).rows
            .reduce((acc, invoice_number) => {
                acc[invoice_number?.id] = invoice_number?.invoice_number
                return acc
            }, {})

        const reformatted_air_bookings = air_bookings.map(air_booking => ({
            ...air_booking,
            id_invoice: invoices_numbers[air_booking.id_invoice]
        }))

        const grouped_credits_notes = groupBy(reformatted_air_bookings, 'id_credit_note') // Group element by id_invoice

        const credit_notes = (await postgres.query('select * from credit_note where id = ANY($1)', [Object.keys(grouped_credits_notes)])).rows
            .map(credit_note => ({...credit_note, travel_items: grouped_credits_notes[credit_note.id]})) // Query all credit where id in groupedItems tab and associate each credit_note with its travel_item

        const parsedData = parse(credit_notes)

        const zra_response = await Promise.all(parsedData.map(credit_note => fetch(`${process.env.ZRAURL}/vsdc/trnsSales/saveSales`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(credit_note)
        }).then(response => response.json())))
        res.send(parsedData)
    } catch (e) {
        res.send(`Error message: ${e.message}\n Error trace: ${e.stack}`)
    }
})

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