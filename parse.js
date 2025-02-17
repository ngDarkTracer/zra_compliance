function parse(data) {

    const sectorCodes = {
        flight: {name: 'flight', label: 'Car location',  code: '90111500'},
        car: {name: 'car', label: '', code: 'car'},
        hotel: {name: 'hotel', label: 'Hotels and motels and inns', code: '90111500'},
        misc: {name: 'misc', label: '', code: 'misc'},
    }

    const { taxRtA, taxRtB, taxRtC1, taxRtEcm, taxRtC2, taxRtC3, taxRtD, taxRtE, taxRtExeeg, taxRtF, taxRtIpl1, taxRtIpl2, taxRtRvat, taxRtTot, tlAmt, taxRtTl}
        = { taxRtA: 16, taxRtB: 16, taxRtC1: 0, taxRtC2: 0, taxRtC3: 0, taxRtD: 0, tlAmt: 0, taxRtRvat: 16, taxRtE: 0, taxRtF: 10, taxRtIpl1: 5, taxRtIpl2: 0, taxRtTl: 1.5, taxRtEcm: 5, taxRtExeeg: 3, taxRtTot: 0 }

    const rows = data.map((row) => {
        return {
            tpin: process.env.TPIN,
            bhfId: process.env.BHFID,
            orgInvcNo: 0,
            cisInvcNo: "CIS001-1380",// row["invoice_number"],
            custNm: row["customer_name"],
            salesTyCd: "N",
            rcptTyCd: row["invoice_number"] ? "S" : "R",
            pmtTyCd: "01", // Soon *
            salesSttsCd: "02", // Soon *
            cfmDt: '20250202230000',//dateReformat(row["creation_date"].toISOString(), true),
            salesDt: '20250202',//dateReformat(row["due_date"].toISOString(), false),
            cnclReqDt: null,
            cnclDt: null,
            rfdDt: null,
            rfdRsnCd: null,
            totItemCnt: row["travel_items"].length,
            taxblAmtA: currency(row["amount"]).toFixed(4),
            taxblAmtB: 0,
            taxblAmtC1: 0,
            taxblAmtC2: 0,
            taxblAmtC3: 0,
            taxblAmtD: 0,
            taxblAmtRvat: 0,
            taxblAmtE: 0,
            taxblAmtF: 0,
            taxblAmtIpl1: 0,
            taxblAmtIpl2: 0,
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
            taxAmtA: ((currency(row["amount"]) * taxRtA)/100).toFixed(4),
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
            totTaxblAmt: currency(row["amount"]).toFixed(4),
            totTaxAmt: ((currency(row["amount"]) * taxRtA)/100).toFixed(4),
            cashDcRt: 0,//25
            cashDcAmt: 0,//50
            totAmt: (currency(row["amount"]) + ((currency(row["amount"]) * taxRtA)/100)).toFixed(4),
            prchrAcptcYn: "N",
            regrId: "admin",
            regrNm: "admin",
            modrId: "admin",
            modrNm: "admin",
            saleCtyCd: "1",
            currencyTyCd: "ZMW",// soon
            exchangeRt: "1",
            destnCountryCd: "",
            dbtRsnCd: "",
            invcAdjustReason: "",
            itemList: row?.travel_items?.map((travel_item, index) => {
                return {
                    itemSeq: index + 1,
                    itemCd: travel_item["id"],
                    itemClsCd: sectorCodes[travel_item["product_type"]].code,
                    itemNm: sectorCodes[travel_item["product_type"]].label,
                    pkgUnitCd: "EA",
                    pkg: 0,
                    qtyUnitCd: "EA",
                    qty: 1,
                    prc: (currency(travel_item["total_price"], travel_item["customer_rate"])
                        + ((currency(travel_item["total_price"], travel_item["customer_rate"]) * taxRtA)/100)).toFixed(4),
                    splyAmt: (currency(travel_item["total_price"], travel_item["customer_rate"])
                        + ((currency(travel_item["total_price"], travel_item["customer_rate"]) * taxRtA)/100)).toFixed(4),
                    dcRt: 0,
                    dcAmt: 0,
                    isrccCd: "",
                    isrccNm: "",
                    isrcRt: 0,
                    isrcAmt: 0,
                    vatCatCd: "A",
                    exciseTxCatCd: null,
                    tlCatCd: null,
                    iplCatCd: null,
                    vatTaxblAmt: (currency(travel_item["total_price"], travel_item["customer_rate"])).toFixed(4),
                    vatAmt: ((currency(travel_item["total_price"], travel_item["customer_rate"]) * taxRtA)/100).toFixed(4),
                    exciseTaxblAmt: 0,
                    tlTaxblAmt: 0,
                    iplTaxblAmt: 0,
                    iplAmt: 0,
                    tlAmt: 0,
                    exciseTxAmt: 0,
                    totAmt: (currency(travel_item["total_price"], travel_item["customer_rate"])
                        + ((currency(travel_item["total_price"], travel_item["customer_rate"]) * taxRtA)/100)).toFixed(4)
                }
            })
        }
    })
    return rows
}

function currency(currency, rate) {
    return Number(currency.replace(/[$,]/g, '')) * (rate || 1)
}

function dateReformat(date, withTime) {
    if (withTime) {
        return date.split('.')[0].replace(/[-T:]/g, '')
    } else {
        return date.split('T')[0].replaceAll('-', '')
    }
}

module.exports = { parse }


// try {
//     const response = await postgres.query('select invoice.*, customer_name, JSON_AGG(travel_item) as travel_items from invoice inner join travel_item on invoice.id = travel_item.id_invoice inner join customer on customer.id = invoice.id_customer group by invoice.id, customer.id having count(travel_item) > 2 limit 100')
//     const zraResponse = await fetch(`${process.env.ZRAURL}/vsdc/trnsSales/saveSales`, {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json"
//         },
//         body: JSON.stringify(parse(response.rows))
//     })
//
//     const zra_response = await zraResponse.json();
//     res.send(zra_response)
// } catch (e) {
//     res.send(`Error: ${e.message}`)
// }