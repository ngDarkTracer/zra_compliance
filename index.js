require('dotenv').config()

const { Client } = require('pg')
const { parse } = require('./parse')
const express = require('express')

const app = express()
app.set('view engine', 'ejs')
app.use(express.json())

const port = process.env.PORT || 3000

// app.get('/', (req, res) => {
//     res.render('index');
// });

app.get('/home', (req, res) => {
    res.render('home')
})

getInvoice = async (startDate, endDate) => {
    const response_message = []
    try {
        const invoices = await fetch('/credit_note', {
            method: 'GET',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({ startDate, endDate })
        })

        const content = []
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
                    content.push({ id: invoice?.cisInvcNo, value: zra_response?.data?.rcptNo })
                    response_message.push({ message: `Invoice: ${invoice?.cisInvcNo} created successfully` })
                    break
                default:
                    response_message.push({ message: `${zra_response?.resultMsg}, invoice number: ${invoice?.cisInvcNo}` })
            }
        }

        if (content.length) {
            const updateResponse = await fetch('/update', {
                method: 'PATCH',
                headers: {
                    'content-type': 'application/json'
                },
                body: JSON.stringify({ table: 'invoice', content })
            })
        }
    } catch (error) {
        //res.send(`Error message: ${e.message}\n Error trace: ${e.stack}`)
    }
    //res.send(response_message)
}

getCreditNote = async (startDate, endDate) => {
    try {
        const { credit_notes, _response_message } = await fetch('/credit_note', {
            method: 'GET',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({ startDate, endDate })
        })
        const content = []
        const response_message = []
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
        if (content.length) {
            const updateResponse = await fetch('/update', {
                method: 'PATCH',
                headers: {
                    'content-type': 'application/json'
                },
                body: JSON.stringify({ table: 'credit_note', content })
            })
        }
        //res.send(response_message)
    } catch (error) {
        //res.send(`Error message: ${e.message}\n Error trace: ${e.stack}`)
    }
}

app.listen(port, async () => {
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