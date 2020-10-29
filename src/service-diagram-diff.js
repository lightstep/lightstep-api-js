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


module.exports = (beforeDiagram, afterDiagram) => {
    const beforeNodes = getNodes(beforeDiagram)
    const afterNodes = getNodes(afterDiagram)
    const beforeEdges = getEdges(beforeDiagram)
    const afterEdges = getEdges(afterDiagram)
    return {
        added_services      : difference(beforeNodes, afterNodes),
        deleted_services    : difference(afterNodes, beforeNodes),
        added_connections   : difference(beforeEdges, afterEdges),
        deleted_connections : difference(afterEdges, beforeEdges),
        latency             : criticalPathDiff(beforeDiagram, afterDiagram)
    }
}