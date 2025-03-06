require('dotenv').config()

const { Client } = require('pg')
const { parse } = require('./parse')
const express = require('express')
const cron = require('node-cron')
const {post} = require("axios");
const {query} = require("express");

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

app.post('/invoice', async (req, res) => {
    const invoices = JSON.parse(req.body)
    const response_message = []
    try {
        const invoiceMap = []
        //const response = (await postgres.query('select invoice.*, customer_name, JSON_AGG(travel_item) as travel_items from invoice inner join travel_item on invoice.id = travel_item.id_invoice inner join customer on customer.id = invoice.id_customer group by invoice.id, customer.id limit 50')).rows
        const parsedData = parse(invoices)

        for (const invoice of parsedData) {
            const zra_response = await fetch(`${process.env.ZRAURL}/vsdc/trnsSales/saveSales`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(invoice)
            }).then(response => response.json())
            switch (zra_response?.resultCd) {
                case '000':
                    invoiceMap.push({ ab_invoice_number: invoice?.cisInvcNo, zra_invoice: zra_response?.data?.rcptNo })
                    response_message.push({ message: `Invoice: ${invoice?.cisInvcNo} created successfully` })
                    break
                default:
                    response_message.push({ message: `${zra_response?.resultMsg}` })
            }
        }

        const queries = invoiceMap?.map(({ab_invoice_number, zra_invoice}) => {
            return { query: `update invoice set zra_invoice_id = $1 where invoice_number = $2`, values: [zra_invoice, ab_invoice_number]}
        })

        const ab_response = await Promise.all(queries.map(qry => postgres.query(qry.query, qry.values)))
    } catch (e) {
        res.send(`Error message: ${e.message}\n Error trace: ${e.stack}`)
    }
    res.send(response_message)
})

app.post('/credit_note', async (req, res) => {
    const credit_notes = JSON.parse(req.body)
    try {
        const response_message = []

        //const credit_notes_ids = (await postgres.query('select id from credit_note')).rows.map(credit_note_id => credit_note_id.id)
        const credit_notes_ids = credit_notes.map(credit_note_id => credit_note_id.id)

        const ticket_numbers_ids = (await postgres.query('select ARRAY_AGG(ticket_number) as ticket_numbers from air_booking where id_credit_note = ANY($1)', [credit_notes_ids])).rows[0]?.ticket_numbers

        const air_bookings = (await postgres.query('SELECT ticket_number, ARRAY_AGG(ROW_TO_JSON(air_booking)) AS bookings FROM air_booking WHERE ticket_number = ANY($1) GROUP BY ticket_number HAVING COUNT(*) > 1', [ticket_numbers_ids]))?.rows.map((air_booking) => {
            return {...air_booking, bookings: air_booking?.bookings?.filter(travel_item => (travel_item?.id_invoice || travel_item?.id_credit_note))} // Remove item which has an empty id_invoice and an empty credit_note
        })
            .reduce((acc, air_booking) => {
                let linkedInvoice = air_booking.bookings.find(ab => ab.id_invoice)
                acc.push(...air_booking.bookings.map(ab => ({...ab, id:linkedInvoice?.id, id_invoice: linkedInvoice?.id_invoice || ab.id_invoice})))
                return acc
            }, [])
            .filter(air_booking => air_booking.id_credit_note && air_booking.id_invoice)

        const invoices_ids = air_bookings.map(air_booking => air_booking.id_invoice)

        const invoices_numbers = (await postgres.query('select id, invoice_number, zra_invoice_id from invoice where id = ANY($1)', [invoices_ids])).rows
            .reduce((acc, {id, invoice_number, zra_invoice_id}) => {
                acc[id] = {invoice_number, zra_invoice_id}
                return acc
            }, {})

        const reformatted_air_bookings = air_bookings.map(air_booking => ({
            ...air_booking,
            zra_invoice_id: invoices_numbers[air_booking.id_invoice]?.zra_invoice_id,
            id_invoice: invoices_numbers[air_booking.id_invoice]?.invoice_number
        }))

        const grouped_credits_notes = groupBy(reformatted_air_bookings, 'id_credit_note') // Group element by id_invoice

        const credit_notes = (await postgres.query('select * from credit_note where id = ANY($1)', [Object.keys(grouped_credits_notes)])).rows
            ?.map(credit_note => {
                if (Object.keys(groupBy(grouped_credits_notes[credit_note.id], 'id_invoice')).length > 1) {
                    response_message.push({ message: `The credit_note: ${credit_note.number} can't be save because it have refund items which came from different invoices.` })
                    return
                } else if (!(grouped_credits_notes[credit_note.id][0]?.zra_invoice_id)) {
                    response_message.push({ message: `The credit_note: ${credit_note.number} does not have an associated invoice in ZRA.` })
                } else {
                    return {...credit_note, travel_items: grouped_credits_notes[credit_note.id]}
                }
            })
            ?.filter(credit_note => credit_note) // Query all credit where id in groupedItems tab and associate each credit_note with its travel_item

        if (credit_notes.length) {
            const parsedData = parse(credit_notes)
            for (const credit_note of parsedData) {
                const zra_response = await fetch(`${process.env.ZRAURL}/vsdc/trnsSales/saveSales`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(credit_note)
                }).then(response => response.json())
                switch (zra_response?.resultCd) {
                    case '000':
                        response_message.push({ message: `Credit_note: ${credit_note?.cisInvcNo} successfully sent to ZRA` })
                        break
                    case '932':
                        response_message.push({ message: `One of the specified item in the credit_note: ${credit_note?.cisInvcNo} does not exist on the original invoice. The credit_note can't be sent !` })
                        break
                    default:
                        response_message.push({ message: `${zra_response?.resultMsg}` })
                }
            }
        } else {
            response_message.length = 0
            response_message.push({ message: `None of the credit notes you are trying to send have an associated invoice in ZRA.` })
        }
        res.send(grouped_credits_notes)
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