#!/usr/bin/env bun

import arg from "arg"
import prompts from "prompts"

// @ts-ignore
import { version } from "./package.json"

// console.log("create 🫒")

const args = arg({
	"--help": Boolean,
	"--version": Boolean,
    "--name": String,

	"-h": "--help",
	"-v": "--version",
    "-n": "--name"
})

const res = await prompts({
    type: "text",
    name: "appName",
    message: "What is the name of your app?",
    initial: "olive",
})

console.log(res)
