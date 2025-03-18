require('dotenv').config()

const express = require('express')
const e = require("express");
const app = express()

app.use(express.json())

app.set('view engine', 'ejs')

const knex = require('knex')({
    client: 'pg',
    connection: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        database: process.env.DB_DATABASE,
        password: process.env.DB_PASSWORD
    },
});

const port = process.env.PORT || 3000

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/home', (req, res) => {
    res.render('home')
})

app.post('/invoice', async (req, res) => {
    const { startDate, endDate } = req.body
    try {
        res.json(await knex.select('invoice.*','customer.customer_name')
            .from('invoice')
            .modify(query => {
                query.whereBetween('creation_date', [startDate, endDate])
            })
            .whereNull('zra_id')
            .join('travel_item', 'invoice.id', 'travel_item.id_invoice')
            .join('customer', 'customer.id', 'invoice.id_customer')
            .groupBy('invoice.id', 'customer.id')
            .limit(50)
            .select(knex.raw('JSON_AGG(travel_item) as travel_items')))
    } catch (error) {
        res.status(500).end(error.message)
    }
})

app.post(`/credit_note`, async (req, res) => {
    const { startDate, endDate } = req.body
    const response_message = []
    try {
        // Récupérer les IDs des credit_note
        const credit_notes_ids = (await knex.select('id')
            .from('credit_note')
            .whereBetween('creation_date', [startDate, endDate]))
            .map(credit_note => credit_note.id);

        // Récupérer les ticket_numbers associés aux credit_note
        const ticket_numbers_ids = (await knex.select(knex.raw('ARRAY_AGG(ticket_number) as ticket_numbers'))
            .from('air_booking')
            .whereIn('id_credit_note', credit_notes_ids))[0]?.ticket_numbers;

        const air_bookings = (await knex.select('ticket_number', knex.raw('ARRAY_AGG(ROW_TO_JSON(air_booking)) AS bookings'))
            .from('air_booking')
            .whereIn('ticket_number', ticket_numbers_ids)
            .groupBy('ticket_number'))
            ?.map(air_booking => ({
                ...air_booking,
                bookings: air_booking?.bookings?.filter(travel_item => (travel_item?.id_invoice || travel_item?.id_credit_note))
            }))
            .reduce((acc, air_booking) => {
                let linkedInvoice = air_booking.bookings.find(ab => ab.id_invoice);
                acc.push(...air_booking.bookings.map(ab => ({
                    ...ab,
                    id: linkedInvoice?.id,
                    id_invoice: linkedInvoice?.id_invoice || ab.id_invoice
                })));
                return acc;
            }, [])
            .filter(air_booking => air_booking.id_credit_note && air_booking.id_invoice);

        // Récupérer les IDs des invoices
        const invoices_ids = air_bookings.map(air_booking => air_booking.id_invoice);

        // Récupérer les informations des invoices
        const invoices_numbers = (await knex.select('id', 'invoice_number', 'zra_invoice_id')
            .from('invoice')
            .whereIn('id', invoices_ids))
            .reduce((acc, { id, invoice_number, zra_invoice_id }) => {
                acc[id] = { invoice_number, zra_invoice_id };
                return acc;
            }, {});

        // Reformater les air_booking
        const reformatted_air_bookings = air_bookings.map(air_booking => ({
            ...air_booking,
            zra_invoice_id: invoices_numbers[air_booking.id_invoice]?.zra_invoice_id,
            id_invoice: invoices_numbers[air_booking.id_invoice]?.invoice_number
        }));

        // Regrouper par ID de note de crédit
        const grouped_credits_notes = groupBy(reformatted_air_bookings, 'id_credit_note');

        // Récupérer les notes de crédit correspondantes
        const credit_notes = (await knex.select('credit_note.id', 'credit_note.number', 'credit_note.creation_date', 'credit_note.amount', 'credit_note.status', 'credit_note.balance','customer.customer_name')
            .from('credit_note')
            .join('customer', 'customer.id', 'credit_note.id_customer')
            .groupBy('credit_note.id', 'customer.id')
            .whereIn('credit_note.id', Object.keys(grouped_credits_notes)))
            ?.map(credit_note => credit_note)?.filter(credit_note => credit_note);
        res.json({ credit_notes, response_message })
    } catch (error) {
        res.status(500).end(error.message)
    }
})

app.get('/taxes', async (req, res) => {
    res.json(await knex.select('*')
        .from('tax'))
})

app.patch('/update', async (req, res) => {
    const { table, content } = req.body
    let fieldName = (table === 'invoice') ? 'invoice_number' : 'number'
    try {
        res.json(await Promise.all(content.map(query =>
            knex.update(`${table}`, { zra_id: query.value })
                .where({ [fieldName]: query?.id })
        )))
    } catch (error) {
        res.status(500).end(error.message)
    }
})

app.listen(port, async () => {
    console.log(`Server connected. Listening on port: 3000`)
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