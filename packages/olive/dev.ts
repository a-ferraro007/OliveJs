#!/usr/bin/env bun
import { server } from "./src/server/server"
import { Mode } from "./types"

const app = await server()
const { config } = app

app.listen(config.mode ?? Mode.develop, () => {
  console.log(`Server is listening on port ${config.port}`)
})
