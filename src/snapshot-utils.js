const getNodes = (serviceDiagram) => {
    return Object.keys(serviceDiagram.data.attributes['service-diagram'].nodes)
}

const getEdges = (serviceDiagram) => {
    return Object.keys(serviceDiagram.data.attributes['service-diagram'].edges)
}

const intersection = (d1, d2) => {
    return d2.filter(d => d1.includes(d))
}

const difference = (d1, d2) => {
    return d2.filter(d => !d1.includes(d))
}

/**
 * Groups a Snapshot API response by service name and calculates
 * average error percentage and average duration (ms).
 *
 * @param {} snapshot
 */
const snapshotServiceStats = (snapshot) => {
    if (!snapshot.data.attributes.exemplars) {
        return {}
    }
    const services = [...new Set(snapshot.data.attributes.exemplars.map(e => e['service-name']))]

    // get average duration + error pct for an array of spans
    const spanStats = (spans) => {
        const avgDurationMs = spans.reduce((v, e) => v + e['duration-micros'], 0) / (spans.length*1000)
        const errorPct = spans.reduce((v, e) => v + (e['has-error'] ? 1 : 0), 0) / spans.length
        return { avgDurationMs, errorPct }
    }

    return services.reduce((obj, s) => {
        const exemplars = snapshot.data.attributes.exemplars.filter(e => e['service-name'] === s)
        const operationNames = [...new Set(exemplars.map(e => e['span-name']))]
        const { avgDurationMs, errorPct } = spanStats(exemplars)

        // stats group by operation name per service
        const operations = operationNames.reduce((obj, o) => {
            obj[o] = spanStats(exemplars.filter(e => e['span-name'] === o))
            return obj
        }, {})

        obj[s] = { exemplars, operations, operationNames, avgDurationMs, errorPct }
        return obj
    }, {})
}

/**
 * Returns edges and nodes from a service diagram
 * API response.
 *
 * @param {} snapshot
 */
const diagramStats = (diagram) => {
    return {
        nodes : getNodes(diagram),
        edges : getEdges(diagram)
    }
}
/**
 * Determines added or removed edges or connections between two
 * service diagram API reponses.
 *
 * @param {} snapshot
 */
const diagramDiff = (before, after) => {
    return {
        added_services      : difference(before.nodes, after.nodes),
        deleted_services    : difference(after.nodes, before.nodes),
        added_connections   : difference(before.edges, after.edges),
        deleted_connections : difference(after.edges, before.edges),
    }
}

/**
 * Calculates average latency and error percent difference
 * between two snapshot API responses.
 */
const snapshotDiff = (beforeStats, afterStats) => {

    const avgDurationMsByService = Object.keys(afterStats).reduce((obj, s) => {
        const diff = (afterStats[s].avgDurationMs - beforeStats[s].avgDurationMs)

        // avg duration change by operation
        const operations = Object.keys(afterStats[s].operations).reduce((obj, o) => {
            if (!afterStats[s].operations[o] || !beforeStats[s].operations[o]) {
                obj[o] = { diff : 0, pct : 0 }
                return obj
            }
            const diff = afterStats[s].operations[o].avgDurationMs -
                beforeStats[s].operations[o].avgDurationMs
            obj[o] = { diff, pct : (diff/beforeStats[s].operations[o].avgDurationMs) }
            return obj
        }, {})

        const deleted_operations = difference(beforeStats[s].operationNames, afterStats[s].operationNames)
        const added_operations = difference(afterStats[s].operationNames, beforeStats[s].operationNames)

        obj[s] =  { avgDurationMs : {
            operations,
            diff,
            added_operations,
            deleted_operations,
            pct : (diff/beforeStats[s].avgDurationMs)
        } }
        return obj
    }, {})
    const errorPctByService = Object.keys(afterStats).reduce((obj, s) => {
        const diff = (afterStats[s].errorPct - beforeStats[s].errorPct)

        // error change by operation
        const operations = Object.keys(afterStats[s].operations).reduce((obj, o) => {
            if (!afterStats[s].operations[o] || !beforeStats[s].operations[o]) {
                obj[o] = { diff : 0, pct : 0 }
                return obj
            }
            const diff = afterStats[s].operations[o].error -
                beforeStats[s].operations[o].error
            obj[o] = { diff, pct : diff }
            return obj
        }, {})
        obj[s] = { errorPct : {
            operations,
            diff,
            pct : diff
        } }
        return obj
    }, {})

    return Object.keys(afterStats).reduce((obj, s) => {
        obj[s] = {
            errorPct      : errorPctByService[s].errorPct,
            avgDurationMs : avgDurationMsByService[s].avgDurationMs,
        }
        return obj
    }, {})
}

/**
 * Calcuates difference between two snapshots' snapshots and service diagrams
 * from the responses from `snapshotSummary`.
 *
 * @param {*} beforeId
 * @param {*} snapshotBeforeSummary
 * @param {*} afterId
 * @param {*} snapshotAfterSummary
 */
const diffSummary = (beforeId, snapshotBeforeSummary, afterId, snapshotAfterSummary) => {
    return {
        [`${beforeId}_${afterId}`] : {
            snapshot : snapshotDiff(snapshotBeforeSummary.snapshot, snapshotAfterSummary.snapshot),
            diagram  : diagramDiff(snapshotBeforeSummary.diagram, snapshotAfterSummary.diagram)
        }
    }
}

/**
 * Consolidated summary (grouped by service) for a snapshots and snapshot
 * service diagram from the API responses.
 *
 * @param {*} beforeId
 * @param {*} snapshotBeforeSummary
 * @param {*} afterId
 * @param {*} snapshotAfterSummary
 */
const snapshotSummary = (snapshotApiResponse, diagramApiResponse) => {
    if (snapshotApiResponse.data.id !== diagramApiResponse.data.id) {
        return {}
    }

    const services = snapshotServiceStats(snapshotApiResponse)
    const diagram = diagramStats(diagramApiResponse)

    Object.keys(services).forEach((s) => {
        for (var n of diagram.edges) {
            const connection = n.split('>')
            if (s === connection[0]) {
                services[s].dependencies = services[s].dependencies || {}
                services[s].dependencies[connection[1]] = true
            }
        }
    })

    return {
        [snapshotApiResponse.data.id] : {
            snapshot : services,
            diagram  : diagram
        }
    }
}

module.exports = { snapshotSummary, diffSummary }
