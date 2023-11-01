#!/usr/bin/env bun

import arg from "arg"
import {server} from './src/server/server'


const app = server()

app.listen(3000, () => {
    console.log("Server is listening on port 3000")
})