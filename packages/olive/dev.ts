#!/usr/bin/env bun
import arg from "arg"
import {server} from './src/server/server'
import { Mode } from "./types";

const app = await server()
const {config} = app 

console.log({config});

app.listen(config.mode ?? Mode.develop, () => {
    console.log(`Server is listening on port ${config.port}`)
})