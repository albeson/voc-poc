const usb = require('usb')
const fs = require('fs')

const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')

const argv = yargs(hideBin(process.argv))
    .option('f', {
        alias: 'file',
        describe: 'output video feed to file',
        type: 'string'
    })
    .option('o', {
        alias: 'stdout',
        describe: 'send video feed to stdout (ex: node index.js -o | ffplay -)',
        type: 'boolean'
    })
    .option('s', {
        alias: 'readsize',
        describe: 'USB bulk read size in bytes',
        default: 512,
        type: 'number'
    })
    .option('q', {
        alias: 'queuesize',
        describe: 'Number of USB read requests in flight',
        default: 3,
        type: 'number'
    })
    .option('v', {
        alias: 'verbose',
        describe: 'Verbose logging (not recommended with -o)',
        type: 'boolean'
    })
    .help()
    .alias('help', 'h')
    .parse()

// ---- DEVICE DETECTION ----

const VENDOR_ID = 0x2ca3
const PRODUCT_ID = 0x0020

const goggles = usb.findByIds(VENDOR_ID, PRODUCT_ID)

if (!goggles) {
    console.error("Goggles USB device not found.")
    process.exit(1)
}

goggles.open()

// Select interface 3 (known bulk interface for DJI goggles)
const iface = goggles.interface(3)

if (!iface) {
    console.error("USB interface not found.")
    process.exit(1)
}

iface.claim()

// ---- ENDPOINT DETECTION ----

const inpoint = iface.endpoints.find(e => e.direction === 'in')
const outpoint = iface.endpoints.find(e => e.direction === 'out')

if (!inpoint || !outpoint) {
    console.error("Bulk endpoints not found.")
    process.exit(1)
}

inpoint.timeout = 100

// ---- OUTPUT SETUP ----

let fd = null

if (!argv.f && !argv.o) {
    console.log("Warning: no output specified. Enabling verbose mode.")
    argv.v = true
}

if (argv.f) {
    try {
        fd = fs.openSync(argv.f, "w")
    } catch (err) {
        console.error("Could not open file:", err.message)
        process.exit(1)
    }
}

// ---- MAGIC PACKET ----

const magic = Buffer.from("524d5654", "hex")

outpoint.transfer(magic, (error) => {
    if (error) {
        console.error("Error sending magic packet:", error)
        process.exit(1)
    }
    if (argv.v) {
        console.log("Magic packet sent.")
    }
})

// ---- DATA HANDLING ----

inpoint.on("data", (data) => {

    if (argv.o) {
        process.stdout.write(data)
    }

    if (argv.f && fd) {
        fs.writeSync(fd, data)
    }

    if (argv.v) {
        console.log(`Received ${data.length} bytes`)
    }
})

inpoint.on("error", (error) => {
    console.error("USB error:", error)
})

// Start polling
inpoint.startPoll(argv.q, argv.s)

// ---- CLEANUP HANDLING ----

function cleanup() {
    console.log("\nShutting down...")

    try {
        inpoint.stopPoll(() => {
            iface.release(true, () => {
                goggles.close()
                if (fd) fs.closeSync(fd)
                process.exit(0)
            })
        })
    } catch (err) {
        console.error("Cleanup error:", err)
        process.exit(1)
    }
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
