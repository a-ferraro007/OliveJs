#!/usr/bin/env bun
import { server } from "./src/server/server"
import { Mode } from "./types"

console.log("\n🫒 olive dev\n")
const app = await server()
const { config } = app

app.listen(config.mode ?? Mode.develop, () => {
  console.log(`[  info  ] Server is listening on port ${config.port}`)
})
