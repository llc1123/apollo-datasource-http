import http from 'http'
import { AddressInfo } from 'net'
import { URLSearchParams } from 'url'

import test from 'ava'
import { setGlobalDispatcher, Agent, Pool, Dispatcher } from 'undici'

import { HTTPDataSource, Request, Response, RequestError } from '../src'

const agent = new Agent({
  keepAliveTimeout: 10, // milliseconds
  keepAliveMaxTimeout: 10, // milliseconds
})

setGlobalDispatcher(agent)

test('Should be able to make a simple GET call', async (t) => {
  t.plan(5)

  const path = '/'

  const wanted = { name: 'foo' }

  const server = http.createServer((req, res) => {
    t.is(req.method, 'GET')
    res.writeHead(200, {
      'content-type': 'application/json',
    })
    res.write(JSON.stringify(wanted))
    res.end()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }
    getFoo() {
      return this.get(path)
    }
  })()

  const response = await dataSource.getFoo()

  t.false(response.isFromCache)
  t.false(response.memoized)
  t.falsy(response.maxTtl)
  t.deepEqual(response.body, { name: 'foo' })
})

test('Should be able to make a simple POST call', async (t) => {
  t.plan(2)

  const path = '/'

  const wanted = { name: 'foo' }

  const server = http.createServer((req, res) => {
    t.is(req.method, 'POST')
    res.writeHead(200, {
      'content-type': 'application/json',
    })
    res.write(JSON.stringify(wanted))
    res.end()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }
    postFoo() {
      return this.post(path)
    }
  })()

  const response = await dataSource.postFoo()

  t.deepEqual(response.body, { name: 'foo' })
})

test('Should be able to make a simple POST with JSON body', async (t) => {
  t.plan(4)

  const path = '/'

  const wanted = { name: 'foo' }

  const server = http.createServer((req, res) => {
    t.is(req.method, 'POST')
    t.is(req.headers['content-type'], 'application/json; charset=utf-8')

    let data = ''

    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => {
      t.deepEqual(data, '{"foo":"bar"}')
      res.writeHead(200, {
        'content-type': 'application/json',
      })
      res.write(JSON.stringify(wanted))
      res.end()
      res.socket?.unref()
    })
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }
    postFoo() {
      return this.post(path, {
        body: {
          foo: 'bar',
        },
      })
    }
  })()

  const response = await dataSource.postFoo()

  t.deepEqual(response.body, { name: 'foo' })
})

test('Should be able to make a simple DELETE call', async (t) => {
  t.plan(2)

  const path = '/'

  const wanted = { name: 'foo' }

  const server = http.createServer((req, res) => {
    t.is(req.method, 'DELETE')
    res.writeHead(200, {
      'content-type': 'application/json',
    })
    res.write(JSON.stringify(wanted))
    res.end()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }
    deleteFoo() {
      return this.delete(path)
    }
  })()

  const response = await dataSource.deleteFoo()

  t.deepEqual(response.body, { name: 'foo' })
})

test('Should be able to make a simple PUT call', async (t) => {
  t.plan(2)

  const path = '/'

  const wanted = { name: 'foo' }

  const server = http.createServer((req, res) => {
    t.is(req.method, 'PUT')
    res.writeHead(200, {
      'content-type': 'application/json',
    })
    res.write(JSON.stringify(wanted))
    res.end()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }
    putFoo() {
      return this.put(path)
    }
  })()

  const response = await dataSource.putFoo()

  t.deepEqual(response.body, { name: 'foo' })
})

test('Should be able to make a simple PATCH call', async (t) => {
  t.plan(2)

  const path = '/'

  const wanted = { name: 'foo' }

  const server = http.createServer((req, res) => {
    t.is(req.method, 'PATCH')
    res.writeHead(200, {
      'content-type': 'application/json',
    })
    res.write(JSON.stringify(wanted))
    res.end()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }
    patchFoo() {
      return this.patch(path)
    }
  })()

  const response = await dataSource.patchFoo()

  t.deepEqual(response.body, { name: 'foo' })
})

test('Should be able to pass query params', async (t) => {
  t.plan(3)

  const path = '/'

  const wanted = { name: 'foo' }

  const server = http.createServer((req, res) => {
    t.is(req.method, 'GET')
    t.is(req.url, '/?a=1&b=2')
    res.writeHead(200, {
      'content-type': 'application/json',
    })
    res.write(JSON.stringify(wanted))
    res.end()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }
    getFoo() {
      return this.get(path, {
        query: {
          a: 1,
          b: '2',
          c: undefined,
        },
      })
    }
  })()

  const response = await dataSource.getFoo()

  t.deepEqual(response.body, { name: 'foo' })
})

test('Should error on HTTP errors > 299 and != 304', async (t) => {
  t.plan(4)

  const path = '/'

  const server = http.createServer((req, res) => {
    const queryObject = new URLSearchParams(req.url?.replace('/?', ''))
    t.is(req.method, 'GET')
    res.writeHead(parseInt(queryObject.get('statusCode') || '0', 10))
    res.end()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }
    getFoo(statusCode: number) {
      return this.get(path, {
        query: {
          statusCode,
        },
      })
    }
  })()

  await t.throwsAsync(
    dataSource.getFoo(401),
    {
      instanceOf: Error,
      code: 401,
      message: 'Response code 401 (Unauthorized)',
    },
    'Unauthenticated',
  )

  await t.throwsAsync(
    dataSource.getFoo(500),
    {
      instanceOf: Error,
      code: 500,
      message: 'Response code 500 (Internal Server Error)',
    },
    'Internal Server Error',
  )
})

test('Should not parse content as JSON when content-type header is missing', async (t) => {
  t.plan(3)

  const path = '/'

  const wanted = { name: 'foo' }

  const server = http.createServer((req, res) => {
    t.is(req.method, 'GET')
    res.writeHead(200)
    res.write(JSON.stringify(wanted))
    res.end()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }
    getFoo() {
      return this.get(path)
    }
  })()

  const response = await dataSource.getFoo()
  t.is(response.statusCode, 200)
  t.is(response.body, JSON.stringify(wanted))
})

test('Should memoize concurrent and subsequent GET calls to the same endpoint', async (t) => {
  t.plan(16)

  const path = '/'

  const wanted = { name: 'foo' }

  const server = http.createServer((req, res) => {
    t.is(req.method, 'GET')
    res.writeHead(200, {
      'content-type': 'application/json',
    })
    res.write(JSON.stringify(wanted))
    setTimeout(() => res.end(), 50).unref()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }
    getFoo() {
      return this.get(path)
    }
  })()

  const concurrent1 = dataSource.getFoo()
  const concurrent2 = dataSource.getFoo()
  const concurrent3 = dataSource.getFoo()
  t.deepEqual((await concurrent1).body, wanted)
  t.deepEqual((await concurrent2).body, wanted)
  t.deepEqual((await concurrent3).body, wanted)
  t.false((await concurrent1).isFromCache)
  t.false((await concurrent1).isFromCache)
  t.false((await concurrent1).isFromCache)
  t.false((await concurrent1).memoized)
  t.true((await concurrent2).memoized)
  t.true((await concurrent3).memoized)

  const subsequent2 = await dataSource.getFoo()
  t.deepEqual(subsequent2.body, wanted)
  t.false(subsequent2.isFromCache)
  t.true(subsequent2.memoized)

  const subsequent3 = await dataSource.getFoo()
  t.deepEqual(subsequent3.body, wanted)
  t.false(subsequent3.isFromCache)
  t.true(subsequent3.memoized)
})

test('Should memoize subsequent GET calls to the same endpoint when the memoize option is undefined', async (t) => {
  t.plan(17)

  const path = '/'

  const MAX_SUBSEQUENT_CALLS = 3

  const wanted = { name: 'foo' }

  const server = http.createServer((req, res) => {
    t.is(req.method, 'GET')
    res.writeHead(200, {
      'content-type': 'application/json',
    })
    res.write(JSON.stringify(wanted))
    setTimeout(() => res.end(), 50).unref()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }
    getFoo() {
      return this.get(path)
    }
  })()

  const firstCall = await dataSource.getFoo()
  t.deepEqual(firstCall.body, wanted)
  t.false(firstCall.isFromCache)
  t.false(firstCall.memoized)
  t.falsy(firstCall.maxTtl)

  for (let currentCall = 0; currentCall < MAX_SUBSEQUENT_CALLS; currentCall++) {
    const subsequentCall = await dataSource.getFoo()

    t.deepEqual(subsequentCall.body, wanted)
    t.false(subsequentCall.isFromCache)
    t.true(subsequentCall.memoized)
    t.falsy(subsequentCall.maxTtl)
  }
})

test('Should memoize subsequent GET calls to the same endpoint when the memoize option is true', async (t) => {
  t.plan(17)

  const path = '/'

  const MAX_SUBSEQUENT_CALLS = 3

  const wanted = { name: 'foo' }

  const server = http.createServer((req, res) => {
    t.is(req.method, 'GET')
    res.writeHead(200, {
      'content-type': 'application/json',
    })
    res.write(JSON.stringify(wanted))
    setTimeout(() => res.end(), 50).unref()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }
    getFoo() {
      return this.get(path, { memoize: true })
    }
  })()

  const firstCall = await dataSource.getFoo()
  t.deepEqual(firstCall.body, wanted)
  t.false(firstCall.isFromCache)
  t.false(firstCall.memoized)
  t.falsy(firstCall.maxTtl)

  for (let currentCall = 0; currentCall < MAX_SUBSEQUENT_CALLS; currentCall++) {
    const subsequentCall = await dataSource.getFoo()

    t.deepEqual(subsequentCall.body, wanted)
    t.false(subsequentCall.isFromCache)
    t.true(subsequentCall.memoized)
    t.falsy(subsequentCall.maxTtl)
  }
})

test('Should not memoize subsequent GET calls to the same endpoint when the memoize option is false', async (t) => {
  t.plan(15)

  const path = '/'

  const MAX_CALLS = 3

  const wanted = { name: 'foo' }

  const server = http.createServer((req, res) => {
    t.is(req.method, 'GET')
    res.writeHead(200, {
      'content-type': 'application/json',
    })
    res.write(JSON.stringify(wanted))
    setTimeout(() => res.end(), 50).unref()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }
    getFoo() {
      return this.get(path, { memoize: false })
    }
  })()

  for (let currentCall = 0; currentCall < MAX_CALLS; currentCall++) {
    const subsequentCall = await dataSource.getFoo()

    t.deepEqual(subsequentCall.body, wanted)
    t.false(subsequentCall.isFromCache)
    t.false(subsequentCall.memoized)
    t.falsy(subsequentCall.maxTtl)
  }
})

test('Should not memoize subsequent GET calls for unsuccessful responses', async (t) => {
  t.plan(17)

  const path = '/'

  const wanted = { name: 'foo' }

  const server = http.createServer((req, res) => {
    const queryObject = new URLSearchParams(req.url?.replace('/?', ''))
    t.is(req.method, 'GET')
    res.writeHead(parseInt(queryObject.get('statusCode') || '0', 10), {
      'content-type': 'application/json',
    })
    res.write(JSON.stringify(wanted))
    setTimeout(() => res.end(), 50).unref()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }
    onError(error: Error) {
      if (error instanceof RequestError) {
        t.false(error.response.isFromCache)
        t.false(error.response.memoized)
        t.falsy(error.response.maxTtl)
        t.truthy(error.request)
      }
    }
    getFoo(statusCode: number) {
      return this.get(path, {
        query: {
          statusCode,
        },
      })
    }
  })()

  const response = await dataSource.getFoo(300)
  t.deepEqual(response.body, { name: 'foo' })
  t.false(response.isFromCache)
  t.false(response.memoized)
  t.falsy(response.maxTtl)

  await t.throwsAsync(dataSource.getFoo(401), {
    instanceOf: Error,
    code: 401,
    message: 'Response code 401 (Unauthorized)',
  })
  await t.throwsAsync(dataSource.getFoo(500), {
    instanceOf: Error,
    code: 500,
    message: 'Response code 500 (Internal Server Error)',
  })
})

test('Should be able to define a custom cache key for request memoization', async (t) => {
  t.plan(7)

  const path = '/'

  const wanted = { name: 'foo' }

  const server = http.createServer((req, res) => {
    t.is(req.method, 'GET')
    res.writeHead(200, {
      'content-type': 'application/json',
    })
    res.write(JSON.stringify(wanted))
    res.end()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }
    onCacheKeyCalculation(request: Request) {
      t.pass('onCacheKeyCalculation')
      t.truthy(request)
      return 'foo'
    }
    getFoo() {
      return this.get(path)
    }
  })()

  let response = await dataSource.getFoo()
  t.deepEqual(response.body, wanted)

  response = await dataSource.getFoo()
  t.deepEqual(response.body, wanted)
})

test('Should correctly calculate and sort query parameters', async (t) => {
  t.plan(3)

  const path = '/'

  const wanted = { name: 'foo' }

  const server = http.createServer((req, res) => {
    t.is(req.method, 'GET')
    t.is(req.url, '/?a=1&b=2&z=z')
    res.writeHead(200, {
      'content-type': 'application/json',
    })
    res.write(JSON.stringify(wanted))
    res.end()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }
    getFoo() {
      return this.get(path, {
        query: {
          b: 2,
          a: 1,
          z: 'z',
        },
      })
    }
  })()

  const response = await dataSource.getFoo()
  t.deepEqual(response.body, wanted)
})

test('Should call onError on request error', async (t) => {
  t.plan(11)

  const path = '/'

  const server = http.createServer((req, res) => {
    t.is(req.method, 'GET')
    res.writeHead(500)
    res.end()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }

    onResponse<TResult = unknown>(
      request: Request,
      response: Response<TResult>,
    ) {
      t.truthy(request)
      t.truthy(response)
      t.pass('onResponse')
      return super.onResponse<TResult>(request, response)
    }

    onError(error: Error) {
      t.is(error.name, 'RequestError')
      t.is(error.message, 'Response code 500 (Internal Server Error)')
      if (error instanceof RequestError) {
        t.is(error.code, 500)
        t.truthy(error.request)
        t.truthy(error.response)
      }
      t.pass('onRequestError')
    }

    async getFoo() {
      return await this.get(path)
    }
  })()

  await t.throwsAsync(
    dataSource.getFoo(),
    {
      instanceOf: Error,
      code: 500,
      message: 'Response code 500 (Internal Server Error)',
    },
    'Server error',
  )
})

test('Should be possible to pass a request context', async (t) => {
  t.plan(3)

  const path = '/'

  const server = http.createServer((req, res) => {
    t.is(req.method, 'GET')
    res.writeHead(200)
    res.end()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }

    onResponse<TResult = unknown>(
      request: Request,
      response: Response<TResult>,
    ) {
      t.deepEqual(request.context, { a: '1' })
      t.pass('onResponse')
      return super.onResponse<TResult>(request, response)
    }

    async getFoo() {
      return await this.get(path, {
        context: {
          a: '1',
        },
      })
    }
  })()

  await dataSource.getFoo()
})

test('Should abort request when abortController signal is called', async (t) => {
  t.plan(2)

  const path = '/'

  const server = http
    .createServer((req, res) => {
      t.is(req.method, 'GET')
      setTimeout(() => {
        res.writeHead(200)
        res.end()
        res.socket?.unref()
      }, 50)
    })
    .unref()

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const abortController = new AbortController()

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }

    async getFoo() {
      return await this.get(path, {
        signal: abortController.signal,
      })
    }
  })()

  const throwPromise = t.throwsAsync(
    async () => {
      try {
        await dataSource.getFoo()
        t.fail()
      } catch (error) {
        t.pass('Throw error')
        throw error
      }
    },
    {
      instanceOf: Error,
      message: 'Request aborted',
    },
    'Timeout',
  )

  abortController.abort()

  await throwPromise
})

test('Should timeout because server does not respond fast enough', async (t) => {
  t.plan(3)

  const path = '/'

  const server = http
    .createServer((req, res) => {
      t.is(req.method, 'GET')
      setTimeout(() => {
        res.writeHead(200)
        res.end()
        res.socket?.unref()
      }, 100)
    })
    .unref()

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL, {
        clientOptions: {
          bodyTimeout: 50,
          headersTimeout: 50,
        },
      })
    }

    async getFoo() {
      return await this.get(path)
    }
  })()

  await t.throwsAsync(
    async () => {
      try {
        await dataSource.getFoo()
        t.fail()
      } catch (error) {
        t.pass('Throw error')
        throw error
      }
    },
    {
      instanceOf: Error,
      message: 'Headers Timeout Error',
    },
    'Timeout',
  )
})

test('Should be able to modify request in willSendRequest', async (t) => {
  t.plan(3)

  const path = '/'

  const wanted = { name: 'foo' }

  const server = http.createServer((req, res) => {
    t.is(req.method, 'GET')
    t.deepEqual(req.headers['x-foo'], 'bar')
    res.writeHead(200, {
      'content-type': 'application/json',
    })
    res.write(JSON.stringify(wanted))
    res.end()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }
    async onRequest(request: Dispatcher.RequestOptions) {
      request.headers = {
        'X-Foo': 'bar',
      }
    }
    getFoo() {
      return this.get(path)
    }
  })()

  const response = await dataSource.getFoo()

  t.deepEqual(response.body, wanted)
})

test('Should be able to define base headers for every request', async (t) => {
  t.plan(4)

  const path = '/'

  const wanted = { name: 'foo' }

  const server = http.createServer((req, res) => {
    t.is(req.method, 'GET')
    t.deepEqual(req.headers['x-foo'], 'bar')
    res.writeHead(200, {
      'content-type': 'application/json',
    })
    res.write(JSON.stringify(wanted))
    res.end()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL, {
        requestOptions: {
          headers: {
            'X-Foo': 'bar',
          },
        },
      })
    }
    async onRequest(request: Dispatcher.RequestOptions) {
      t.deepEqual(request.headers, {
        'X-Foo': 'bar',
      })
    }
    getFoo() {
      return this.get(path)
    }
  })()

  const response = await dataSource.getFoo()

  t.deepEqual(response.body, wanted)
})

test('Initialize data source with cache and context', async (t) => {
  t.plan(3)

  const path = '/'

  const wanted = { name: 'foo' }

  const server = http.createServer((req, res) => {
    t.is(req.method, 'GET')
    res.writeHead(200, {
      'content-type': 'application/json',
    })
    res.write(JSON.stringify(wanted))
    res.end()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL)
    }
    getFoo() {
      t.deepEqual(this.context, {
        a: 1,
      })
      return this.get(path)
    }
  })()

  const cacheMap = new Map<string, string>()

  dataSource.initialize({
    context: {
      a: 1,
    },
    cache: {
      async delete(key: string) {
        return cacheMap.delete(key)
      },
      async get(key: string) {
        return cacheMap.get(key)
      },
      async set(key: string, value: string) {
        cacheMap.set(key, value)
      },
    },
  })

  const response = await dataSource.getFoo()

  t.deepEqual(response.body, wanted)
})

test('Should be able to pass custom Undici Pool', async (t) => {
  t.plan(2)

  const path = '/'

  const wanted = { name: 'foo' }

  const server = http.createServer((req, res) => {
    t.is(req.method, 'GET')
    res.writeHead(200, {
      'content-type': 'application/json',
    })
    res.write(JSON.stringify(wanted))
    res.end()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)
  const pool = new Pool(baseURL)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL, {
        pool,
      })
    }
    getFoo() {
      return this.get(path)
    }
  })()

  const response = await dataSource.getFoo()

  t.deepEqual(response.body, wanted)
})

test('Should be merge headers', async (t) => {
  t.plan(2)

  const path = '/'

  const mockHeaders = {
    'test-a': 'a',
    'test-b': 'b',
  }
  const server = http.createServer((req, res) => {
    t.is(req.method, 'GET')
    res.writeHead(200, {
      'content-type': 'application/json',
    })
    res.write(
      JSON.stringify({
        'test-a': req.headers['test-a'],
        'test-b': req.headers['test-b'],
      }),
    )
    res.end()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)
  const pool = new Pool(baseURL)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL, {
        pool,
        requestOptions: {
          headers: {
            'test-a': mockHeaders['test-a'],
          },
        },
      })
    }
    getFoo() {
      return this.get(path, {
        headers: {
          'test-b': mockHeaders['test-b'],
        },
      })
    }
  })()

  const response = await dataSource.getFoo()

  t.deepEqual(response.body, mockHeaders)
})

test('Should be able to overwrite global request options', async (t) => {
  t.plan(5)

  const path = '/'

  const wanted = { name: 'foo' }

  const server = http.createServer((req, res) => {
    t.is(req.method, 'GET')
    t.deepEqual(req.headers['x-foo'], 'qux')
    res.writeHead(200, {
      'content-type': 'application/json',
    })
    res.write(JSON.stringify(wanted))
    res.end()
    res.socket?.unref()
  })

  t.teardown(server.close.bind(server))

  server.listen()

  const baseURL = getBaseUrlOf(server)

  const dataSource = new (class extends HTTPDataSource {
    constructor() {
      super(baseURL, {
        requestOptions: {
          headers: {
            'X-Foo': 'bar',
          },
          memoize: false,
        },
      })
    }
    async onRequest(request: Dispatcher.RequestOptions) {
      t.deepEqual(request.headers, {
        'X-Foo': 'qux',
      })
    }
    getFoo() {
      return this.get(path, { headers: { 'X-Foo': 'qux' }, memoize: true })
    }
  })()

  t.deepEqual((await dataSource.getFoo()).body, wanted)
  t.true((await dataSource.getFoo()).memoized)
})

// Utils
function getBaseUrlOf(server: http.Server) {
  return `http://localhost:${(server.address() as AddressInfo)?.port}`
}
