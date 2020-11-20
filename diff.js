const fs = require('fs')

const diagramA = JSON.parse(fs.readFileSync('/tmp/lightstep/lightstep-snapshotdiagram-Ob3tiiNaJc.json', 'utf8'))

const snapshotA = JSON.parse(fs.readFileSync('/tmp/lightstep/lightstep-snapshot-Ob3tiiNaJc.json', 'utf8'))

const diagramB = JSON.parse(fs.readFileSync('/tmp/lightstep/lightstep-snapshotdiagram-HwWzmT9GKb.json', 'utf8'))

const snapshotB = JSON.parse(fs.readFileSync('/tmp/lightstep/lightstep-snapshot-HwWzmT9GKb.json', 'utf8'))

// broken, demo:
// - HwWzmT9GKb (after)
// - Ob3tiiNaJc (before)


async function run() {
    const sdk = require('./src/index')
    //console.log(diagramA, snapshotA)
    //console.log(diagramB, snapshotB)

    const sdkClient = await sdk.init('foo', 'bar')
    const snapshotBeforeId =  snapshotA.data.id
    const snapshotAfterId =  snapshotB.data.id

    const summaryA = sdkClient.utils.snapshotSummary(snapshotA, diagramA)
    const summaryB = sdkClient.utils.snapshotSummary(snapshotB, diagramB)

    console.dir(summaryA[snapshotBeforeId])
    console.dir(summaryB[snapshotAfterId])

    console.dir(sdkClient.utils.diffSummary(
        snapshotBeforeId, summaryA[snapshotBeforeId],
        snapshotAfterId, summaryB[snapshotAfterId]))

}

run()