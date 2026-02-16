const usb = require('usb')

const dev = usb.findByIds(0x2ca3, 0x0020)

if (!dev) {
    console.log("Device not found")
    process.exit(1)
}

dev.open()

dev.interfaces.forEach((iface, i) => {
    console.log(`Interface ${i}:`)
    console.log("  Class:", iface.descriptor.bInterfaceClass)
    console.log("  Subclass:", iface.descriptor.bInterfaceSubClass)
    console.log("  Protocol:", iface.descriptor.bInterfaceProtocol)

    iface.endpoints.forEach((ep, j) => {
        console.log(
            `    EP ${j} | Address 0x${ep.address.toString(16)} | Direction: ${ep.direction} | Type: ${ep.transferType}`
        )
    })
})
