async function sendSales(data) {
    try {
        const response = await fetch('http://localhost:3000', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        })
            .then(response => response.json())
    } catch (error) {
        console.log(`Error message: ${error.message}`)
    }
}