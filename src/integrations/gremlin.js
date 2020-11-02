const fetch = require('node-fetch')

/**
 * Creates a Gremlin latency attack targeting a container
 * with label app=service_name
 *
 * @param {string} targetAppLabel
 */
module.exports.createGremlinLatencyAttack =
  async(targetAppLabel, { duration = 60, latencyMs = 2000, apiKey = process.env.GREMLIN_API_KEY, traceId = '' }) => {
      const attack = {
          "command" : {
              "type" : "latency",
              "args" : [
                  "latency",
                  "-l",
                  `${duration}`,
                  "-m",
                  `${latencyMs}`,
                  "-h",
                  "^api.gremlin.com,^ingest.staging.lightstep.com,^ingest.lightstep.com",
                  "-p",
                  "^53"
              ]
          },
          "annotations" : {
              "lightstep.created_from_trace_id" : `${traceId}`
          },
          "target" : {
              "containers" : {
                  "labels" : {
                      "app" : targetAppLabel
                  }
              },
              "type" : "Random"
          }
      }
      const response = await fetch('https://api.gremlin.com/v1/attacks/new', {
          method  : 'POST',
          headers : {
              "Content-Type"  : "application/json",
              "Authorization" : `Key ${apiKey}`,
          },
          body : JSON.stringify(attack) } )
      const text = await response.text()
      if (response.status !== 201) {
          throw new Error(`HTTP Error ${response.status}: ${text}`)
      }
      return text
  }
