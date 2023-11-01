export class WrappedResponse {
  private response!: Response
  private options: ResponseInit = {}

  status(code: number): WrappedResponse {
    this.options.status = code
    return this
  }

  option(option: ResponseInit): WrappedResponse {
    this.options = Object.assign(this.options, option)
    return this
  }

  json(body: any): void {
    this.response = Response.json(body, this.options)
  }

  send(body: any) {
    this.response = new Response(body, this.options)
  }

  send404() {
    this.response = new Response(null, {
      status: 404,
      statusText: "404",
    })
  }

  headers(headers: HeadersInit): WrappedResponse {
    this.options.headers = headers
    return this
  }

  setHeader(key: string, value: string) {
    if (!key || !value) {
      throw new Error("Missing Key or Value")
    }

    const h = new Headers({ key: value })
    this.options.headers = {
      ...this.options.headers,
      ...h,
    }
    return this
  }

  getHeaders() {
    return this.options.headers
  }

  getResponse() {
    return this.response
  }

  isReady() {
    return !!this.response
  }
}
