const usb = require('usb')

const VENDOR_ID = 0x2ca3
const PRODUCT_ID = 0x0020
const TEST_DURATION_MS = 3000

const dev = usb.findByIds(VENDOR_ID, PRODUCT_ID)

if (!dev) {
    console.log("Device not found")
    process.exit(1)
}

dev.open()

async function testInterface(index) {
    return new Promise((resolve) => {
        console.log(`\nTesting interface ${index}...`)

        const iface = dev.interface(index)

        try {
            iface.claim()
        } catch (e) {
            console.log("  Could not claim interface")
            return resolve(0)
        }

        const inpoint = iface.endpoints.find(e => e.direction === 'in')
        const outpoint = iface.endpoints.find(e => e.direction === 'out')

        if (!inpoint || !outpoint) {
            console.log("  No bulk endpoints")
            iface.release(true, () => resolve(0))
            return
        }

        let totalBytes = 0

        inpoint.on("data", (data) => {
            totalBytes += data.length
        })

        inpoint.on("error", () => {})

        const magic = Buffer.from("524d5654", "hex")

        outpoint.transfer(magic, (err) => {
            if (err) {
                console.log("  Error sending magic packet")
            }
        })

        inpoint.startPoll(3, 512)

        setTimeout(() => {
            inpoint.stopPoll(() => {
                iface.release(true, () => {
                    console.log(`  Received ${totalBytes} bytes`)
                    resolve(totalBytes)
                })
            })
        }, TEST_DURATION_MS)
    })
}

async function run() {
    let results = {}

    for (let i = 3; i <= 7; i++) {
        try {
            const bytes = await testInterface(i)
            results[i] = bytes
        } catch (e) {
            results[i] = 0
        }
    }

    console.log("\n===== RESULTS =====")
    for (const [iface, bytes] of Object.entries(results)) {
        console.log(`Interface ${iface}: ${bytes} bytes`)
    }

    dev.close()
}

run()
