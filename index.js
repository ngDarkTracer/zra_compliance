require('dotenv').config()

const { readItem, readItems } = require('@directus/sdk');
const { Client } = require('pg')
const express = require('express')

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
    // const { collection, id } = req.params
    // const response = await getCollection(collection, id || '')
    const response = await postgres.query('select invoice.*, JSON_AGG(travel_item) as travel_items from invoice inner join travel_item on invoice.id = travel_item.id_invoice group by invoice.id having count(travel_item) > 2 limit 1')
    //const result = ZRAParse(JSON.parse(response))
    res.send(response.rows)
})

app.get('/credit_note', async (req, res) => {
    // const { collection, id } = req.params
    // const response = await getCollection(collection, id || '')
    const response = await postgres.query('select credit_note.*, JSON_AGG(travel_item) as travel_items from credit_note inner join travel_item on credit_note.id = travel_item.id_credit_note group by credit_note.id having count(travel_item) > 2 limit 1')
    res.send(response.rows)
})

function ZRAParse(data) {
    const sectorCodes = {
        flight: {name: 'flight', code: 'flight'},
        car: {name: 'car', code: 'car'},
        hotel: {name: 'hotel', code: '109507'},
        misc: {name: 'misc', code: 'misc'},
    }
    const rows = data.map((row) => {
        return {
            tpin: process.env.TPIN,
            bhfId: process.env.BHFID,
            orgInvcNo: 0,
            cisInvcNo: row["invoice_number"],
            custNm: row["printed_name"],
            salesTyCd: "N",
            rcptTyCd: row["invoice_number"] ? "S" : "R",
            pmtTyCd: "01", // Soon
            salesSttsCd: "02", // Soon
            cfmDt: "20240508102010", // Soon
            salesDt: "20250128", // Soon
            cnclReqDt: null,
            cnclDt: null,
            rfdDt: null,
            rfdRsnCd: null,
            totItemCnt: row["travel_items"].length,
            taxblAmtA: 86.2069,
            taxblAmtB: 0,
            taxblAmtC1: 0,
            taxblAmtC2: 0,
            taxblAmtC3: 0,
            taxblAmtD: 0,
            taxblAmtRvat: 0,
            taxblAmtE: 0,
            taxblAmtF: 0,
            taxblAmtIpl1: 0,
            taxblAmtIpl2: 100,
            taxblAmtTl: 0,
            taxblAmtEcm: 0,
            taxblAmtExeeg: 0,
            taxblAmtTot: 0,
            taxRtA: 16,
            taxRtB: 16,
            taxRtC1: 0,
            taxRtC2: 0,
            taxRtC3: 0,
            taxRtD: 0,
            tlAmt: 0,
            taxRtRvat: 16,
            taxRtE: 0,
            taxRtF: 10,
            taxRtIpl1: 5,
            taxRtIpl2: 0,
            taxRtTl: 1.5,
            taxRtEcm: 5,
            taxRtExeeg: 3,
            taxRtTot: 0,
            taxAmtA: 13.7931,
            taxAmtB: 0,
            taxAmtC1: 0,
            taxAmtC2: 0,
            taxAmtC3: 0,
            taxAmtD: 0,
            taxAmtRvat: 0,
            taxAmtE: 0,
            taxAmtF: 0,
            taxAmtIpl1: 0,
            taxAmtIpl2: 0,
            taxAmtTl: 0,
            taxAmtEcm: 0,
            taxAmtExeeg: 0,
            taxAmtTot: 0,
            totTaxblAmt: 186.2069,
            totTaxAmt: 13.7931,
            cashDcRt: 25,
            cashDcAmt: 50,
            totAmt: 150,
            prchrAcptcYn: "N",
            regrId: "admin",
            regrNm: "admin",
            modrId: "admin",
            modrNm: "admin",
            saleCtyCd: "1",
            currencyTyCd: "ZMW",
            exchangeRt: "1",
            destnCountryCd: "",
            dbtRsnCd: "",
            invcAdjustReason: "",
            items: row?.travel_items?.map((travel_item) => {
                return {
                    itemSeq: 1,
                    itemCd: "20056",
                    itemClsCd: "50102518",
                    itemNm: "Bread",
                    pkgUnitCd: "BA",
                    pkg: 0,
                    qtyUnitCd: "BE",
                    qty: 1,
                    prc: 125,
                    splyAmt: 125,
                    dcRt: 20,
                    dcAmt: 25,
                    isrccCd: "",
                    isrccNm: "",
                    isrcRt: 0,
                    isrcAmt: 0,
                    vatCatCd: "A",
                    exciseTxCatCd: null,
                    tlCatCd: null,
                    iplCatCd: null,
                    vatTaxblAmt: 86.2069,
                    vatAmt: 13.7931,
                    exciseTaxblAmt: 0,
                    tlTaxblAmt: 0,
                    iplTaxblAmt: 0,
                    iplAmt: 0,
                    tlAmt: 0,
                    exciseTxAmt: 0,
                    totAmt: travel_item["total_price"]
                }
            })
        }
    })
}

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
        console.log(`Error! => ${error.message}`)
    }
    console.log(`Server connected. Listening on port: ${port}`)
})

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