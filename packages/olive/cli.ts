#!/usr/bin/env bun


import arg from "arg"

// @ts-ignore
import { version } from "./package.json"

const args = arg({
	"--help": Boolean,
	"--version": Boolean,

	"-h": "--help",
	"-v": "--version",
})

const command = args._[0]

switch(command) {
	case 'dev':
		import('./dev')
		break
	case 'build':
		import('./build')
		break
	default:
		console.log(`Unknown command: ${command}`)
		process.exit(1)
}