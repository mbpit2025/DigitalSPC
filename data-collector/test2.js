// create an empty modbus client
const ModbusRTU = require("modbus-serial");
const client = new ModbusRTU();

// open connection to a tcp line
client.connectTCP("10.2.13.74", { port: 5000 });
client.setID(1);

setInterval(function() {
    client.readHoldingRegisters(5000, 25, function(err, data) {
        console.log({PLC1 : data.data});
    });
}, 1000);

