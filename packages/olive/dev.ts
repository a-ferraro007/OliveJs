#!/usr/bin/env bun
import arg from "arg"
import {server} from './src/server/server'

const app = await server()
const {config} = app 

console.log({config});

app.listen(config.port, () => {
    console.log(`Server is listening on port ${config.port}`)
})