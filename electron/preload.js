const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electron", {
    ping: () => console.log("Electron is ready!"),
});
