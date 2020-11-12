const getNodes = (serviceDiagram) => {
    return Object.keys(serviceDiagram.data.attributes['service-diagram'].nodes)
}

const getEdges = (serviceDiagram) => {
    return Object.keys(serviceDiagram.data.attributes['service-diagram'].edges)
}

const getCriticalPathLatency = (serviceDiagram, node) => {
    return serviceDiagram.data.attributes['service-diagram'].overlays.nodes[node].average_critical_path_latency_micros
}

const intersection = (d1, d2) => {
    return d2.filter(d => d1.includes(d))
}

const difference = (d1, d2) => {
    return d2.filter(d => !d1.includes(d))
}

const criticalPathDiff = (beforeDiagram, afterDiagram) => {
    const comparisonNodes = intersection(getNodes(beforeDiagram), getNodes(afterDiagram))
    const criticalPathDiff = {}
    for (var n of comparisonNodes) {
        const latencyBefore = getCriticalPathLatency(beforeDiagram, n)
        const latencyAfter = getCriticalPathLatency(afterDiagram, n)
        if (!isNaN(latencyBefore) && !isNaN(latencyAfter)) {
            const diff = latencyAfter-latencyBefore
            const pct = ((diff/latencyBefore)*100).toFixed(2)
            criticalPathDiff[n] = {
                diff, pct
            }
        }
    }
    return criticalPathDiff
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

    return services.reduce((obj, s) => {
        const exemplars = snapshot.data.attributes.exemplars.filter(e => e['service-name'] === s)
        const avgDurationMs = exemplars.reduce((v, e) => v + e['duration-micros'], 0) / (exemplars.length*1000)
        const errorPct = exemplars.reduce((v, e) => v + (e['has-error'] ? 1 : 0), 0) / exemplars.length
        obj[s] = { exemplars, avgDurationMs, errorPct }
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
const diagramDiff = (beforeDiagram, afterDiagram) => {
    const before = diagramStats(beforeDiagram)
    const after = diagramStats(afterDiagram)

    return {
        added_services      : difference(before.nodes, after.nodes),
        deleted_services    : difference(after.nodes, before.nodes),
        added_connections   : difference(before.edges, after.edges),
        deleted_connections : difference(after.edges, before.edges),
        latency             : criticalPathDiff(beforeDiagram, afterDiagram)
    }
}

/**
 * Calculates average latency and error percent difference
 * between two snapshot API responses.
 */
const snapshotDiff = (beforeSnapshot, afterSnapshot) => {
    const beforeStats = snapshotServiceStats(beforeSnapshot)
    const afterStats = snapshotServiceStats(afterSnapshot)
    const avgDurationMs = Object.keys(afterStats).reduce((obj, s) => {
        const diff = (afterStats[s].avgDurationMs - beforeStats[s].avgDurationMs)
        obj[s] = {
            diff,
            pct : (diff/beforeStats[s].avgDurationMs)
        }
        return obj
    }, {})
    const errorPct = Object.keys(afterStats).reduce((obj, s) => { 
        const diff = (afterStats[s].errorPct - beforeStats[s].errorPct)
        obj[s] = {
            diff,
            pct : diff
        }
        return obj
    }, {})
    return { avgDurationMs, errorPct }
}

module.exports = { diagramStats, diagramDiff, snapshotServiceStats, snapshotDiff }
